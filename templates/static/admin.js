/*
Busca os candidatos da turma selecionada e renderiza os cards na tela.
 */
async function carregarLista() {
    const selectTurma = document.getElementById('turma');
    const turma = selectTurma.value;
    
    if (!turma) return;

    const response = await fetch(`/api/candidatos/${turma}`);
    const candidatos = await response.json();
    const container = document.getElementById('lista-candidatos');
    container.innerHTML = ''; 

    if (candidatos.length === 0) {
        container.innerHTML = '<p>Nenhum candidato cadastrado nesta turma.</p>';
        return;
    }

    candidatos.forEach(cand => {
        const item = document.createElement('div');
        item.className = 'candidato-item';
        item.innerHTML = `
            <div>
                <strong>${cand.nome}</strong> 
                <small>(Chapa: ${cand.numero})</small>
            </div>
            <button onclick="deletarCandidato(${cand.id})">Remover</button>
        `;
        container.appendChild(item);
    });
}

/**
 * Remove um candidato através do ID.
 */
async function deletarCandidato(id) {
    if (confirm("Tem certeza que deseja excluir este candidato?")) {
        await fetch(`/api/candidatos/${id}`, { method: 'DELETE' });
        carregarLista();
    }
}

document.getElementById('formCadastro').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const response = await fetch('/api/candidatos', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    alert(result.message);
    
    e.target.reset();
    carregarLista();  
});