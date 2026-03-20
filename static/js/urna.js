/**
 * LÓGICA DA URNA - LA SALLE ABEL
 * Versão: 2.0 - Votação Não Linear (Liberdade de Escolha)
 */

// Configuração da urna será carregada do backend
let configUrna = null;
// Fase atual da urna: primeiro escolhe turma, depois vota
let faseUrna = 'turma'; // 'turma' ou 'votacao'
let ultimaTurmaCarregada = null;
let turnoAtual = 1; // 1º turno por padrão

// Estado da Votação
let totalVotosNecessarios = 0;
let votosRealizados = [];
let generosJaVotados = [];
let idsJaVotados = [];

let numeroDigitado = "";
let ehBranco = false;

// Fila de votos offline usando localStorage
const CHAVE_FILA = 'filaVotosUrna';

function carregarFila() {
    try {
        const valor = localStorage.getItem(CHAVE_FILA);
        if (!valor) return [];
        return JSON.parse(valor);
    } catch (e) {
        return [];
    }
}

function salvarFila(fila) {
    localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
}

function adicionarVotoNaFila(voto) {
    const fila = carregarFila();
    fila.push(voto);
    salvarFila(fila);
}

async function registrarVoto(voto) {
    if (!configUrna) {
        return;
    }
    // Tenta mandar direto pro servidor primeiro
    if (navigator.onLine) {
        try {
            const body = {
                turma: configUrna.turma,
                votos: [voto]
            };

            const resp = await fetch('/api/votos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (resp.ok) {
                return;
            }
            // Se o servidor responder erro, cai para fila offline
        } catch (e) {
            // Se der erro de rede, cai para fila offline
        }
    }

    // Se não estiver online ou deu erro, guarda para depois
    adicionarVotoNaFila(voto);
}

async function sincronizarVotos() {
    if (!configUrna) return;

    const fila = carregarFila();
    if (fila.length === 0) return;

    if (!navigator.onLine) {
        return;
    }

    try {
        const body = {
            turma: configUrna.turma,
            votos: fila
        };

        const resp = await fetch('/api/votos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (resp.ok) {
            salvarFila([]);
        }
    } catch (e) {
        // Se der erro, mantém a fila para tentar de novo depois
    }
}

window.addEventListener('online', () => {
    sincronizarVotos();
});

// Controle do botão POWER (mesário)
let ultimoCliquePower = 0;

function mostrarJanelaPower() {
    const janela = document.getElementById('janela-power');
    if (janela) {
        janela.classList.add('ativa');
    }
}

function esconderJanelaPower() {
    const janela = document.getElementById('janela-power');
    if (janela) {
        janela.classList.remove('ativa');
    }
}

function inicializarPower() {
    const btnPower = document.getElementById('btn-power');
    const btnCancelar = document.getElementById('btn-power-cancelar');
    const btnConfirmar = document.getElementById('btn-power-confirmar');

    if (btnPower) {
        btnPower.addEventListener('click', () => {
            // Só funciona quando já estiver na fase de votação
            if (faseUrna !== 'votacao') return;

            const agora = Date.now();
            if (agora - ultimoCliquePower < 600) {
                // Dois cliques em menos de 600ms
                mostrarJanelaPower();
            }
            ultimoCliquePower = agora;
        });
    }

    if (btnCancelar) {
        btnCancelar.addEventListener('click', esconderJanelaPower);
    }

    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', () => {
            esconderJanelaPower();
            // Volta para a seleção de turma, limpando a configuração atual
            configUrna = null;
            prepararSelecaoTurma();
        });
    }
}

