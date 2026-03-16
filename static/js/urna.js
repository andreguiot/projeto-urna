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
