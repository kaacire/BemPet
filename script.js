const CONFIG = {
  nomeNegocio: "Clínica Veterinária BemPet",
  nomeAssistente: "Assistente BemPet",
  whatsapp: "5511999999999", 
  telefone: "5511999999999", 
  limiteMensagens: 18,
  servicos: [
    { nome: "Consulta veterinária", preco: null },
    { nome: "Retorno", preco: null }
  ],
  cores: { verde: "#173f35", amarelo: "#f0c96e", vermelho: "#b53a32" }
};

const PERGUNTAS = [
  { chave: "especie", texto: "Pra começar, qual é a espécie do seu companheiro?", opcoes: ["Cachorro", "Gato", "Ave", "Outro"] },
  { chave: "idade", texto: "E qual é a idade aproximada dele?", opcoes: ["Filhote (até 1 ano)", "Adulto (1 a 7 anos)", "Idoso (mais de 7 anos)", "Não sei ao certo"] },
  { chave: "sintomas", texto: "O que você percebeu? Pode escolher a opção mais próxima ou escrever com suas palavras.", opcoes: ["Vômito ou diarreia", "Não quer comer", "Coceira ou desconforto", "Está diferente / abatido", "Outro sintoma"] },
  { chave: "duracao", texto: "Há quanto tempo isso está acontecendo?", opcoes: ["Começou agora", "Há algumas horas", "Desde ontem", "Há vários dias"] },
  { chave: "comendoBebendo", texto: "Ele está comendo e bebendo água normalmente?", opcoes: ["Sim, os dois", "Come, mas bebe pouco", "Bebe, mas não come", "Não come nem bebe", "Não consegui observar"] },
  { chave: "alertas", texto: "Você percebe algum destes sinais de alerta?", opcoes: ["Nenhum desses sinais", "Dificuldade para respirar", "Convulsão ou desmaio", "Sangramento forte", "Pode ter ingerido veneno", "Acidente ou trauma", "Barriga inchada / dor intensa", "Outro sinal preocupante"] }
];

const ALERTAS_VERMELHOS = [
  "convuls", "desmai", "envenen", "veneno", "intoxica", "veneno", "sangramento forte",
  "sangra muito", "dificuldade para respirar", "não consegue respirar", "sem respirar",
  "falta de ar", "respira com dificuldade", "atropel", "queda grave", "trauma", "acidente",
  "barriga inchada", "abdômen inchado", "abdomen inchado", "dor intensa", "não consegue urinar",
  "gengiva azul", "gengiva branca", "inconsciente", "engoliu remédio", "picada de cobra",
  "hemorragia", "engasg"
];
const SINTOMAS_AMARELOS = [
  "vômit", "vomit", "diarre", "não quer comer", "não come", "sem apetite", "abatido",
  "coceira", "dor", "manc", "febre", "sangue nas fezes", "bebendo pouco", "há vários dias",
  "desde ontem", "não come nem bebe", "bebe, mas não come", "piora", "prostr"
];

const state = {
  respostas: {},
  etapa: 0,
  mensagens: 0,
  encerrado: false,
  urgencia: null,
  demoAtiva: false
};

const el = (id) => document.getElementById(id);
const chatMessages = el("chatMessages");
const quickReplies = el("quickReplies");
const textForm = el("textForm");
const freeText = el("freeText");
const resultPanel = el("resultPanel");
const chatControls = el("chatControls");
const urgentBanner = el("urgentBanner");
const bookingDialog = el("bookingDialog");
const bookingForm = el("bookingForm");