function inicializarControleTurno() {
    const btn1 = document.getElementById('btn-turno-1');
    const btn2 = document.getElementById('btn-turno-2');
    const barraTurno = document.getElementById('controle-turno');

    if (!btn1 || !btn2 || !barraTurno) return;

    const atualizarVisibilidade = () => {
        // Só mostra os botões quando estamos na tela de Seleção de Turma
        barraTurno.style.display = (faseUrna === 'turma') ? 'flex' : 'none';
    };

    const atualizarVisual = () => {
        btn1.classList.toggle('ativo', turnoAtual === 1);
        btn2.classList.toggle('ativo', turnoAtual === 2);
        atualizarVisibilidade();
    };

    btn1.addEventListener('click', () => {
        if (faseUrna !== 'turma') return;
        turnoAtual = 1;
        atualizarVisual();
    });

    btn2.addEventListener('click', () => {
        if (faseUrna !== 'turma') return;
        turnoAtual = 2;
        atualizarVisual();
    });

    atualizarVisual();
}

// Sistema de Áudio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function bip(tipo = 'curto') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = tipo === 'longo' ? 400 : 880;
    osc.connect(gain); 
    gain.connect(audioCtx.destination);
    osc.start();
    setTimeout(() => osc.stop(), tipo === 'longo' ? 800 : 100);
}

// Som real de confirmação (arquivo MP3 em static/sounds/confirma.mp3)
const somConfirmacao = new Audio('/static/sounds/confirma.mp3');
somConfirmacao.volume = 0.9;

function tocarSomConfirmacao() {
    try {
        somConfirmacao.currentTime = 0;
        somConfirmacao.play();
    } catch (e) {
        // Se o navegador bloquear o áudio, só ignora
    }
}

/**
 * INICIALIZAÇÃO
 * Define quantas vagas existem com base no modo de voto vindo do Banco.
 */
function prepararUrna() {
    if (!configUrna) return;

    const modo = configUrna.modo_voto;

    // Regras de negócio da coordenação:
    // - DISPUTA_DUPLA: sempre 2 votos (um menino e uma menina)
    // - UNICO_SEXO: o banco já manda se é 1 ou 2 votos por aluno
    if (modo === "DISPUTA_DUPLA") {
        totalVotosNecessarios = 2;
    } else if (modo === "UNICO_SEXO") {
        totalVotosNecessarios = configUrna.votos_por_aluno || 2;
    } else {
        // Aqui teoricamente não cai, porque quando não tem candidatos
        // o backend nem deixa a urna abrir.
        totalVotosNecessarios = 0;
    }

    if (totalVotosNecessarios === 0) {
        exibirFimImediato();
    } else {
        reiniciarCicloVoto();
    }

    // Entramos na fase de votação, portanto a barra de turno deve sumir
    const barraTurno = document.getElementById('controle-turno');
    if (barraTurno) {
        barraTurno.style.display = 'none';
    }
}

/**
 * PREPARA A TELA PARA O PRÓXIMO VOTO
 */
function reiniciarCicloVoto() {
    numeroDigitado = "";
    ehBranco = false;

    // Título neutro: não define ordem de sexo nem "1º/2º" voto.
    // A regra de "um menino e uma menina" (no caso de DISPUTA_DUPLA)
    // é garantida apenas pela validação em buscarCandidato/confirmar.
    const titulo = "Representante";

    document.getElementById('cargo-nome').innerText = titulo;
    document.getElementById('dados-candidato').innerHTML = "";
    document.getElementById('foto-moldura').style.display = "none";
    document.getElementById('instrucoes').style.display = "none";

    // Sempre 2 dígitos para chapa
    let htmlCaixas = `<div class="caixa-num pisca" id="dig-0"></div><div class="caixa-num" id="dig-1"></div>`;
    document.getElementById('display-numeros').innerHTML = htmlCaixas;
}

/**
 * TECLADO
 */
