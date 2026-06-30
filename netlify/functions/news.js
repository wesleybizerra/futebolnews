// netlify/functions/news.js
// Busca notícias de futebol (Brasileirão, mercado da bola, Copa do Mundo 2026)
// agregando o Google News RSS (que por sua vez cobre milhares de fontes da internet),
// normaliza tudo, converte horários para o fuso de Brasília e devolve em JSON.

const { XMLParser } = require("fast-xml-parser");

const FEEDS = [
  {
    categoria: "Brasileirão",
    url: "https://news.google.com/rss/search?q=brasileir%C3%A3o%20futebol%20quando:2d&hl=pt-BR&gl=BR&ceid=BR:pt-BR",
  },
  {
    categoria: "Mercado da Bola",
    url: "https://news.google.com/rss/search?q=%22mercado%20da%20bola%22%20OR%20transfer%C3%AAncia%20futebol%20quando:2d&hl=pt-BR&gl=BR&ceid=BR:pt-BR",
  },
  {
    categoria: "Copa do Mundo 2026",
    url: "https://news.google.com/rss/search?q=%22copa%20do%20mundo%202026%22%20quando:3d&hl=pt-BR&gl=BR&ceid=BR:pt-BR",
  },
  {
    categoria: "Seleção Brasileira",
    url: "https://news.google.com/rss/search?q=sele%C3%A7%C3%A3o%20brasileira%20futebol%20quando:2d&hl=pt-BR&gl=BR&ceid=BR:pt-BR",
  },
  {
    categoria: "Geral",
    url: "https://news.google.com/rss/search?q=futebol%20brasileiro%20quando:1d&hl=pt-BR&gl=BR&ceid=BR:pt-BR",
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

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

async function buscarFeed(feed) {
  try {
    const resp = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FutebolNewsBot/1.0)" },
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const json = parser.parse(xml);
    const itens = json?.rss?.channel?.item;
    if (!itens) return [];
    const lista = Array.isArray(itens) ? itens : [itens];

    return lista.map((item) => {
      const fonteNome =
        typeof item.source === "object" ? item.source["#text"] : item.source;
      const titulo = limparTitulo(item.title, fonteNome);
      const dataPub = item.pubDate ? new Date(item.pubDate) : new Date();

      return {
        titulo,
        link: item.link,
        fonte: fonteNome || "Fonte desconhecida",
        categoria: feed.categoria,
        publicadoEm: dataPub.toISOString(),
        horarioBrasilia: paraBrasilia(dataPub.toISOString()),
      };
    });
  } catch (e) {
    return [];
  }
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
    todas = todas.slice(0, 60);

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
