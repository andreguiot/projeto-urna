from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
# armazenamento para validação de rota
candidatos_memoria = []

@app.route('/')
def index():
    return render_template('cadastro.html')

@app.route('/api/candidatos', methods=['POST'])
def cadastrar():
    nome = request.form.get('nome')
    turma = request.form.get('turma')
    dados = {'nome': nome, 'turma': turma}
    candidatos_memoria.append(dados)
    return jsonify({"status": "sucesso", "candidato": dados})

if __name__ == '__main__':
    app.run(debug=True)