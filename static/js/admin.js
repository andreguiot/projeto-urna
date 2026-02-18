const inputFoto = document.getElementById('foto');
const previewImg = document.getElementById('preview-img');
const previewContainer = document.getElementById('preview-container');

/**
  Preview: Lê o arquivo do input e exibe na tela antes do envio.
 */
inputFoto.addEventListener('change', function(e) {
    const arquivo = e.target.files[0];
    if (arquivo) {
        const reader = new FileReader();
        reader.onload = function(event) {
            previewImg.src = event.target.result;
            previewContainer.style.display = 'block';
        }
        reader.readAsDataURL(arquivo);
    }
});

document.getElementById('formCadastro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const response = await fetch('/api/candidatos', {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    if (result.error) {
        alert("Erro: " + result.error);
    } else {
        alert(result.message);
        e.target.reset();
        previewContainer.style.display = 'none';
        carregarLista();
    }
});

async function carregarLista() {
    const turma = document.getElementById('turma').value;
    if (!turma) return;

    const response = await fetch(`/api/candidatos/${turma}`);
    const candidatos = await response.json();
    
    const container = document.getElementById('lista-candidatos');
    container.innerHTML = '';

    candidatos.forEach(cand => {
        const item = document.createElement('div');
        item.className = 'candidato-card';
        item.innerHTML = `
            <img src="/static/${cand.foto}" alt="${cand.nome}" style="width:80px; height:80px; border-radius:50%; object-fit:cover;">
            <p><strong>${cand.nome}</strong></p>
            <button onclick="deletarCandidato(${cand.id})">Excluir</button>
        `;
        container.appendChild(item);
    });
}

async function deletarCandidato(id) {
    if (confirm("Excluir candidato?")) {
        await fetch(`/api/candidatos/${id}`, { method: 'DELETE' });
        carregarLista();
    }
}