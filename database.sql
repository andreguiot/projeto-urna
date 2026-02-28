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

-- decide como a urna vai funcionar dependendo dos candidatos da turma
CREATE OR REPLACE FUNCTION sp_configurar_urna(p_turma VARCHAR)
RETURNS TABLE (
    modo_voto TEXT,
    votos_por_aluno INTEGER,
    candidatos_votacao INTEGER[],
    eleitos_automaticos INTEGER[]
) AS $$
DECLARE
    qtd_m INT;
    qtd_f INT;
    total_candidatos INT;
BEGIN
    SELECT COUNT(*) INTO qtd_m FROM candidatos WHERE turma = p_turma AND sexo = 'Masculino';
    SELECT COUNT(*) INTO qtd_f FROM candidatos WHERE turma = p_turma AND sexo = 'Feminino';
    total_candidatos := qtd_m + qtd_f;

    IF total_candidatos = 0 THEN
        RETURN QUERY SELECT 'SEM_VOTACAO'::TEXT, 0, ARRAY[]::INTEGER[], ARRAY[]::INTEGER[];
        RETURN;
    END IF;

    IF qtd_m > 0 AND qtd_f > 0 THEN
        RETURN QUERY
        SELECT
            'DISPUTA_DUPLA'::TEXT,
            2::INTEGER,
            ARRAY_AGG(id)::INTEGER[],
            ARRAY[]::INTEGER[]
        FROM candidatos WHERE turma = p_turma;
        RETURN;
    END IF;

    -- só um sexo com candidatos
    IF (qtd_m > 0 AND qtd_f = 0) OR (qtd_f > 0 AND qtd_m = 0) THEN
        RETURN QUERY
        SELECT
            'UNICO_SEXO'::TEXT,
            LEAST(total_candidatos, 2)::INTEGER,
            ARRAY_AGG(id)::INTEGER[],
            ARRAY[]::INTEGER[]
        FROM candidatos WHERE turma = p_turma;
        RETURN;
    END IF;

END;
$$ LANGUAGE plpgsql;
