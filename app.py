import os
import psycopg2
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
    except UnicodeDecodeError:
        import sys
        print("Erro de conexão detectado (problema de acentuação na mensagem).")
        raise Exception("Erro ao conectar no Postgres. Verifique Porta/Senha/Nome do Banco.")

# --- ROTAS CONTROLLERS ---
@app.route('/')
def index():
    return render_template('cadastro.html')

@app.route('/api/candidatos', methods=['POST'])
def cadastrar_candidato():
    """Recebe o formulário e chama a Procedure SQL"""
    try:
        nome = request.form['nome']
        numero = request.form['numero']
        turma = request.form['turma']
        foto = request.files['foto']

        if foto:
            filename = secure_filename(f"{turma}_{numero}_{foto.filename}")
            caminho_fisico = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            caminho_web = f"uploads/{filename}" 
            
            # 1- Salva o arquivo no disco
            foto.save(caminho_fisico)

            # 2- Chama o PLpgSQL
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT sp_cadastrar_candidato(%s, %s, %s, %s)", 
                        (nome, numero, turma, caminho_web))
            conn.commit()
            cur.close()
            conn.close()

            return jsonify({'message': 'Candidato cadastrado com sucesso!'}), 201
        
        return jsonify({'error': 'Foto é obrigatória'}), 400

    except Exception as e:
        error_msg = str(e).encode('utf-8', errors='replace').decode('utf-8')
        print(f"Erro detalhado no console: {e}")
        return jsonify({'error': error_msg}), 500

@app.route('/api/candidatos/<turma>', methods=['GET'])
def listar_por_turma(turma):
    """Busca candidatos para exibir na tabela (CRUD - Read)"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, nome, numero_chapa, caminho_foto FROM candidatos WHERE turma = %s", (turma,))
    candidatos = cur.fetchall()
    cur.close()
    conn.close()
    
    lista = [{'id': c[0], 'nome': c[1], 'numero': c[2], 'foto': c[3]} for c in candidatos]
    return jsonify(lista)

@app.route('/api/candidatos/<int:id>', methods=['DELETE'])
def deletar_candidato(id):
    """CRUD - Delete"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM candidatos WHERE id = %s", (id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Removido'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)