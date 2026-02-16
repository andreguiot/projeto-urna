-- Estrutura inicial do BD
CREATE TABLE IF NOT EXISTS candidatos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    numero_chapa VARCHAR(10) NOT NULL,
    turma VARCHAR(10) NOT NULL,
    caminho_foto VARCHAR(255),
    votos INTEGER DEFAULT 0
);