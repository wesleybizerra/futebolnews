# APITO FINAL — Futebol em Tempo Real

Site de notícias de futebol (Brasileirão, mercado da bola, Copa do Mundo 2026 e Seleção Brasileira)
com atualização automática a cada 30 segundos, horário de Brasília, e destaque cinematográfico
para a última notícia no topo.

## Como funciona (sem Firebase)

- `netlify/functions/news.js` roda no servidor (Netlify Functions, grátis no plano free) e busca
  as notícias mais recentes agregando o Google News RSS — que por sua vez cobre milhares de sites
  diferentes, então não fica preso a uma única fonte.
- O navegador chama essa function a cada 30s (`js/app.js`) e atualiza a tela sozinho.
- Não precisa de banco de dados nem de Firebase para isso funcionar. Firebase só entraria em cena
  se um dia você quiser login de usuário, comentários ou notícias favoritas salvas por pessoa.

## Como publicar no Netlify

**Opção A — pelo site da Netlify (mais simples):**
1. Crie uma conta em https://app.netlify.com
2. Clique em "Add new site" → "Import an existing project" (ou "Deploy manually" se preferir
   arrastar a pasta — nesse caso, rode `npm install` localmente antes de arrastar, para a pasta
   `node_modules` ir junto).
3. Se conectar via Git (recomendado): suba esta pasta para um repositório no GitHub/GitLab e
   conecte o repositório. A Netlify vai detectar o `netlify.toml`, rodar `npm install` sozinha
   e publicar tudo, function incluída.
4. Pronto — a Netlify te dá uma URL tipo `https://seu-site.netlify.app`.

**Opção B — Netlify CLI (linha de comando):**
```bash
npm install -g netlify-cli
cd futebol-news
npm install
netlify deploy --prod
```

## Testando localmente antes de subir
```bash
npm install -g netlify-cli
cd futebol-news
npm install
netlify dev
```
Isso sobe o site e a function juntos em `http://localhost:8888`.

## Personalizar

- **Times/categorias**: edite o array `FEEDS` em `netlify/functions/news.js` — dá pra trocar as
  buscas do Google News por qualquer time, campeonato ou termo (ex: "Flamengo", "Libertadores").
- **Intervalo de atualização**: constante `INTERVALO_MS` em `js/app.js` (hoje 30000 = 30s).
- **Cores e fontes**: tudo centralizado no topo de `css/style.css`, em `:root`.

## Estrutura
```
futebol-news/
├── index.html
├── css/style.css
├── js/app.js
├── netlify/functions/news.js
├── netlify.toml
├── package.json
└── README.md
```