function clicou(n) {
    // Seleção de turma (3 dígitos) usa o mesmo teclado
    if (faseUrna === 'turma') {
        if (numeroDigitado.length < 3) {
            bip();
            const caixa = document.getElementById(`dig-${numeroDigitado.length}`);
            if (caixa) {
                caixa.innerText = n;
                caixa.classList.remove('pisca');
            }
            numeroDigitado += n;

            const prox = document.getElementById(`dig-${numeroDigitado.length}`);
            if (prox) prox.classList.add('pisca');

            if (numeroDigitado.length === 3) {
                document.getElementById('instrucoes').style.display = "block";
                document.getElementById('dados-candidato').innerHTML = `
                    <div class="info-turma">
                        Turma selecionada: <b>${numeroDigitado}M</b><br>
                        Aperte <b>CONFIRMA</b> para carregar ou <b>CORRIGE</b> para alterar.
                    </div>
                `;
            }
        }
        return;
    }

    if (numeroDigitado.length < 2 && !ehBranco) {
        bip();
        const caixa = document.getElementById(`dig-${numeroDigitado.length}`);
        caixa.innerText = n;
        caixa.classList.remove('pisca');
        numeroDigitado += n;

        const prox = document.getElementById(`dig-${numeroDigitado.length}`);
        if (prox) prox.classList.add('pisca');

        if (numeroDigitado.length === 2) {
            buscarCandidato();
        }
    }
}

/**
 * BUSCA INDEPENDENTE DE SEXO
 */
function buscarCandidato() {
    const modo = configUrna.modo_voto;
    const candidato = configUrna.candidatos.find(c => c.numero === numeroDigitado);
    
    document.getElementById('instrucoes').style.display = "block";

    if (!candidato) {
        document.getElementById('dados-candidato').innerHTML = `
            <div class="info-destaque">
                NÚMERO ERRADO / VOTO NULO
            </div>
        `;
        return;
    }

    // Validação de Regra: Se for Disputa Dupla, não pode votar no mesmo sexo duas vezes
    if (modo === "DISPUTA_DUPLA" && generosJaVotados.includes(candidato.sexo)) {
        document.getElementById('dados-candidato').innerHTML = `
            <div class="mensagem-aviso">
                <span class="titulo-aviso">Atenção:</span>
                Você já votou em um representante ${candidato.sexo}.<br>
                <b>ESCOLHA O OUTRO SEXO OU CORRIGE.</b>
            </div>
        `;
        return;
    }

    // Validação de Regra: Não pode votar no mesmo ID duas vezes (Único Sexo)
    if (idsJaVotados.includes(candidato.id)) {
        document.getElementById('dados-candidato').innerHTML = `
            <div class="mensagem-aviso">
                <span class="titulo-aviso">Atenção:</span>
                Você já votou neste candidato.<br>
                <b>ESCOLHA OUTRO OU CORRIGE.</b>
            </div>
        `;
        return;
    }

    // Se passou nas validações, exibe
    document.getElementById('dados-candidato').innerHTML = `
        <div class="info-candidato">
            Nome: <b>${candidato.nome}</b><br>
            Sexo: ${candidato.sexo}
        </div>
    `;
    // Ajusta o caminho da foto para apontar para /static/uploads
    let fotoSrc = '';
    if (candidato.foto) {
        if (candidato.foto.startsWith('http')) {
            fotoSrc = candidato.foto;
        } else if (candidato.foto.startsWith('/static/')) {
            fotoSrc = candidato.foto;
        } else {
            fotoSrc = '/static/' + candidato.foto.replace(/^\/+/, '');
        }
    } else {
        fotoSrc = '/static/images/default-user.png';
    }
    document.getElementById('img-candidato').src = fotoSrc;
    document.getElementById('foto-moldura').style.display = "block";
}

function branco() {
    if (faseUrna === 'turma') return;
    if (numeroDigitado === "") {
        bip();
        ehBranco = true;
        document.getElementById('display-numeros').innerHTML = "";
        document.getElementById('dados-candidato').innerHTML = `
            <div class="info-destaque">
                VOTO EM BRANCO
            </div>
        `;
        document.getElementById('instrucoes').style.display = "block";
    }
}

function corrigir() {
    bip();
    if (faseUrna === 'turma') {
        prepararSelecaoTurma();
    } else {
        reiniciarCicloVoto();
    }
}
