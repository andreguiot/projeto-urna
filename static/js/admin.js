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

// --- MAPEAMENTO DAS TURMAS ---
const anosPorSegmento = {
    "INF" : ["1º Ano"],
    "EF1": ["2º Ano", "3º Ano", "4º Ano", "5º Ano"],
    "EF2": ["6º Ano", "7º Ano", "8º Ano", "9º Ano"],
    "EM": ["1ª Série", "2ª Série", "3ª Série"]
};

const turmasPorAno = {
    "1º Ano": ["111M", "112M", "113T", "114T", "115T", "116T", "117T"],
    "2º Ano": ["121M", "122M", "123T", "124T", "125T", "126T", "127T"],
    "3º Ano": ["131M", "132M", "133T", "134T", "135T", "136T"],
    "4º Ano": ["141M", "142M", "143T", "144T", "145T", "146T", "147T"],
    "5º Ano": ["151M", "152M", "153M", "154T", "155T", "156T", "157T"],
    "6º Ano": ["161M", "162M", "163M", "164M", "165M", "166M", "167M", "168M"],
    "7º Ano": ["171M", "172M", "173M", "174M", "175M", "176M", "177M"],
    "8º Ano": ["181M", "182M", "183M", "184M", "185M", "186M", "187M"],
    "9º Ano": ["191M", "192M", "193M", "194M", "195M", "196M"],
    "1ª Série": ["211M", "212M", "213M", "214M", "215M", "216M"],
    "2ª Série": ["221M", "222M", "223M", "224M", "225M"],
    "3ª Série": ["231M", "232M", "233M", "234M", "235M"]
};

// Elementos da interface
const form = document.getElementById('formCadastro');
const inputFoto = document.getElementById('foto');
const checkSemFoto = document.getElementById('sem_foto');
const areaUpload = document.getElementById('area-upload');
const previewContainer = document.getElementById('preview-container');
const previewImg = document.getElementById('preview-img');
const selectSegmento = document.getElementById('select-segmento');
const selectAno = document.getElementById('select-ano');
const selectTurma = document.getElementById('turma');
const listaContainer = document.getElementById('lista-candidatos');
const feedback = document.getElementById('feedback');

//checkbox de Sem Foto
checkSemFoto.addEventListener('change', () => {
    if (checkSemFoto.checked) {
        areaUpload.style.opacity = "0.5";
        areaUpload.style.pointerEvents = "none";
        inputFoto.required = false;
        inputFoto.value = "";
        previewContainer.classList.add('escondido');
    } else {
        areaUpload.style.opacity = "1";
        areaUpload.style.pointerEvents = "auto";
        inputFoto.required = true;
    }
});

// Lógica do Filtro em 3 Passos
selectSegmento.addEventListener('change', () => {
    const segmentoSelecionado = selectSegmento.value;
    const anos = anosPorSegmento[segmentoSelecionado] || [];
    selectAno.innerHTML = '<option value="" disabled selected>Selecione o Ano...</option>';
    anos.forEach(ano => { selectAno.innerHTML += `<option value="${ano}">${ano}</option>`; });
    selectAno.disabled = false;
    selectTurma.innerHTML = '<option value="" disabled selected>Aguardando ano...</option>';
    selectTurma.disabled = true;
    listaContainer.innerHTML = '<p class="aviso-vazio">Selecione uma turma para ver os candidatos.</p>';
});

selectAno.addEventListener('change', () => {
    const anoSelecionado = selectAno.value;
    const turmas = turmasPorAno[anoSelecionado] || [];
    selectTurma.innerHTML = '<option value="" disabled selected>Selecione a turma...</option>';
    turmas.forEach(turma => { selectTurma.innerHTML += `<option value="${turma}">${turma}</option>`; });
    selectTurma.disabled = false; 
    listaContainer.innerHTML = '<p class="aviso-vazio">Selecione uma turma para ver os candidatos.</p>';
});

// Prévia da Imagem
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

// Salvar Formulário
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    feedback.textContent = "Salvando...";
    const formData = new FormData(form);

    try {
        const resultado = await service.salvar(formData);
        if (resultado.error) throw new Error(resultado.error);

        feedback.className = "feedback-msg sucesso";
        feedback.textContent = "✅ " + resultado.message;
        
        const backup = { s: selectSegmento.value, a: selectAno.value, t: selectTurma.value };
        form.reset();
        
        selectSegmento.value = backup.s;
        selectAno.value = backup.a;
        selectTurma.value = backup.t;
        
        areaUpload.style.opacity = "1";
        areaUpload.style.pointerEvents = "auto";
        inputFoto.required = true;
        previewContainer.classList.add('escondido');

        carregarLista();
    } catch (erro) {
        feedback.className = "feedback-msg erro";
        feedback.textContent = "❌ Erro: " + erro.message;
    }
});

async function carregarLista() {
    const turma = selectTurma.value;
    if (!turma) return;
    listaContainer.innerHTML = '<p>Carregando...</p>';
    const candidatos = await service.listarPorTurma(turma);
    listaContainer.innerHTML = ''; 

    if (candidatos.length === 0) {
        listaContainer.innerHTML = '<p class="aviso-vazio">Nenhum candidato nesta turma.</p>';
        return;
    }

    candidatos.forEach(cand => {
        const card = document.createElement('div');
        card.className = 'candidato-card';
        // Se não tiver foto, usamos uma imagem padrão do sistema
        const fotoSrc = cand.foto ? `/static/${cand.foto}` : '/static/img/default-user.png';
        
        card.innerHTML = `
            <img src="${fotoSrc}" alt="${cand.nome}" class="candidato-foto">
            <div class="candidato-nome">${cand.nome}</div>
            <div style="font-size: 0.85rem; color: #555; margin-top: 5px;">${cand.sexo}</div>
            <div class="candidato-numero" style="font-weight: bold;">Chapa: ${cand.numero}</div>
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