function normalizar(texto) {
  return String(texto || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function contemPalavra(texto, lista) {
  const normalizado = normalizar(texto);
  return lista.some((termo) => normalizado.includes(normalizar(termo)));
}

/**
 * Classifica apenas a prioridade sugerida, nunca uma doença.
 * Emergências declaradas sempre prevalecem sobre outros sinais.
 */
function classificarUrgencia(respostas) {
  const textoGeral = Object.values(respostas).flat().join(" ");
  const alertas = normalizar(respostas.alertas || "");
  const respostaNegativaAlerta = contemPalavra(alertas, ["nenhum desses sinais"]);
  const alertaSelecionado = !respostaNegativaAlerta && contemPalavra(alertas, [
    "dificuldade para respirar", "convulsao ou desmaio", "sangramento forte",
    "pode ter ingerido veneno", "acidente ou trauma", "barriga inchada / dor intensa",
    "outro sinal preocupante"
  ]);

  if (alertaSelecionado || contemPalavra(textoGeral, ALERTAS_VERMELHOS)) {
    return {
      nivel: "VERMELHO",
      titulo: "Procure atendimento veterinário agora",
      simbolo: "!",
      explicacao: "Os sinais relatados podem indicar uma emergência. Procure atendimento veterinário imediato e ligue para a clínica ou para um serviço de emergência veterinária. Não espere uma resposta pelo chat."
    };
  }

  const sintomas = normalizar(respostas.sintomas || "");
  const alimentacao = normalizar(respostas.comendoBebendo || "");
  const duracao = normalizar(respostas.duracao || "");
  const sinaisModerados = contemPalavra(textoGeral, SINTOMAS_AMARELOS);
  const naoComeBebe = alimentacao.includes("nao come nem bebe");
  const persistente = duracao.includes("desde ontem") || duracao.includes("varios dias");
  const semApetite = sintomas.includes("nao quer comer") || alimentacao.includes("nao come") || alimentacao.includes("bebe, mas nao come");

  if (naoComeBebe || semApetite || persistente || sinaisModerados) {
    return {
      nivel: "AMARELO",
      titulo: "Entre em contato e agende uma avaliação",
      simbolo: "↗",
      explicacao: "Pelo que você contou, é prudente conversar com a clínica e agendar uma avaliação em breve, idealmente hoje ou nos próximos dias conforme a evolução. Se houver piora ou surgir um sinal de alerta, procure atendimento imediato."
    };
  }

  return {
    nivel: "VERDE",
    titulo: "Observe com atenção e mantenha os cuidados",
    simbolo: "✓",
    explicacao: "Você não selecionou sinais de alerta nesta conversa. Observe o comportamento, mantenha água fresca disponível e deixe o pet em um ambiente confortável. Se o sintoma persistir, piorar ou você ficar preocupado, entre em contato com um médico-veterinário."
  };
}

// TODO: integrar API de IA somente se necessário. Enviar o mínimo de dados,
// obter consentimento e manter limite de mensagens por conversa.
async function consultarIAFutura(_respostas) {
  throw new Error("Integração de IA ainda não configurada.");
}

function contarMensagem() {
  if (state.mensagens >= CONFIG.limiteMensagens) {
    mostrarToast("Limite desta conversa atingido. Reinicie ou fale com a clínica.");
    return false;
  }
  state.mensagens += 1;
  return true;
}

function adicionarMensagem(texto, autor = "bot") {
  const linha = document.createElement("div");
  linha.className = `message ${autor === "user" ? "user" : "bot"}`;
  if (autor !== "user") {
    const avatar = document.createElement("span");
    avatar.className = "mini-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "b+";
    linha.appendChild(avatar);
  }
  const bolha = document.createElement("div");
  bolha.className = "bubble";
  bolha.textContent = texto;
  linha.appendChild(bolha);
  chatMessages.appendChild(linha);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function mostrarDigitando() {
  const linha = document.createElement("div");
  linha.className = "message bot";
  linha.id = "typingIndicator";
  const avatar = document.createElement("span");
  avatar.className = "mini-avatar";
  avatar.textContent = "b+";
  avatar.setAttribute("aria-hidden", "true");
  const bolha = document.createElement("div");
  bolha.className = "bubble typing-bubble";
  bolha.setAttribute("aria-label", "Assistente digitando");
  bolha.innerHTML = "<span></span><span></span><span></span>";
  linha.append(avatar, bolha);
  chatMessages.appendChild(linha);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function removerDigitando() { el("typingIndicator")?.remove(); }

function respostaBot(texto, callback, atraso = 450) {
  mostrarDigitando();
  window.setTimeout(() => {
    removerDigitando();
    adicionarMensagem(texto);
    callback?.();
  }, atraso);
}

function desenharOpcoes(opcoes) {
  quickReplies.replaceChildren();
  opcoes.forEach((opcao) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "quick-reply";
    botao.textContent = opcao;
    botao.addEventListener("click", () => responder(opcao));
    quickReplies.appendChild(botao);
  });
}

function mostrarPergunta() {
  if (state.etapa >= PERGUNTAS.length) return finalizarTriagem();
  const pergunta = PERGUNTAS[state.etapa];
  respostaBot(pergunta.texto, () => desenharOpcoes(pergunta.opcoes));
}

function responder(valor) {
  if (state.encerrado || !contarMensagem()) return;
  const pergunta = PERGUNTAS[state.etapa];
  if (!pergunta) return;
  adicionarMensagem(valor, "user");
  state.respostas[pergunta.chave] = valor;
  quickReplies.replaceChildren();
  freeText.value = "";
  state.etapa += 1;

  // Se a pessoa declarar um alerta de emergência, não é necessário concluir o fluxo.
  const urgenciaParcial = classificarUrgencia(state.respostas);
  if (urgenciaParcial.nivel === "VERMELHO" && pergunta.chave === "alertas") {
    finalizarTriagem();
    return;
  }
  mostrarPergunta();
}

textForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const valor = freeText.value.trim();
  if (!valor) { freeText.focus(); return; }
  if (state.encerrado) {
    mostrarToast("A conversa terminou. Reinicie para começar de novo.");
    return;
  }
  if (!contarMensagem()) return;
  adicionarMensagem(valor, "user");
  const pergunta = PERGUNTAS[state.etapa];
  if (!pergunta) return;
  state.respostas[pergunta.chave] = valor;
  quickReplies.replaceChildren();
  freeText.value = "";
  state.etapa += 1;
  if (pergunta.chave === "alertas" && classificarUrgencia(state.respostas).nivel === "VERMELHO") {
    finalizarTriagem();
  } else {
    mostrarPergunta();
  }
});

function resumoConversa() {
  const r = state.respostas;
  return [
    `Resumo de triagem — ${CONFIG.nomeNegocio}`,
    `Nível orientativo: ${state.urgencia?.nivel || "não classificado"}`,
    `Espécie: ${r.especie || "não informado"}`,
    `Idade: ${r.idade || "não informada"}`,
    `O que está acontecendo: ${r.sintomas || "não informado"}`,
    `Duração: ${r.duracao || "não informada"}`,
    `Alimentação/água: ${r.comendoBebendo || "não informado"}`,
    `Sinais de alerta: ${r.alertas || "não informado"}`,
    "Observação: triagem informativa, não é diagnóstico."
  ].join("\n");
}

function montarLinkWhatsApp(texto) {
  const numero = String(CONFIG.whatsapp).replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function finalizarTriagem() {
  if (state.encerrado) return;
  state.encerrado = true;
  state.urgencia = classificarUrgencia(state.respostas);
  quickReplies.replaceChildren();
  freeText.disabled = true;
  textForm.querySelector("button").disabled = true;
  textForm.querySelector("button").style.opacity = ".5";

  respostaBot("Obrigado por contar pra gente. Vou organizar as informações para sugerir o próximo passo — isso não é um diagnóstico.", () => {
    renderizarResultado();
  }, 550);
}

function renderizarResultado() {
  const resultado = state.urgencia;
  const classes = { VERDE: "result-green", AMARELO: "result-yellow", VERMELHO: "result-red" };
  resultPanel.className = `result-panel ${classes[resultado.nivel]}`;
  resultPanel.replaceChildren();

  const topo = document.createElement("div");
  topo.className = "result-top";
  const simbolo = document.createElement("div");
  simbolo.className = "result-symbol";
  simbolo.setAttribute("aria-hidden", "true");
  simbolo.textContent = resultado.simbolo;
  const texto = document.createElement("div");
  const nivel = document.createElement("p");
  nivel.className = "result-label";
  nivel.textContent = `NÍVEL ${resultado.nivel}`;
  const titulo = document.createElement("h2");
  titulo.textContent = resultado.titulo;
  texto.append(nivel, titulo);
  topo.append(simbolo, texto);

  const descricao = document.createElement("p");
  descricao.className = "result-description";
  descricao.textContent = resultado.explicacao;
  const aviso = document.createElement("p");
  aviso.className = "result-disclaimer";
  aviso.textContent = "Esta é uma orientação automatizada baseada nas respostas. Não confirma nem descarta doenças. A avaliação e as decisões de tratamento cabem ao médico-veterinário.";

  const acoes = document.createElement("div");
  acoes.className = "result-actions";
  const agendar = document.createElement("button");
  agendar.type = "button";
  agendar.className = "primary-button";
  agendar.innerHTML = 'Agendar consulta <span aria-hidden="true">↗</span>';
  agendar.addEventListener("click", abrirAgendamento);
  const whatsapp = document.createElement("a");
  whatsapp.className = "secondary-button";
  whatsapp.href = montarLinkWhatsApp(resumoConversa());
  whatsapp.target = "_blank";
  whatsapp.rel = "noopener";
  whatsapp.innerHTML = 'Enviar resumo pelo WhatsApp <span aria-hidden="true">↗</span>';
  acoes.append(agendar, whatsapp);
  resultPanel.append(topo, descricao, aviso, acoes);
  resultPanel.hidden = false;
  chatControls.hidden = true;

  if (resultado.nivel === "VERMELHO") {
    urgentBanner.hidden = false;
    el("urgentWhatsApp").href = montarLinkWhatsApp(
      `URGENTE — preciso de orientação para atendimento imediato.\n${resumoConversa()}`
    );
    el("urgentCall").href = `tel:+${String(CONFIG.telefone).replace(/\D/g, "")}`;
  }
  resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  salvarDemonstracaoLocal();
}

function abrirAgendamento() {
  const hoje = new Date();
  const dataLocal = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  el("bookingDate").min = dataLocal;
  if (!el("bookingDate").value) el("bookingDate").value = dataLocal;
  bookingDialog.showModal();
}

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const dados = {
    tutor: el("tutorName").value.trim(),
    pet: el("petName").value.trim(),
    data: el("bookingDate").value,
    horario: el("bookingTime").value
  };
  if (!dados.tutor || !dados.pet || !dados.data || !dados.horario) return;
  // Guarda apenas o último pedido neste dispositivo. Não é uma consulta confirmada.
  try { localStorage.setItem("bempet_ultimo_pedido", JSON.stringify(dados)); } catch (_) {}
  const mensagem = [
    `Olá! Gostaria de solicitar um agendamento na ${CONFIG.nomeNegocio}.`,
    `Tutor: ${dados.tutor}`,
    `Pet: ${dados.pet}`,
    `Data desejada: ${dados.data}`,
    `Horário desejado: ${dados.horario}`,
    "",
    resumoConversa(),
    "",
    "Sei que o pedido depende de confirmação da clínica."
  ].join("\n");
  bookingDialog.close();
  window.open(montarLinkWhatsApp(mensagem), "_blank", "noopener");
  mostrarToast("Pedido preparado. Aguarde a confirmação da clínica.");
});

