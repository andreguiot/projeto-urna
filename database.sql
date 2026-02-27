DROP TABLE IF EXISTS candidatos CASCADE;

-- Adicionada coluna is_novo 
CREATE TABLE candidatos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    sexo VARCHAR(20) NOT NULL,
    numero_chapa INTEGER NOT NULL,
    turma VARCHAR(20) NOT NULL,
    caminho_foto VARCHAR(255),
    is_novo BOOLEAN DEFAULT FALSE,
    votos INTEGER DEFAULT 0,
    CONSTRAINT unq_candidato_turma UNIQUE (numero_chapa, turma)
);

-- Procedure atualizada para incluir o novo campo
CREATE OR REPLACE FUNCTION sp_cadastrar_candidato(
    p_nome VARCHAR,
    p_sexo VARCHAR,
    p_turma VARCHAR,
    p_foto_path VARCHAR,
    p_is_novo BOOLEAN
) RETURNS VOID AS $$
DECLARE
    v_proximo_numero INTEGER;
BEGIN
    SELECT COALESCE(MAX(numero_chapa), 0) + 1 INTO v_proximo_numero
    FROM candidatos
    WHERE turma = p_turma;
    
    INSERT INTO candidatos (nome, sexo, numero_chapa, turma, caminho_foto, is_novo)
    VALUES (p_nome, p_sexo, v_proximo_numero, p_turma, p_foto_path, p_is_novo);
END;
$$ LANGUAGE plpgsql;

-- tabela pra guardar os votos, vou precisar disso na urna
CREATE TABLE IF NOT EXISTS votos_turma (
    id SERIAL PRIMARY KEY,
    turma VARCHAR(20) NOT NULL,
    numero_chapa INTEGER,
    tipo_voto VARCHAR(20) NOT NULL,
    data_hora TIMESTAMP DEFAULT NOW()
);

-- função pra apurar os votos de uma turma
CREATE OR REPLACE FUNCTION sp_apurar_turma(
    p_turma VARCHAR
) RETURNS TABLE (
    id_candidato INTEGER,
    nome VARCHAR,
    sexo VARCHAR,
    votos INTEGER,
    classificacao BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.nome,
        c.sexo,
        c.votos,
        DENSE_RANK() OVER (ORDER BY c.votos DESC) AS classificacao
    FROM candidatos c
    WHERE c.turma = p_turma
    ORDER BY c.votos DESC;
END;
$$ LANGUAGE plpgsql;