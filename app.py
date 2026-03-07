import os
import psycopg2
import uuid
from flask import Flask, render_template, request, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

DB_CONFIG = {
    'dbname': 'urna-db',
    'user': 'postgres',
    'password': 'root',
    'host': 'localhost',
    'port': '5433'
}

def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception:
        raise Exception("Erro ao conectar no Postgres.")

@app.route('/')
def index():
    return render_template('cadastro.html')

@app.route('/urna')
def urna():
    return render_template('urna.html')

@app.route('/api/candidatos', methods=['POST'])
def cadastrar_candidato():
    try:
        nome = request.form['nome']
        sexo = request.form['sexo'] 
        turma = request.form['turma']
        is_novo = request.form.get('is_novo') == 'true'
        sem_foto = 'sem_foto' in request.form
        
        foto = request.files.get('foto')
        caminho_web = None

        if not sem_foto and foto and foto.filename != '':
            codigo_unico = uuid.uuid4().hex[:6]
            filename = secure_filename(f"{turma}_{sexo[:1]}_{codigo_unico}_{foto.filename}")
            caminho_fisico = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            caminho_web = f"uploads/{filename}" 
            foto.save(caminho_fisico)

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT sp_cadastrar_candidato(%s, %s, %s, %s, %s)", 
                    (nome, sexo, turma, caminho_web, is_novo))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'message': 'Candidato cadastrado com sucesso!'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/candidatos/<turma>', methods=['GET'])