el("closeBooking").addEventListener("click", () => bookingDialog.close());
bookingDialog.addEventListener("click", (event) => {
  if (event.target === bookingDialog) bookingDialog.close();
});

function mostrarToast(texto) {
  const toast = el("toast");
  toast.textContent = texto;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function reiniciarConversa() {
  state.respostas = {};
  state.etapa = 0;
  state.mensagens = 0;
  state.encerrado = false;
  state.urgencia = null;
  chatMessages.replaceChildren();
  quickReplies.replaceChildren();
  resultPanel.hidden = true;
  resultPanel.replaceChildren();
  chatControls.hidden = false;
  urgentBanner.hidden = true;
  freeText.disabled = false;
  textForm.querySelector("button").disabled = false;
  textForm.querySelector("button").style.opacity = "1";
  adicionarMensagem(`Oi! Eu sou o assistente virtual da ${CONFIG.nomeNegocio}. Vou fazer algumas perguntas rápidas para entender o que está acontecendo com seu pet.`, "bot");
  mostrarPergunta();
}
el("resetChat").addEventListener("click", reiniciarConversa);

function salvarDemonstracaoLocal() {
  try {
    localStorage.setItem("bempet_ultima_triagem", JSON.stringify({
      respostas: state.respostas,
      nivel: state.urgencia?.nivel,
      data: new Date().toISOString()
    }));
  } catch (_) { /* Armazenamento pode estar indisponível no modo privado. */ }
}

async function executarDemonstracao() {
  if (state.demoAtiva) return;
  state.demoAtiva = true;
  reiniciarConversa();
  const respostasDemo = [
    "Cachorro",
    "Adulto (1 a 7 anos)",
    "Vômito ou diarreia",
    "Há algumas horas",
    "Sim, os dois",
    "Nenhum desses sinais"
  ];
  for (let i = 0; i < respostasDemo.length; i++) {
    await new Promise((resolve) => window.setTimeout(resolve, 950));
    if (state.encerrado) break;
    responder(respostasDemo[i]);
  }
  state.demoAtiva = false;
}
el("demoToggle").addEventListener("click", executarDemonstracao);

function iniciar() {
  reiniciarConversa();
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "1") {
    // Pequena pausa para a tela carregar antes de iniciar a sequência de vídeo.
    window.setTimeout(executarDemonstracao, 900);
  }
}
iniciar();
