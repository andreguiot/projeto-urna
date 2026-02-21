DROP TABLE IF EXISTS candidatos CASCADE;

-- Nova coluna sexo e numero chapa auto-increment
CREATE TABLE candidatos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    sexo VARCHAR(20) NOT NULL,     
    numero_chapa INTEGER NOT NULL,
    turma VARCHAR(20) NOT NULL,
    caminho_foto VARCHAR(255),
    votos INTEGER DEFAULT 0,
    CONSTRAINT unq_candidato_turma UNIQUE (numero_chapa, turma)
);

-- Procedure com Auto-Incremento por turma
CREATE OR REPLACE FUNCTION sp_cadastrar_candidato(
    p_nome VARCHAR,
    p_sexo VARCHAR,
    p_turma VARCHAR,
    p_foto_path VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_proximo_numero INTEGER;
BEGIN
    SELECT COALESCE(MAX(numero_chapa), 0) + 1 INTO v_proximo_numero
    FROM candidatos
    WHERE turma = p_turma;
    INSERT INTO candidatos (nome, sexo, numero_chapa, turma, caminho_foto)
    VALUES (p_nome, p_sexo, v_proximo_numero, p_turma, p_foto_path);
END;
$$ LANGUAGE plpgsql;

select * from candidatos;