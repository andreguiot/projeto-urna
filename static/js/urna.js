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

async function confirmar() {
    // Primeiro fluxo: seleção de turma
    if (faseUrna === 'turma') {
        if (numeroDigitado.length !== 3) return;

        const base = numeroDigitado;
        const turmasParaTentar = [`${base}M`, `${base}T`];
        let dados = null;
        const turno = turnoAtual || 1;

        document.getElementById('dados-candidato').innerHTML = `
            <div class="info-status">
                Carregando urna da turma...
            </div>
        `;
        document.getElementById('instrucoes').style.display = "none";

        let mensagemErro = null;

        for (const turma of turmasParaTentar) {
            try {
                const resp = await fetch(`/api/urna/${turma}?turno=${turno}`);
                if (resp.ok) {
                    dados = await resp.json();
                    break;
                } else {
                    const body = await resp.json().catch(() => ({}));
                    mensagemErro = body.error || mensagemErro;
                }
            } catch (e) {
                // ignora e tenta a próxima combinação
            }
        }

        if (!dados) {
            // Mensagem mais clara para 2º turno sem empatados
            if (turno === 2 && mensagemErro) {
                document.getElementById('dados-candidato').innerHTML = `
                    <div class="info-erro">
                        ${mensagemErro}<br>
                        <span style="color:black">
                            Use <b>CORRIGE</b> para alterar a turma ou volte para o 1º turno.
                        </span>
                    </div>
                `;
            } else {
                document.getElementById('dados-candidato').innerHTML = `
                    <div class="info-erro">
                        Turma não encontrada ou sem candidatos.<br>
                        <span style="color:black">
                            Use <b>CORRIGE</b> para tentar outra turma.
                        </span>
                    </div>
                `;
            }
            return;
        }

        // TODO: verificar votos existentes e oferecer PDF (próximo commit)
        const turmaCarregada = dados.turma;

        // Se já estivermos retornando para a mesma turma e houver votos,
        // oferecemos a opção de gerar o PDF estatístico antes de seguir.
        try {
            const respApuracao = await fetch(`/api/apuracao/${turmaCarregada}`);
            if (respApuracao.ok) {
                const estat = await respApuracao.json();
                const totalVotos = (estat.votos_validos || 0) +
                    (estat.votos_brancos || 0) +
                    (estat.votos_nulos || 0);

                if (totalVotos > 0 && ultimaTurmaCarregada === turmaCarregada) {
                    const desejaPdf = window.confirm(
                        `Já existem votos registrados para a turma ${turmaCarregada}.\n\n` +
                        `Deseja gerar o PDF estatístico desta turma agora?\n\n` +
                        `OK = Gerar PDF e continuar votação\n` +
                        `Cancelar = Apenas continuar votação`
                    );
                    if (desejaPdf) {
                        window.open(`/api/estatistica_pdf/${turmaCarregada}`, '_blank');
                    }
                }
            }
        } catch (e) {
            // Se der erro ao consultar apuração, apenas segue fluxo normal
        }

        configUrna = {
            turma: turmaCarregada,
            modo_voto: dados.modo_voto,
            votos_por_aluno: dados.votos_por_aluno,
            candidatos: dados.candidatos_votacao || []
        };

        ultimaTurmaCarregada = turmaCarregada;

        salvarFila([]);
        faseUrna = 'votacao';
        prepararUrna();
        return;
    }

    if (!configUrna) return;

    const modo = configUrna.modo_voto;
    const candidato = configUrna.candidatos.find(c => c.numero === numeroDigitado);

    // Validação final antes de confirmar
    if (numeroDigitado.length === 2 || ehBranco) {
        // Define o tipo de voto
        let tipoVoto = 'NULO';
        let numeroChapa = null;

        if (ehBranco) {
            tipoVoto = 'BRANCO';
        } else if (candidato) {
            tipoVoto = 'VALIDO';
            numeroChapa = parseInt(candidato.numero, 10);
        }

        if (!ehBranco && candidato) {
            // Impede confirmar se violar a regra de sexo/duplicidade
            if (modo === "DISPUTA_DUPLA" && generosJaVotados.includes(candidato.sexo)) return;
            if (idsJaVotados.includes(candidato.id)) return;

            // Registra dados do candidato escolhido
            generosJaVotados.push(candidato.sexo);
            idsJaVotados.push(candidato.id);
        }

        // Monta o objeto de voto para enviar / enfileirar
        const voto = {
            numero: numeroChapa,
            tipo: tipoVoto,
            data: new Date().toISOString()
        };

        // Tenta registrar imediatamente; se der erro ou estiver offline, ele guarda na fila
        registrarVoto(voto);

        votosRealizados.push(ehBranco ? "BRANCO" : numeroDigitado);

        if (votosRealizados.length < totalVotosNecessarios) {
            reiniciarCicloVoto();
        } else {
            finalizar();
        }

        // Sempre tenta sincronizar a fila (caso tenha votos antigos)
        sincronizarVotos();
    }
}

function finalizar() {
    // Som oficial de confirmação + bip longo juntos com o "VOTO CONFIRMADO"
    tocarSomConfirmacao();
    bip('longo');
    
    // Esconde a interface de voto e mostra o FIM
    document.getElementById('interface-voto').style.display = "none";
    document.getElementById('interface-fim').style.display = "flex";
    
    // Aguarda 4 segundos antes de liberar para o próximo eleitor
    setTimeout(() => {
        // Limpa os estados de controle do eleitor anterior
        votosRealizados = [];
        generosJaVotados = [];
        idsJaVotados = [];
        
        // Volta para a interface de voto
        // Removemos o inline style para que ele puxe a config 'flex' diretamente do urna.css
        document.getElementById('interface-voto').style.display = "";
        document.getElementById('interface-fim').style.display = "none";
        
        // Prepara a tela (títulos, caixas de números vazias, etc)
        prepararUrna();
    }, 4000);
}

// Prepara a tela para a seleção de turma usando a própria urna
function prepararSelecaoTurma() {
    faseUrna = 'turma';
    numeroDigitado = "";
    ehBranco = false;
    votosRealizados = [];
    generosJaVotados = [];
    idsJaVotados = [];

    document.getElementById('cargo-nome').innerText = "Seleção de Turma";
    document.getElementById('header-voto')?.innerText;
    document.getElementById('dados-candidato').innerHTML = `
        <div class="info-turma">
            Digite os 3 dígitos da turma e aperte <b>CONFIRMA</b>.
        </div>
    `;
    document.getElementById('foto-moldura').style.display = "none";
    document.getElementById('instrucoes').style.display = "none";

    // 3 caixas para turma
    let htmlCaixas = `
        <div class="caixa-num pisca" id="dig-0"></div>
        <div class="caixa-num" id="dig-1"></div>
        <div class="caixa-num" id="dig-2"></div>
    `;
    document.getElementById('display-numeros').innerHTML = htmlCaixas;
    
    // Ao voltar para seleção de turma, exibe novamente o controle de turno
    const barraTurno = document.getElementById('controle-turno');
    if (barraTurno) {
        barraTurno.style.display = 'flex';
    }
};

window.onload = () => {
    prepararSelecaoTurma();
    inicializarPower();
    inicializarControleTurno();
};
