// js/app.js
const ENDPOINT = "/api/news";
const INTERVALO_MS = 30000; // 30s — "tempo real" via polling

let categoriaAtiva = "Todas";
let ultimoLinkDestaque = null;
let cacheNoticias = [];

// ---------- Relógio de Brasília (faixa AO VIVO) ----------
function atualizarRelogio(){
  const agora = new Date();
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(agora);
  document.getElementById("relogioBrasilia").textContent = hora + " (Brasília)";
}
atualizarRelogio();
setInterval(atualizarRelogio, 1000);

// ---------- Relógio fixo flutuante (acompanha o scroll) ----------
function atualizarRelogioFlutuante(){
  const agora = new Date();
  const fusoBrasilia = "America/Sao_Paulo";

  const dataFormatada = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoBrasilia, day: "2-digit", month: "2-digit", year: "numeric"
  }).format(agora);

  let diaSemana = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoBrasilia, weekday: "long"
  }).format(agora);
  // "segunda-feira" -> "Segunda-feira"
  diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

  const horaFormatada = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fusoBrasilia, hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(agora);

  document.getElementById("dataFlutuante").textContent = dataFormatada;
  document.getElementById("diaSemanaFlutuante").textContent = diaSemana;
  document.getElementById("horaFlutuante").textContent = horaFormatada;
}
atualizarRelogioFlutuante();
setInterval(atualizarRelogioFlutuante, 1000);

// ---------- Filtros ----------
document.getElementById("filtros").addEventListener("click", (e) => {
  const btn = e.target.closest(".filtro");
  if (!btn) return;
  document.querySelectorAll(".filtro").forEach(f => f.classList.remove("ativo"));
  btn.classList.add("ativo");
  categoriaAtiva = btn.dataset.cat;
  renderizarGrid();
});

// ---------- Busca de notícias ----------
async function buscarNoticias(){
  try{
    const resp = await fetch(ENDPOINT, { cache: "no-store" });
    if(!resp.ok) throw new Error("Resposta inválida do servidor");
    const data = await resp.json();
    cacheNoticias = data.noticias || [];

    atualizarTicker(cacheNoticias);
    atualizarHero(cacheNoticias[0]);
    renderizarGrid();

    document.getElementById("ultimaAtualizacao").textContent =
      "Última verificação: " + (data.atualizadoEmBrasilia || "") + " (Brasília)";
  }catch(err){
    document.getElementById("ultimaAtualizacao").textContent =
      "Não foi possível atualizar agora — tentando novamente...";
    console.error(err);
  }
}

// ---------- Destaque (placar / hero) ----------
function atualizarHero(noticia){
  if(!noticia) return;
  const face = document.getElementById("scoreboardFace");
  const ehNova = noticia.link !== ultimoLinkDestaque;

  document.getElementById("heroCategoria").textContent = noticia.categoria;
  document.getElementById("heroTitulo").textContent = noticia.titulo;
  document.getElementById("heroFonte").textContent = noticia.fonte;
  document.getElementById("heroHorario").textContent = noticia.horarioBrasilia;
  document.getElementById("heroLink").href = noticia.link;

  if(ehNova && ultimoLinkDestaque !== null){
    face.classList.remove("flip");
    void face.offsetWidth; // força reflow para reiniciar a animação
    face.classList.add("flip");
  }
  ultimoLinkDestaque = noticia.link;
}

// ---------- Ticker (faixa AO VIVO) ----------
function atualizarTicker(lista){
  const track = document.getElementById("tickerTrack");
  const titulos = lista.slice(0, 12).map(n => `${n.titulo} (${n.fonte})`);
  track.innerHTML = titulos.map(t => `<span>${escapeHTML(t)}</span>`).join("");
}

// ---------- Grade de notícias ----------
function renderizarGrid(){
  const grid = document.getElementById("feedGrid");
  const lista = (categoriaAtiva === "Todas"
    ? cacheNoticias
    : cacheNoticias.filter(n => n.categoria === categoriaAtiva)
  ).slice(1, 31); // o item [0] já está em destaque no hero

  if(lista.length === 0){
    grid.innerHTML = `<p style="color:var(--text-faint)">Nenhuma notícia encontrada nessa categoria ainda.</p>`;
    return;
  }

  const agora = Date.now();
  grid.innerHTML = lista.map(n => {
    const recente = (agora - new Date(n.publicadoEm).getTime()) < 5 * 60 * 1000;
    return `
      <a class="card" href="${n.link}" target="_blank" rel="noopener">
        ${recente ? '<span class="card__novo">NOVO</span>' : ''}
        <span class="card__categoria">${escapeHTML(n.categoria)}</span>
        <span class="card__titulo">${escapeHTML(n.titulo)}</span>
        <div class="card__meta">
          <span>${escapeHTML(n.fonte)}</span>
          <span>${escapeHTML(n.horarioBrasilia)}</span>
        </div>
      </a>
    `;
  }).join("");
}

function escapeHTML(str){
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

// ---------- Loop de tempo real ----------
buscarNoticias();
setInterval(buscarNoticias, INTERVALO_MS);
