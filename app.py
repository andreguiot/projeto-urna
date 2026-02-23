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

@app.route('/api/candidatos', methods=['POST'])
def cadastrar_candidato():
    """Recebe o formulário e salva o candidato (foto opcional)"""
    try:
        nome = request.form['nome']
        sexo = request.form['sexo'] 
        turma = request.form['turma']
        sem_foto = 'sem_foto' in request.form
        
        foto = request.files.get('foto')
        caminho_web = None

        # Só processa a foto se o checkbox não estiver marcado e o arquivo existir
        if not sem_foto and foto and foto.filename != '':
            codigo_unico = uuid.uuid4().hex[:6]
            filename = secure_filename(f"{turma}_{sexo[:1]}_{codigo_unico}_{foto.filename}")
            caminho_fisico = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            caminho_web = f"uploads/{filename}" 
            foto.save(caminho_fisico)

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT sp_cadastrar_candidato(%s, %s, %s, %s)", 
                    (nome, sexo, turma, caminho_web))
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
    cur.execute("SELECT id, nome, numero_chapa, caminho_foto, sexo FROM candidatos WHERE turma = %s ORDER BY numero_chapa ASC", (turma,))
    candidatos = cur.fetchall()
    cur.close()
    conn.close()
    
    lista = [{'id': c[0], 'nome': c[1], 'numero': c[2], 'foto': c[3], 'sexo': c[4]} for c in candidatos]
    return jsonify(lista)

@app.route('/api/candidatos/<int:id>', methods=['DELETE'])
def deletar_candidato(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM candidatos WHERE id = %s", (id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Removido'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)