import psycopg2
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
DB_CONFIG = {
    'dbname': 'urna_db',
    'user': 'postgres',
    'password': 'root',
    'host': 'localhost',
    'port': '5433' 
}

def get_db_connection():
    """Estabelece a conexão com o banco de dados PostgreSQL."""
    return psycopg2.connect(**DB_CONFIG)

@app.route('/')
def index():
    """Renderiza a página principal"""
    return render_template('cadastro.html')

@app.route('/api/candidatos', methods=['POST'])
def cadastrar():
    """Realiza a persistência inicial no banco de dados."""
    try:
        nome = request.form.get('nome')
        turma = request.form.get('turma')
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO candidatos (nome, turma, numero_chapa) VALUES (%s, %s, %s)", 
                   (nome, turma, '0000'))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "Candidato registrado no PostgreSQL!"})
    except Exception as e:
        return jsonify({"error": f"Erro de infraestrutura: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)