def listar_por_turma(turma):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, nome, numero_chapa, caminho_foto, sexo, is_novo 
        FROM candidatos 
        WHERE turma = %s 
        ORDER BY numero_chapa ASC
    """, (turma,))
    candidatos = cur.fetchall()
    cur.close()
    conn.close()
    
    lista = [{
        'id': c[0], 
        'nome': c[1], 
        'numero': c[2], 
        'foto': c[3], 
        'sexo': c[4],
        'is_novo': c[5]
    } for c in candidatos]
    return jsonify(lista)

@app.route('/api/candidatos/<int:id>/foto', methods=['PATCH'])
def atualizar_foto(id):
    """Permite adicionar uma foto a um candidato já existente"""
    try:
        foto = request.files.get('foto')
        if not foto:
            return jsonify({'error': 'Nenhuma foto enviada'}), 400

        conn = get_db_connection()
        cur = conn.cursor()
    
        cur.execute("SELECT turma, sexo FROM candidatos WHERE id = %s", (id,))
        res = cur.fetchone()
        if not res:
            return jsonify({'error': 'Candidato não encontrado'}), 404
        
        turma, sexo = res
        codigo_unico = uuid.uuid4().hex[:6]
        filename = secure_filename(f"{turma}_{sexo[:1]}_{codigo_unico}_{foto.filename}")
        caminho_fisico = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        caminho_web = f"uploads/{filename}" 
        foto.save(caminho_fisico)

        cur.execute("UPDATE candidatos SET caminho_foto = %s WHERE id = %s", (caminho_web, id))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({'message': 'Foto adicionada com sucesso!', 'caminho': caminho_web})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/candidatos/<int:id>', methods=['DELETE'])
def deletar_candidato(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM candidatos WHERE id = %s", (id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Removido'})

@app.route('/api/votos', methods=['POST'])
def registrar_votos():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'JSON inválido'}), 400

    turma = data.get('turma')
    votos = data.get('votos', [])

    # tava quebrando quando vinha sem turma
    if not turma or not isinstance(votos, list):
        return jsonify({'error': 'Dados incompletos'}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    for voto in votos:
        numero = voto.get('numero')
        tipo = voto.get('tipo')
        if tipo not in ('VALIDO', 'BRANCO', 'NULO'):
            tipo = 'NULO'

        cur.execute(
            "INSERT INTO votos_turma (turma, numero_chapa, tipo_voto) VALUES (%s, %s, %s)",
            (turma, numero, tipo)
        )

        # precisava incrementar o contador aqui, esqueci antes
        if tipo == 'VALIDO' and numero is not None:
            cur.execute(
                "UPDATE candidatos SET votos = votos + 1 WHERE turma = %s AND numero_chapa = %s",
                (turma, numero)
            )

    conn.commit()
    cur.close()
    conn.close()
    return jsonify({'message': 'Votos registrados', 'quantidade': len(votos)})

@app.route('/api/apuracao/<turma>', methods=['GET'])
def apurar_turma(turma):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT * FROM sp_apurar_turma(%s)", (turma,))
    rows = cur.fetchall()

    candidatos = []
    for r in rows:
        candidatos.append({
            'id': r[0],
            'nome': r[1],
            'sexo': r[2],
            'votos': r[3],
            'classificacao': r[4]
        })

    # esqueci de contar brancos e nulos antes
    cur.execute(
        """
        SELECT tipo_voto, COUNT(*)
        FROM votos_turma
        WHERE turma = %s
        GROUP BY tipo_voto
        """,
        (turma,)
    )
    contagem = {'VALIDO': 0, 'BRANCO': 0, 'NULO': 0}
    for tipo, qtd in cur.fetchall():
        contagem[tipo] = qtd

    cur.close()
    conn.close()

    return jsonify({
        'turma': turma,
        'candidatos': candidatos,
        'votos_validos': contagem['VALIDO'],
        'votos_brancos': contagem['BRANCO'],
        'votos_nulos': contagem['NULO']
    })

@app.route('/api/urna/<turma>', methods=['GET'])
def configurar_urna(turma):
    turno = request.args.get('turno', '1')

    conn = get_db_connection()
    cur = conn.cursor()

    if turno == '2':
        cur.execute("SELECT * FROM sp_apurar_turma(%s)", (turma,))
        rows = cur.fetchall()

        if not rows:
            cur.close()
            conn.close()
            return jsonify({'error': 'Sem candidatos para 2 turno'}), 404

        # descobre o modo atual da turma
        cur.execute("SELECT modo_voto FROM sp_configurar_urna(%s)", (turma,))
        modo_row = cur.fetchone()
        modo_voto = modo_row[0] if modo_row else 'DISPUTA_DUPLA'

        empatados_ids = []
        sexos_presentes = set()

        if modo_voto == 'DISPUTA_DUPLA':
            for sexo_alvo in ('Masculino', 'Feminino'):
                do_sexo = [r for r in rows if r[2] == sexo_alvo]
                if not do_sexo: continue
                max_votos = max(r[3] for r in do_sexo)
                candidatos_topo = [r for r in do_sexo if r[3] == max_votos]
                if len(candidatos_topo) > 1:
                    empatados_ids.extend(r[0] for r in candidatos_topo)
                    sexos_presentes.add(sexo_alvo)
        else:
            # UNICO_SEXO: 2 vagas, precisa checar quem disputa qual
            if len(rows) >= 2:
                votos_1 = rows[0][3]
                cand_votos_1 = [r for r in rows if r[3] == votos_1]
                if len(cand_votos_1) > 2:
                    empatados_ids.extend(r[0] for r in cand_votos_1)
                elif len(cand_votos_1) == 2:
                    pass  # as 2 vagas já foram preenchidas, sem empate
                else:
                    votos_2 = rows[1][3]
                    cand_votos_2 = [r for r in rows if r[3] == votos_2]
                    if len(cand_votos_2) > 1:
                        empatados_ids.extend(r[0] for r in cand_votos_2)

        if not empatados_ids:
            cur.close()
            conn.close()
            return jsonify({'error': 'Não há candidatos empatados para 2 turno nesta turma.'}), 400

        candidatos_ids = empatados_ids
        if len(sexos_presentes) > 1:
            modo_voto = 'DISPUTA_DUPLA'
            votos_por_aluno = 2
        else:
            modo_voto = 'UNICO_SEXO'
            votos_por_aluno = 1
    else:
        cur.execute("SELECT * FROM sp_configurar_urna(%s)", (turma,))
        row = cur.fetchone()

        if not row:
            cur.close()
            conn.close()
            return jsonify({'error': 'Turma sem configuração'}), 404

        modo_voto, votos_por_aluno, candidatos_ids, eleitos_ids = row
        candidatos_ids = candidatos_ids or []

        if modo_voto == 'SEM_VOTACAO' and len(candidatos_ids) == 0:
            cur.close()
            conn.close()
            return jsonify({'error': 'Turma sem candidatos'}), 404

    dados_candidatos = []
    if candidatos_ids:
        cur.execute("""
            SELECT id, nome, numero_chapa, caminho_foto, sexo
            FROM candidatos
            WHERE id = ANY(%s)
            ORDER BY numero_chapa ASC
        """, (candidatos_ids,))
        for c in cur.fetchall():
            dados_candidatos.append({
                'id': c[0],
                'nome': c[1],
                'numero': c[2],
                'foto': c[3],
                'sexo': c[4]
            })

    cur.close()
    conn.close()

    return jsonify({
        'turma': turma,
        'modo_voto': modo_voto,
        'votos_por_aluno': votos_por_aluno,
        'candidatos_votacao': dados_candidatos,
        'eleitos_automaticos': []
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)