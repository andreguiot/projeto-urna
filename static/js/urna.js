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
