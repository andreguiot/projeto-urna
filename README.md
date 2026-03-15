# 🗳️ Sistema de Urna Eletrônica Escolar

Este é um projeto completo de Urna Eletrônica desenvolvido para gestão e realização de eleições escolares. O sistema conta com um painel administrativo para cadastro de candidatos e uma interface de urna realista com suporte a diferentes modos de votação, apuração em tempo real e geração de relatórios estatísticos em PDF.

## 🚀 Funcionalidades

### 📋 Painel de Gestão (Coordenação)
- **Cadastro de Candidatos**: Registro completo com nome, sexo, turma, segmento e foto.
- **Preview de Imagem**: Visualização prévia da foto do candidato antes do salvamento.
- **Edição Dinâmica**: Possibilidade de atualizar fotos e remover candidatos cadastrados.
- **Filtragem por Turma**: Visualização organizada dos candidatos de cada grupo escolar.

### 🗳️ Urna Eletrônica
- **Modos de Votação Inteligentes**: 
    - **Disputa Dupla**: O aluno vota obrigatoriamente em um candidato de cada sexo.
    - **Único Sexo**: Votação em candidatos do mesmo grupo (ex: apenas meninas ou apenas meninos).
- **Interface Realista**: Botões de BRANCO, NULO e CONFIRMAR com feedback visual.
- **Efeitos Sonoros**: Sons de confirmação e erro para emular a experiência de uma urna real.
- **Suporte a 2º Turno**: Lógica automática para filtrar apenas candidatos empatados no topo.

### 📊 Apuração e Relatórios
- **Ranking em Tempo Real**: Classificação feita diretamente via Banco de Dados (PostgreSQL).
- **Contagem Separada**: Distinção clara entre votos válidos, brancos e nulos.
- **Relatório PDF**: Geração de documento oficial contendo:
    - Resumo dos eleitos.
    - Ranking geral da turma.
    - Lista completa e auditável de todos os votos (ID, número, tipo e timestamp).

## 🛠️ Tecnologias Utilizadas

- **Backend**: Python + Flask
- **Banco de Dados**: PostgreSQL (utilizando PL/pgSQL para lógica de apuração)
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (Vanilla)
- **Relatórios**: ReportLab (Python)
- **Comunicação**: Fetch API / JSON

## 📂 Estrutura do Projeto

```text
├── app.py              # Servidor Flask e rotas da API
├── database.sql        # Scripts de criação de tabelas e procedures SQL
├── static/
│   ├── css/            # Estilos da interface (Cadastro e Urna)
│   ├── js/             # Lógica de frontend e integração com API
│   ├── sounds/         # Efeitos sonoros da urna
│   └── uploads/        # Armazenamento das fotos dos candidatos
└── templates/
    ├── cadastro.html   # Interface administrativa
    └── urna.html       # Interface de votação
```

## ⚙️ Como Executar

### Pré-requisitos
- Python 3.x instalado.
- PostgreSQL rodando localmente.
- Bibliotecas Python: `flask`, `psycopg2`, `reportlab`.

### Passo a Passo
1. **Configurar o Banco**: Execute o script `database.sql` no seu PostgreSQL para criar a estrutura necessária.
2. **Dependências**:
   ```bash
   pip install flask psycopg2 reportlab
   ```
3. **Configuração**: Ajuste as credenciais do banco no dicionário `DB_CONFIG` dentro do arquivo `app.py`.
4. **Execução**:
   ```bash
   python app.py
   ```
5. **Acesso**: 
   - Painel: `http://localhost:5000/`
   - Urna: `http://localhost:5000/urna`

---
*Desenvolvido como projeto de automação escolar e estudos de lógica de programação.*
