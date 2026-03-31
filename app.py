import os
import psycopg2
import uuid
from io import BytesIO
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

DB_CONFIG = {
    'dbname': 'urna_db',
    'user': 'postgres',
    'password': 'root',
    'host': 'localhost',
    'port': '5432'
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
    # Página única da urna; a seleção de turma acontece na própria tela
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
    """
    Recebe um lote de votos da urna.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'JSON inválido'}), 400

    turma = data.get('turma')
    votos = data.get('votos', [])

    if not turma or not isinstance(votos, list):
        return jsonify({'error': 'Dados incompletos'}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    for voto in votos:
        numero = voto.get('numero')
        tipo = voto.get('tipo')

        # Garante um tipo de voto conhecido
        if tipo not in ('VALIDO', 'BRANCO', 'NULO'):
            tipo = 'NULO'

        # Registra o voto na tabela de votos da turma
        cur.execute(
            "INSERT INTO votos_turma (turma, numero_chapa, tipo_voto) VALUES (%s, %s, %s)",
            (turma, numero, tipo)
        )

        # Só conta voto válido que tem número de chapa
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
    """
    Devolve, para uma turma:
    - lista de candidatos com votos e classificação
    - quantidade de votos em branco e nulos
    """
    conn = get_db_connection()
    cur = conn.cursor()

    # Candidatos e votos (usa a função que já existe no banco)
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

    # Contagem de brancos e nulos
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


@app.route('/api/estatistica_pdf/<turma>', methods=['GET'])
def estatistica_pdf(turma):
    """
    Gera um PDF estatístico da turma com:
    - candidatos, votos e classificação
    - totais de votos válidos, brancos e nulos
    - lista de todos os votos registrados
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Dados de candidatos e classificação
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

        # Contagem de brancos / nulos / válidos
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

        # Lista completa de votos
        cur.execute(
            """
            SELECT id, numero_chapa, tipo_voto, data_hora
            FROM votos_turma
            WHERE turma = %s
            ORDER BY id ASC
            """,
            (turma,)
        )
        votos = cur.fetchall()

        # Fechamento do banco movido para DEPOIS de consultar o modo_voto

        # Se não houver nenhum voto registrado, ainda assim gera um PDF simples
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        y = height - 40
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(40, y, f"Relatório Estatístico Geral - Turma {turma}")
        y -= 20

        pdf.setFont("Helvetica-Oblique", 9)
        pdf.drawString(40, y, "Este relatório considera todos os votos registrados na turma, incluindo eventuais 2º turnos.")
        y -= 20

        pdf.setFont("Helvetica", 11)
        pdf.drawString(40, y, f"Total de votos válidos: {contagem['VALIDO']}")
        y -= 16
        pdf.drawString(40, y, f"Total de votos em branco: {contagem['BRANCO']}")
        y -= 16
        pdf.drawString(40, y, f"Total de votos nulos: {contagem['NULO']}")
        y -= 24

        # Obter o modo de voto para saber quais as regras de eleitos
        cur.execute("SELECT modo_voto FROM sp_configurar_urna(%s)", (turma,))
        modo_row = cur.fetchone()
        modo_voto = modo_row[0] if modo_row else 'DISPUTA_DUPLA'
        
        cur.close()
        conn.close()

        vencedores = []
        if modo_voto == 'DISPUTA_DUPLA':
            # Maior(es) de cada sexo
            for sexo_cand in ('Masculino', 'Feminino'):
                do_sexo = [c for c in candidatos if c['sexo'] == sexo_cand]
                if do_sexo:
                    max_votos = max(c['votos'] for c in do_sexo)
                    vencedores.extend([c for c in do_sexo if c['votos'] == max_votos])
            titulo_eleitos = "Candidatos Mais Votados por Sexo:"
        else:
            # UNICO_SEXO: Elegem-se 2, avaliamos o preenchimento dessas 2 vagas
            titulo_eleitos = "Candidatos Mais Votados (Top 2 Vagas):"
            if len(candidatos) > 0:
                votos_1 = candidatos[0]['votos']
                cand_votos_1 = [c for c in candidatos if c['votos'] == votos_1]
                
                if len(cand_votos_1) >= 2:
                    # Se 2 ou mais pessoas empataram no topo, elas preenchem (ou disputam) as 2 vagas
                    vencedores.extend(cand_votos_1)
                else:
                    # Apenas 1 pessoa com mais votos ganha a 1ª vaga
                    vencedores.extend(cand_votos_1)
                    if len(candidatos) > 1:
                        # Vamos ver quem ocupa a 2ª vaga
                        votos_2 = candidatos[1]['votos']
                        cand_votos_2 = [c for c in candidatos if c['votos'] == votos_2]
                        vencedores.extend(cand_votos_2)

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(40, y, titulo_eleitos)
        y -= 18
        pdf.setFont("Helvetica", 11)
        if vencedores:
            for cand in vencedores:
                texto = f"- {cand['nome']} ({cand['sexo']}) - {cand['votos']} voto(s)"
                pdf.drawString(50, y, texto)
                y -= 14
                if y < 80:
                    pdf.showPage()
                    y = height - 40
        else:
            pdf.drawString(50, y, "Nenhum candidato com votos.")
            y -= 18

        # Tabela geral de candidatos
        if y < 120:
            pdf.showPage()
            y = height - 40
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(40, y, "Resumo por candidato:")
        y -= 18
        pdf.setFont("Helvetica", 11)
        for cand in candidatos:
            linha = f"Chapa ID {cand['id']} - {cand['nome']} ({cand['sexo']}): {cand['votos']} voto(s) - Classificação {cand['classificacao']}"
            pdf.drawString(50, y, linha)
            y -= 14
            if y < 80:
                pdf.showPage()
                y = height - 40

        # Lista de todos os votos
        if votos:
            if y < 120:
                pdf.showPage()
                y = height - 40
            pdf.setFont("Helvetica-Bold", 12)
            pdf.drawString(40, y, "Lista completa de votos:")
            y -= 18
            pdf.setFont("Helvetica", 10)
            for v in votos:
                vid, numero_chapa, tipo_voto, data_hora = v
                num_txt = f"Chapa {numero_chapa}" if numero_chapa is not None else "Sem número"
                linha = f"#{vid} - {num_txt} - {tipo_voto} - {data_hora.strftime('%d/%m/%Y %H:%M:%S')}"
                pdf.drawString(50, y, linha)
                y -= 12
                if y < 60:
                    pdf.showPage()
                    y = height - 40

        pdf.showPage()
        pdf.save()
        buffer.seek(0)

        filename = f"estatistica_{turma}.pdf"
        return send_file(
            buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/urna/<turma>', methods=['GET'])
def configurar_urna(turma):
    """
    Configura os candidatos da urna para uma turma.
    - Turno 1 (padrão): usa sp_configurar_urna (todos os candidatos).
    - Turno 2: usa sp_apurar_turma para selecionar apenas candidatos empatados
      entre si por sexo (meninos com meninos, meninas com meninas).
    """
    turno = request.args.get('turno', '1')

    conn = get_db_connection()
    cur = conn.cursor()

    if turno == '2':
        # Consulta o modo de voto para saber as regras do 2º turno
        cur.execute("SELECT modo_voto FROM sp_configurar_urna(%s)", (turma,))
        modo_row = cur.fetchone()
        modo_voto = modo_row[0] if modo_row else 'DISPUTA_DUPLA'

        cur.execute("SELECT * FROM sp_apurar_turma(%s)", (turma,))
        rows = cur.fetchall()

        if not rows:
            cur.close()
            conn.close()
            return jsonify({'error': 'Turma sem candidatos para apuração'}), 404

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
            # UNICO_SEXO: Elegem-se 2.
            # Verificamos empates que impeçam apontar as 2 pessoas
            if len(rows) >= 2:
                votos_1 = rows[0][3]
                cand_votos_1 = [r for r in rows if r[3] == votos_1]
                
                if len(cand_votos_1) > 2:
                    # Ex: 3 pessoas com 5 votos. Empataram brigando por 2 vagas.
                    empatados_ids.extend(r[0] for r in cand_votos_1)
                elif len(cand_votos_1) == 2:
                    # Ex: 2 pessoas no topo exato. Ambas são eleitas. Não tem empate pro 2º turno.
                    pass
                else: 
                    # Apenas 1 no topo. 1ª vaga garantida. 
                    # Disputa do desempate é pela 2ª vaga:
                    votos_2 = rows[1][3]
                    cand_votos_2 = [r for r in rows if r[3] == votos_2]
                    if len(cand_votos_2) > 1:
                        # Ex: B e C com 3 votos cada brigando pela 2ª vaga
                        empatados_ids.extend(r[0] for r in cand_votos_2)

        if not empatados_ids:
            cur.close()
            conn.close()
            return jsonify({'error': 'Não há candidatos empatados para 2º turno nesta turma.'}), 400

        candidatos_ids = empatados_ids
        eleitos_ids = []

        # Define modo de voto e votos por aluno no 2º turno
        if len(sexos_presentes) > 1:
            modo_voto = 'DISPUTA_DUPLA'
            votos_por_aluno = 2
        else:
            modo_voto = 'UNICO_SEXO'
            # No 2º turno, mesmo que só haja candidatos de um único sexo empatados,
            # cada aluno deve escolher apenas UM entre eles.
            votos_por_aluno = 1
    else:
        # Primeiro turno: usa a função de configuração original
        cur.execute("SELECT * FROM sp_configurar_urna(%s)", (turma,))
        row = cur.fetchone()

        if not row:
            cur.close()
            conn.close()
            return jsonify({'error': 'Turma não encontrada ou sem configuração'}), 404

        modo_voto, votos_por_aluno, candidatos_ids, eleitos_ids = row
        candidatos_ids = candidatos_ids or []
        eleitos_ids = eleitos_ids or []

        # Caso especial: turma realmente sem candidatos (ambas listas vazias)
        if modo_voto == 'SEM_VOTACAO' and len(candidatos_ids) == 0 and len(eleitos_ids) == 0:
            cur.close()
            conn.close()
            return jsonify({'error': 'Turma sem candidatos cadastrados'}), 404
    dados_candidatos = []
    dados_eleitos = []

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
                # Sempre envia o número da chapa com 2 dígitos (01, 02, 10...)
                'numero': f"{c[2]:02d}" if isinstance(c[2], int) else str(c[2]),
                'foto': c[3],
                'sexo': c[4]
            })

    if eleitos_ids:
        cur.execute("""
            SELECT id, nome, numero_chapa, caminho_foto, sexo
            FROM candidatos
            WHERE id = ANY(%s)
            ORDER BY numero_chapa ASC
        """, (eleitos_ids,))
        for c in cur.fetchall():
            dados_eleitos.append({
                'id': c[0],
                'nome': c[1],
                'numero': f"{c[2]:02d}" if isinstance(c[2], int) else str(c[2]),
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
        'eleitos_automaticos': dados_eleitos
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)