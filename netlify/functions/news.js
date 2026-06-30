// netlify/functions/news.js
// Busca notícias de futebol (Brasileirão/Série A-D, mercado da bola, Copa do Mundo 2026,
// Seleção Brasileira) agregando o Google News RSS — que cobre milhares de fontes da internet —
// normaliza tudo, converte horários para o fuso de Brasília e devolve em JSON.

const { XMLParser } = require("fast-xml-parser");

// "query" é o termo de busca (sem aspas codificadas manualmente — usamos encodeURIComponent).
// "janela" é a janela de tempo usada no operador real do Google ("when:Xd"), não confundir
// com a palavra em português "quando", que o Google NÃO reconhece como operador.
const FEEDS = [
  {
    categoria: "Brasileirão",
    query: '(brasileirão OR "série a" OR "série b" OR "série c" OR "série d") futebol',
    janela: "3d",
  },
  {
    categoria: "Mercado da Bola",
    query: '("mercado da bola" OR transferência OR negociação OR contratação OR empréstimo) futebol',
    janela: "3d",
  },
  {
    categoria: "Copa do Mundo 2026",
    query: '("copa do mundo 2026" OR "copa do mundo" OR "copa 2026" OR mundial) futebol',
    janela: "5d",
  },
  {
    categoria: "Seleção Brasileira",
    query: '("seleção brasileira" OR "seleção masculina" OR canarinho) futebol',
    janela: "3d",
  },
  {
    categoria: "Geral",
    query: "futebol brasileiro",
    janela: "1d",
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function montarURL(query, janela) {
  const termoCompleto = janela ? `${query} when:${janela}` : query;
  const hl = "pt-BR";
  const gl = "BR";
  const ceid = "BR:pt-BR";
  return (
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(termoCompleto) +
    `&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`
  );
}

function limparTitulo(tituloBruto, fonteNome) {
  if (!tituloBruto) return "";
  let t = String(tituloBruto);
  // Google News formata "Título da notícia - Nome da Fonte"
  if (fonteNome && t.endsWith(" - " + fonteNome)) {
    t = t.slice(0, t.length - (" - " + fonteNome).length);
  } else {
    t = t.replace(/\s-\s[^-]+$/, (m) => (m.length < 60 ? "" : m));
  }
  return t.trim();
}

function paraBrasilia(dataISO) {
  try {
    const d = new Date(dataISO);
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return formatter.format(d);
  } catch {
    return "";
  }
}

async function buscarXML(url) {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FutebolNewsBot/1.0)" },
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const json = parser.parse(xml);
    const itens = json?.rss?.channel?.item;
    if (!itens) return [];
    return Array.isArray(itens) ? itens : [itens];
  } catch {
    return [];
  }
}

function normalizarItens(itensXML, categoria) {
  return itensXML.map((item) => {
    const fonteNome =
      typeof item.source === "object" ? item.source["#text"] : item.source;
    const titulo = limparTitulo(item.title, fonteNome);
    const dataPub = item.pubDate ? new Date(item.pubDate) : new Date();

    return {
      titulo,
      link: item.link,
      fonte: fonteNome || "Fonte desconhecida",
      categoria,
      publicadoEm: dataPub.toISOString(),
      horarioBrasilia: paraBrasilia(dataPub.toISOString()),
    };
  });
}

async function buscarFeed(feed) {
  // 1ª tentativa: busca restrita à janela de tempo (mais "tempo real")
  let itensXML = await buscarXML(montarURL(feed.query, feed.janela));

  // se não veio nada (categoria mais nichada, pouco volume no momento),
  // tenta de novo sem restrição de tempo para a página nunca ficar vazia
  if (itensXML.length === 0) {
    itensXML = await buscarXML(montarURL(feed.query, null));
  }

  return normalizarItens(itensXML, feed.categoria);
}

function chaveDedupe(titulo) {
  return String(titulo)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .slice(0, 8)
    .join(" ");
}

exports.handler = async function () {
  try {
    const resultados = await Promise.all(FEEDS.map(buscarFeed));
    let todas = resultados.flat();

    // remove duplicadas (mesma manchete relatada por várias fontes)
    const vistos = new Set();
    todas = todas.filter((n) => {
      const chave = chaveDedupe(n.titulo);
      if (!chave || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    // ordena da mais recente para a mais antiga
    todas.sort((a, b) => new Date(b.publicadoEm) - new Date(a.publicadoEm));

    // limita para não devolver um payload gigante
    todas = todas.slice(0, 80);

    const agora = new Date();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=15",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        atualizadoEm: agora.toISOString(),
        atualizadoEmBrasilia: paraBrasilia(agora.toISOString()),
        total: todas.length,
        noticias: todas,
      }),
    };
  } catch (erro) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ erro: "Falha ao buscar notícias", detalhe: String(erro) }),
    };
  }
};
