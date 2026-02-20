class CandidatoService {
    async salvar(formData) {
        const response = await fetch('/api/candidatos', {
            method: 'POST',
            body: formData
        });
        return await response.json();
    }

    async listarPorTurma(turma) {
        const response = await fetch(`/api/candidatos/${turma}`);
        return await response.json();
    }

    async deletar(id) {
        await fetch(`/api/candidatos/${id}`, { method: 'DELETE' });
    }
}

const service = new CandidatoService();
const form = document.getElementById('formCadastro');
const inputFoto = document.getElementById('foto');
const previewContainer = document.getElementById('preview-container');
const previewImg = document.getElementById('preview-img');
const selectTurma = document.getElementById('turma');
const listaContainer = document.getElementById('lista-candidatos');
const feedback = document.getElementById('feedback');

inputFoto.addEventListener('change', function(e) {
    const arquivo = e.target.files[0];
    if (arquivo) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            previewContainer.classList.remove('escondido');
        }
        reader.readAsDataURL(arquivo);
    }
});

form.addEventListener('submit', async function(e) {
    e.preventDefault();
    feedback.textContent = "Salvando...";
    const formData = new FormData(form);

    try {
        const resultado = await service.salvar(formData);
        
        if (resultado.error) {
            throw new Error(resultado.error);
        }

        feedback.className = "feedback-msg sucesso";
        feedback.textContent = "✅ " + resultado.message;
        
        // Limpa form e atualiza lista
        form.reset();
        previewContainer.classList.add('escondido');
        carregarLista();

    } catch (erro) {
        feedback.className = "feedback-msg erro";
        feedback.textContent = "❌ Erro: " + erro.message;
    }
});

// Carregar Lista (READ)
async function carregarLista() {
    const turma = selectTurma.value;
    if (!turma) return;

    listaContainer.innerHTML = '<p>Carregando...</p>';
    
    const candidatos = await service.listarPorTurma(turma);
    
    listaContainer.innerHTML = ''; // Limpa container

    if (candidatos.length === 0) {
        listaContainer.innerHTML = '<p class="aviso-vazio">Nenhum candidato nesta turma.</p>';
        return;
    }

    // Cria os cards
    candidatos.forEach(cand => {
        const card = document.createElement('div');
        card.className = 'candidato-card';
        card.innerHTML = `
            <img src="../static/${cand.foto}" alt="${cand.nome}" class="candidato-foto">
            <div class="candidato-nome">${cand.nome}</div>
            <div class="candidato-numero">Chapa: ${cand.numero}</div>
            <button onclick="deletarCandidato(${cand.id})" class="btn-deletar">Excluir</button>
        `;
        listaContainer.appendChild(card);
    });
}

async function deletarCandidato(id) {
    if (confirm("Tem certeza que deseja excluir este candidato?")) {
        await service.deletar(id);
        carregarLista(); 
    }
}