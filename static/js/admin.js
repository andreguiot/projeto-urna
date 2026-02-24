class CandidatoService {
    async salvar(formData) {
        const response = await fetch('/api/candidatos', { method: 'POST', body: formData });
        return await response.json();
    }
    async listarPorTurma(turma) {
        const response = await fetch(`/api/candidatos/${turma}`);
        return await response.json();
    }
    async deletar(id) {
        await fetch(`/api/candidatos/${id}`, { method: 'DELETE' });
    }
    async atualizarFoto(id, arquivo) {
        const formData = new FormData();
        formData.append('foto', arquivo);
        const response = await fetch(`/api/candidatos/${id}/foto`, { method: 'PATCH', body: formData });
        return await response.json();
    }
}

const service = new CandidatoService();

// Mapeamentos
const anosPorSegmento = {
    "INF": ["1º Ano"],
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

// Elementos DOM
const form = document.getElementById('formCadastro');
const inputFoto = document.getElementById('foto');
const checkSemFoto = document.getElementById('sem_foto');
const checkIsNovo = document.getElementById('is_novo');
const areaUpload = document.getElementById('area-upload');
const previewContainer = document.getElementById('preview-container');
const previewImg = document.getElementById('preview-img');
const selectSegmento = document.getElementById('select-segmento');
const selectAno = document.getElementById('select-ano');
const selectTurma = document.getElementById('turma');
const listaContainer = document.getElementById('lista-candidatos');
const feedback = document.getElementById('feedback');
const inputUploadRapido = document.getElementById('input-upload-rapido');

let idSendoEditado = null;

checkSemFoto.addEventListener('change', () => {
    if (checkSemFoto.checked) {
        areaUpload.classList.add('desabilitado');
        inputFoto.required = false;
        inputFoto.value = "";
        previewContainer.classList.add('escondido');
    } else {
        areaUpload.classList.remove('desabilitado');
        inputFoto.required = true;
    }
});

selectSegmento.addEventListener('change', () => {
    const anos = anosPorSegmento[selectSegmento.value] || [];
    selectAno.innerHTML = '<option value="" disabled selected>Selecione o Ano...</option>';
    anos.forEach(ano => selectAno.innerHTML += `<option value="${ano}">${ano}</option>`);
    selectAno.disabled = false;
    selectTurma.disabled = true;
});

selectAno.addEventListener('change', () => {
    const turmas = turmasPorAno[selectAno.value] || [];
    selectTurma.innerHTML = '<option value="" disabled selected>Selecione a turma...</option>';
    turmas.forEach(t => selectTurma.innerHTML += `<option value="${t}">${t}</option>`);
    selectTurma.disabled = false; 
});

inputFoto.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewContainer.classList.remove('escondido');
        };
        reader.readAsDataURL(file);
    }
});

// Salvar Candidato
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.textContent = "Processando...";
    const formData = new FormData(form);
    formData.set('is_novo', checkIsNovo.checked);

    try {
        const res = await service.salvar(formData);
        if (res.error) throw new Error(res.error);

        feedback.className = "feedback-msg sucesso";
        feedback.textContent = "✅ Salvo com sucesso!";
        
        const bkp = { s: selectSegmento.value, a: selectAno.value, t: selectTurma.value };
        form.reset();
        selectSegmento.value = bkp.s; selectAno.value = bkp.a; selectTurma.value = bkp.t;
        areaUpload.classList.remove('desabilitado');
        previewContainer.classList.add('escondido');
        carregarLista();
    } catch (err) {
        feedback.className = "feedback-msg erro";
        feedback.textContent = "❌ " + err.message;
    }
});

async function carregarLista() {
    const turma = selectTurma.value;
    if (!turma) return;

    listaContainer.innerHTML = '<p>Buscando...</p>';
    const candidatos = await service.listarPorTurma(turma);
    listaContainer.innerHTML = ''; 
    if (candidatos.length === 0) {
        listaContainer.innerHTML = '<p class="aviso-vazio">Nenhum candidato.</p>';
        return;
    }

    candidatos.forEach(cand => {
        const card = document.createElement('div');
        card.className = `candidato-card ${cand.is_novo ? 'card-novo' : ''}`;
        const fotoSrc = cand.foto ? `/static/${cand.foto}` : '/static/images/default-user.png';
        card.innerHTML = `
            ${cand.is_novo ? '<span class="badge-novo">NOVO</span>' : ''}
            <img src="${fotoSrc}" alt="Foto" class="candidato-foto">
            <div class="candidato-nome">${cand.nome}</div>
            <div class="candidato-info">${cand.sexo} | Chapa ${cand.numero}</div>
            <div class="acoes-card">
                ${(cand.is_novo && !cand.foto) ? 
                    `<button onclick="abrirUploadRapido(${cand.id})" class="btn-adicionar">Adicionar Foto</button>` : ''}
                <button onclick="deletarCandidato(${cand.id})" class="btn-deletar">Excluir</button>
            </div>
        `;
        listaContainer.appendChild(card);
    });
}

function abrirUploadRapido(id) {
    idSendoEditado = id;
    inputUploadRapido.click();
}

inputUploadRapido.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && idSendoEditado) {
        const res = await service.atualizarFoto(idSendoEditado, file);
        if (res.message) carregarLista();
        idSendoEditado = null;
        inputUploadRapido.value = "";
    }
});

async function deletarCandidato(id) {
    if (confirm("Confirmar exclusão?")) {
        await service.deletar(id);
        carregarLista(); 
    }
}