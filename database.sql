-- Tabela para armazenar os candidatos
CREATE TABLE IF NOT EXISTS candidatos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    numero_chapa VARCHAR(10) NOT NULL,
    turma VARCHAR(10) NOT NULL,
    caminho_foto VARCHAR(255),
    votos INTEGER DEFAULT 0,
    CONSTRAINT unq_candidato_turma UNIQUE (numero_chapa, turma)
);

-- Garante a regra de negócio de uma inserção segura
CREATE OR REPLACE FUNCTION sp_cadastrar_candidato(
    p_nome VARCHAR,
    p_numero VARCHAR,
    p_turma VARCHAR,
    p_foto_path VARCHAR
) RETURNS VOID AS $$
BEGIN
    INSERT INTO candidatos (nome, numero_chapa, turma, caminho_foto)
    VALUES (p_nome, p_numero, p_turma, p_foto_path);
END;
$$ LANGUAGE plpgsql;

select * from candidatos