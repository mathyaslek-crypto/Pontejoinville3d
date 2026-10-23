// Ponte Joinville — Worker do site: entrega as páginas e guarda os dados compartilhados entre aparelhos.
// GET /api/state?keys=a,b  → {chave:{t,by,size}} (só metadados); com &full=1 inclui o valor (v)
// PUT /api/state/<chave>    → grava {v,t} se for mais novo que o que está salvo (último a gravar vence)
// O acesso ao site inteiro (inclusive /api) passa pelo login da Cloudflare Access.
const KEYS = new Set([
  'ponte-obra-v26',        // 3D: planilha de executados importada
  'aduelas-registros-v2',  // 3D: datas lançadas à mão nas aduelas
  'ponte-rdo-v35',         // 3D: pacotes do RDO importados
  'ponte-prelaje-v48',     // 3D: marcação manual das pré-lajes
  'ponte-plano-v50',       // 3D: cronograma (datas previstas) para planejado × executado
  'ponte-pintura-v55',     // 3D: peças pintadas à mão como previsão (botão "Pintar peças")
  'alya-pluvio-v1',        // painel de pluviometria
  'alya-paral-v1'          // painel de paralisações
]);
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// tempo atual em Joinville (Open-Meteo, sem chave), guardado em cache por 10 minutos
async function clima() {
  const u = 'https://api.open-meteo.com/v1/forecast?latitude=-26.3045&longitude=-48.8487&current=temperature_2m,weather_code,cloud_cover,precipitation,rain,showers,is_day,wind_speed_10m&timezone=America%2FSao_Paulo';
  try {
    const r = await fetch(u, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!r.ok) return json({ error: 'clima indisponível' }, 502);
    const j = await r.json();
    return new Response(JSON.stringify({ fonte: 'Open-Meteo', local: 'Joinville/SC', current: j.current }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  } catch (e) { return json({ error: 'clima indisponível' }, 502); }
}

// ---------- pasta do RDO (V1.60): os apontadores enviam o RDO finalizado direto para o site ----------
// Cada envio = um item com os arquivos (PDF, pacote do 3D e fotos), guardados no KV:
//   rdo:f:<id>:<n>  arquivo (com nome, tipo e tamanho nos metadados)      rdo:m:<id>  ficha do envio
//   rdo:index       lista de todos os envios (lida pela pasta da página inicial, 3D, pluviometria e paralisações)
// Apontador e perfil completo enviam; perfil completo e equipe leem; só o perfil completo exclui.
const RDO_ID = /^[A-Za-z0-9_.-]{6,140}$/, RDO_MAX = 24 * 1024 * 1024, RDO_VER = '1.60';   // RDO_VER igual ao do rdo.html
const KINDS = new Set(['pdf', 'pacote', 'foto', 'pluvio', 'outro']);
async function rdoIndex(env) {
  let idx = await env.DADOS.get('rdo:index', 'json').catch(() => null);
  if (!idx || !Array.isArray(idx.itens)) idx = { itens: [], chk: 0 };
  // a lista é refeita a partir das fichas de vez em quando (cobre dois envios gravados ao mesmo tempo)
  if (Date.now() - (idx.chk || 0) > 15 * 60e3) {
    const ids = new Set(); let cur;
    do { const r = await env.DADOS.list({ prefix: 'rdo:m:', cursor: cur }); r.keys.forEach(k => ids.add(k.name.slice(6))); cur = r.list_complete ? null : r.cursor; } while (cur);
    const have = new Map(idx.itens.map(e => [e.id, e])), itens = [];
    for (const id of ids) { let e = have.get(id); if (!e) e = await env.DADOS.get('rdo:m:' + id, 'json').catch(() => null); if (e) itens.push(e); }
    itens.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    idx = { itens, chk: Date.now() };
    await env.DADOS.put('rdo:index', JSON.stringify(idx));
  }
  return idx;
}
async function rdoApi(req, env, url, prof, email) {
  const parts = url.pathname.split('/').filter(Boolean);   // ['api','rdo',acao,id?,n?]
  const acao = parts[2], id = parts[3] ? decodeURIComponent(parts[3]) : '', n = parts[4];
  const canSend = prof === 'apontador' || prof === 'completo', canRead = prof === 'completo' || prof === 'equipe';
  // versão atual do app do RDO: os celulares que estão com a página antiga aberta se atualizam sozinhos
  if (acao === 'versao' && req.method === 'GET') return json({ rdo: RDO_VER });
  if (acao === 'arquivo' && req.method === 'PUT') {
    if (!canSend) return json({ error: 'sem acesso' }, 403);
    if (!RDO_ID.test(id) || !/^\d{1,3}$/.test(n || '')) return json({ error: 'endereço inválido' }, 400);
    const body = await req.arrayBuffer();
    if (!body.byteLength || body.byteLength > RDO_MAX) return json({ error: 'arquivo vazio ou grande demais' }, 413);
    let nome = ''; try { nome = decodeURIComponent(req.headers.get('x-nome') || ''); } catch (e) {}
    nome = nome.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 160) || ('arquivo_' + n);
    const tipo = (req.headers.get('content-type') || 'application/octet-stream').split(';')[0].slice(0, 80);
    await env.DADOS.put('rdo:f:' + id + ':' + n, body, { metadata: { nome, tipo, tam: body.byteLength } });
    return json({ ok: true, tam: body.byteLength });
  }
  if (acao === 'fim' && req.method === 'POST') {
    if (!canSend) return json({ error: 'sem acesso' }, 403);
    if (!RDO_ID.test(id)) return json({ error: 'endereço inválido' }, 400);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'corpo inválido' }, 400); }
    const arquivos = [];
    for (const f of (Array.isArray(b.arquivos) ? b.arquivos : []).slice(0, 200)) {
      const k = 'rdo:f:' + id + ':' + (+f.n);
      const m = await env.DADOS.getWithMetadata(k, 'stream'); if (!m || m.value == null) return json({ error: 'arquivo ' + f.n + ' não chegou' }, 409);
      try { m.value.cancel(); } catch (e) {}
      arquivos.push({ n: +f.n, nome: (m.metadata && m.metadata.nome) || String(f.nome || ''), tipo: (m.metadata && m.metadata.tipo) || '', tam: (m.metadata && m.metadata.tam) || 0, kind: KINDS.has(f.kind) ? f.kind : 'outro' });
    }
    if (!arquivos.length) return json({ error: 'nenhum arquivo' }, 400);
    const s = v => String(v == null ? '' : v).slice(0, 120);
    const e = { id, data: /^\d{4}-\d{2}-\d{2}$/.test(b.data) ? b.data : '', autor: s(b.autor), turno: s(b.turno), rev: Number.isFinite(+b.rev) ? +b.rev : null, app: s(b.app), por: email, at: new Date().toISOString(), arquivos };
    await env.DADOS.put('rdo:m:' + id, JSON.stringify(e));
    const idx = await rdoIndex(env); idx.itens = [e].concat(idx.itens.filter(x => x.id !== id));
    await env.DADOS.put('rdo:index', JSON.stringify(idx));
    return json({ ok: true, item: e });
  }
  if (acao === 'lista' && req.method === 'GET') {
    if (!canRead) return json({ error: 'sem acesso' }, 403);
    const idx = await rdoIndex(env);
    return json({ itens: idx.itens, podeExcluir: prof === 'completo' });
  }
  if (acao === 'arquivo' && req.method === 'GET') {
    if (!canRead) return json({ error: 'sem acesso' }, 403);
    if (!RDO_ID.test(id) || !/^\d{1,3}$/.test(n || '')) return json({ error: 'endereço inválido' }, 400);
    const m = await env.DADOS.getWithMetadata('rdo:f:' + id + ':' + n, 'stream');
    if (!m || m.value == null) return json({ error: 'arquivo não encontrado' }, 404);
    const md = m.metadata || {}, nome = md.nome || 'arquivo';
    // só PDF, foto e texto abrem no navegador; qualquer outro tipo é baixado (nada enviado roda como página do site)
    const safe = /^(application\/pdf|image\/(jpeg|png|webp)|text\/plain)$/.test(md.tipo || ''), baixar = url.searchParams.get('baixar') === '1' || !safe;
    const tipo = safe ? (md.tipo === 'text/plain' ? 'text/plain; charset=utf-8' : md.tipo) : 'application/octet-stream';
    return new Response(m.value, { headers: { 'content-type': tipo, 'content-disposition': (baixar ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(nome), 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' } });
  }
  if (acao === 'item' && req.method === 'DELETE') {
    if (prof !== 'completo') return json({ error: 'só o perfil completo pode excluir' }, 403);
    if (!RDO_ID.test(id)) return json({ error: 'endereço inválido' }, 400);
    const e = await env.DADOS.get('rdo:m:' + id, 'json').catch(() => null);
    let cur; do { const r = await env.DADOS.list({ prefix: 'rdo:f:' + id + ':', cursor: cur }); for (const k of r.keys) await env.DADOS.delete(k.name); cur = r.list_complete ? null : r.cursor; } while (cur);
    await env.DADOS.delete('rdo:m:' + id);
    const idx = await rdoIndex(env); idx.itens = idx.itens.filter(x => x.id !== id); await env.DADOS.put('rdo:index', JSON.stringify(idx));
    return json({ ok: true, removido: !!e });
  }
  return json({ error: 'rota desconhecida' }, 404);
}

async function api(req, env, url) {
  if (!env.DADOS) return json({ error: 'armazenamento não configurado' }, 503);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','state',key?]
  if (parts[1] === 'clima' && req.method === 'GET') return clima();
  if (parts[1] !== 'state') return json({ error: 'rota desconhecida' }, 404);
  if (req.method === 'GET' && parts.length === 2) {
    const keys = (url.searchParams.get('keys') || '').split(',').filter(k => KEYS.has(k));
    const full = url.searchParams.get('full') === '1', out = {};
    await Promise.all(keys.map(async k => {
      const m = await env.DADOS.get('meta:' + k, 'json');
      if (!m) return;
      out[k] = m;
      if (full) { const v = await env.DADOS.get('state:' + k, 'text'); if (v != null) out[k].v = v; }
    }));
    return json(out);
  }
  if (req.method === 'PUT' && parts.length === 3) {
    const key = decodeURIComponent(parts[2]);
    if (!KEYS.has(key)) return json({ error: 'chave não permitida' }, 400);
    let body; try { body = await req.json(); } catch (e) { return json({ error: 'corpo inválido' }, 400); }
    if (typeof body.v !== 'string' || typeof body.t !== 'number') return json({ error: 'corpo inválido' }, 400);
    if (body.v.length > 20e6) return json({ error: 'dados grandes demais' }, 413);
    const cur = await env.DADOS.get('meta:' + key, 'json').catch(() => null);
    if (cur && cur.t > body.t) return json({ ok: false, newer: cur }, 409);
    const by = req.headers.get('cf-access-authenticated-user-email') || '';
    const meta = { t: body.t, by, size: body.v.length };
    await env.DADOS.put('state:' + key, body.v);
    await env.DADOS.put('meta:' + key, JSON.stringify(meta));
    return json({ ok: true, meta });
  }
  return json({ error: 'método não permitido' }, 405);
}

// ---------- quem pode ver o quê ----------
// Login continua na Cloudflare Access (código no e-mail). Aqui o Worker lê o e-mail do token assinado pela Access
// e libera as páginas por perfil:
//   completo  → tudo (início, 3D, pluviometria, paralisações e RDO)
//   apontador → só o RDO (qualquer outro endereço volta para o RDO)
//   equipe    → início, 3D, pluviometria e paralisações (sem o RDO)
const FULL = new Set(['mathyaslek@gmail.com']);
const RDO_ONLY = new Set(['kailane.costa@alyaconstrutora.com', 'joao.psimoes@alyaconstrutora.com', 'anderson.silva@alyaconstrutora.com']);
const isRdo = p => p === '/rdo' || p === '/rdo.html' || p === '/rdo/';

const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let certCache = { iss: '', at: 0, keys: [] };
async function verifiedEmail(req) {
  const jwt = req.headers.get('cf-access-jwt-assertion');
  if (!jwt) return null;
  const [h, p, sig] = jwt.split('.');
  if (!sig) return null;
  let head, pay;
  try { head = JSON.parse(new TextDecoder().decode(b64u(h))); pay = JSON.parse(new TextDecoder().decode(b64u(p))); } catch (e) { return null; }
  const iss = String(pay.iss || '');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(iss)) return null;
  if (pay.exp && pay.exp * 1000 < Date.now()) return null;
  if (certCache.iss !== iss || Date.now() - certCache.at > 3600e3) {
    const r = await fetch(iss + '/cdn-cgi/access/certs');
    if (!r.ok) return null;
    certCache = { iss, at: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = certCache.keys.find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(h + '.' + p));
  return ok ? String(pay.email || '').toLowerCase() : null;
}
function profileOf(email) { return FULL.has(email) ? 'completo' : RDO_ONLY.has(email) ? 'apontador' : 'equipe'; }
function blocked(msg, link, label) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso restrito · Ponte Joinville</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111215;color:#eceae5;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px}main{max-width:420px;padding:28px;border:1px solid #c7c4bc22;border-radius:12px;background:#17181c}h1{margin:0 0 8px;font-size:19px;color:#fff}p{margin:0 0 18px;color:#b9b6ae}a{display:inline-block;padding:10px 16px;border-radius:8px;background:#FDB900;color:#151515;font-weight:600;text-decoration:none}</style></head><body><main><h1>Acesso restrito</h1><p>${msg}</p>${link ? `<a href="${link}">${label}</a>` : ''}</main></body></html>`, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

// ---------- tela de carregamento (loader da Uiverse, by dexter-st) ----------
// Entra logo depois do <title> de toda página HTML, antes dos scripts grandes: o navegador já pinta a tela de carregamento
// em vez de continuar mostrando a página anterior; some quando a página termina de carregar.
const LOADER_HTML = `<style id="ldr-css">#ldr{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;background:#0b0d10;transition:opacity .45s ease}#ldr.out{opacity:0;pointer-events:none}#ldr p{margin:0;font:500 12px/1 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#8e8b84}
.loader-wrapper{position:relative;display:flex;align-items:center;justify-content:center;width:180px;height:180px;font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:1.2em;font-weight:300;color:white;border-radius:50%;background-color:transparent;user-select:none}
.loader{position:absolute;top:0;left:0;width:100%;aspect-ratio:1/1;border-radius:50%;background-color:transparent;animation:loader-rotate 2s linear infinite;z-index:0}
@keyframes loader-rotate{0%{transform:rotate(90deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 30px 0 #FFD45C inset,0 60px 60px 0 #C98500 inset}50%{transform:rotate(270deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 10px 0 #FDB900 inset,0 40px 60px 0 #6B4A00 inset}100%{transform:rotate(450deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 30px 0 #FFD45C inset,0 60px 60px 0 #C98500 inset}}
.loader-letter{display:inline-block;opacity:.4;transform:translateY(0);animation:loader-letter-anim 2s infinite;z-index:1;border-radius:50ch;border:none}
.loader-letter:nth-child(1){animation-delay:0s}.loader-letter:nth-child(2){animation-delay:.1s}.loader-letter:nth-child(3){animation-delay:.2s}.loader-letter:nth-child(4){animation-delay:.3s}.loader-letter:nth-child(5){animation-delay:.4s}.loader-letter:nth-child(6){animation-delay:.5s}.loader-letter:nth-child(7){animation-delay:.6s}.loader-letter:nth-child(8){animation-delay:.7s}.loader-letter:nth-child(9){animation-delay:.8s}.loader-letter:nth-child(10){animation-delay:.9s}
@keyframes loader-letter-anim{0%,100%{opacity:.4;transform:translateY(0)}20%{opacity:1;transform:scale(1.15)}40%{opacity:.7;transform:translateY(0)}}</style><div id="ldr" role="status" aria-label="Carregando"><div class="loader-wrapper">${[...'Carregando'].map(c => `<span class="loader-letter">${c}</span>`).join('')}<div class="loader"></div></div><p>Ponte Joinville</p></div><script>(function(){var d=document.getElementById('ldr'),t0=Date.now(),done=0;function hide(){if(done)return;done=1;setTimeout(function(){d.classList.add('out');setTimeout(function(){d.remove();var c=document.getElementById('ldr-css');c&&c.remove();},500);},Math.max(0,500-(Date.now()-t0)));}if(document.readyState==='complete')hide();else addEventListener('load',hide);setTimeout(hide,40000);})();</script>`;
// ---------- controle de setas do 3D no estilo "liquid glass" (inspirado no botão da Uiverse, by shokat_2650) ----------
// Só muda a aparência do #pad50 (criado pelo 3D); seletores com "html body" vencem o estilo original sem tocar no 3d.html.
const PAD_CSS = `<style id="pad-glass">
/* caixa que aparecia ao passar o mouse sobre a peça: substituída pela ficha completa ao clicar */
#av-tip{display:none!important}
@property --pg-a1{syntax:"<angle>";inherits:false;initial-value:-75deg}
@property --pg-a2{syntax:"<angle>";inherits:false;initial-value:-45deg}
html body #pad50#pad50{gap:10px;filter:drop-shadow(0 10px 18px rgba(0,0,0,.35))}
html body #pad50#pad50 .dp,html body #pad50#pad50 .side{gap:6px;padding:8px;border-radius:26px;background:linear-gradient(-75deg,rgba(20,24,30,.28),rgba(255,255,255,.12),rgba(20,24,30,.28));border:0;box-shadow:inset 0 .125em .125em rgba(0,0,0,.08),inset 0 -.125em .125em rgba(255,255,255,.22),0 0 .1em .25em inset rgba(255,255,255,.08),0 .4em .6em -.2em rgba(0,0,0,.45);backdrop-filter:blur(10px) saturate(150%);-webkit-backdrop-filter:blur(10px) saturate(150%);position:relative}
html body #pad50#pad50 .dp{border-radius:50%;padding:10px}
html body #pad50#pad50 button{position:relative;border-radius:999px;border:0!important;color:#fff!important;font-weight:600;background:linear-gradient(-75deg,rgba(255,255,255,.1),rgba(255,255,255,.3),rgba(255,255,255,.1))!important;box-shadow:inset 0 .125em .125em rgba(0,0,0,.05),inset 0 -.125em .125em rgba(255,255,255,.45),0 .25em .125em -.125em rgba(0,0,0,.35),0 0 .1em .25em inset rgba(255,255,255,.18)!important;backdrop-filter:blur(3px)!important;-webkit-backdrop-filter:blur(3px)!important;text-shadow:0 .1em .15em rgba(0,0,0,.45);transition:transform .4s cubic-bezier(.25,1,.5,1),box-shadow .4s cubic-bezier(.25,1,.5,1),background .3s,color .3s;-webkit-tap-highlight-color:transparent;overflow:visible}
html body #pad50#pad50 button::after{content:"";position:absolute;inset:-.5px;border-radius:999px;padding:1px;pointer-events:none;background:conic-gradient(from var(--pg-a1) at 50% 50%,rgba(0,0,0,.32),rgba(0,0,0,0) 5% 40%,rgba(0,0,0,.32) 50%,rgba(0,0,0,0) 60% 95%,rgba(0,0,0,.32)),linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,.5));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);transition:--pg-a1 .5s ease}
html body #pad50#pad50 button::before{content:"";position:absolute;inset:1px;border-radius:999px;pointer-events:none;mix-blend-mode:screen;background:linear-gradient(var(--pg-a2),rgba(255,255,255,0) 0%,rgba(255,255,255,.45) 40% 50%,rgba(255,255,255,0) 55%);background-size:200% 200%;background-position:0% 50%;background-repeat:no-repeat;transition:background-position .5s cubic-bezier(.25,1,.5,1),--pg-a2 .5s cubic-bezier(.25,1,.5,1)}
html body #pad50#pad50 button:hover{transform:scale(.975);background:linear-gradient(-75deg,rgba(255,255,255,.08),rgba(255,255,255,.26),rgba(255,255,255,.08))!important}
html body #pad50#pad50 button:hover::after{--pg-a1:-125deg}
html body #pad50#pad50 button:hover::before{background-position:25% 50%}
html body #pad50#pad50 button:active,html body #pad50#pad50 button.on{transform:scale(.94) translateY(1px);color:#1b1404!important;text-shadow:none;background:linear-gradient(-75deg,rgba(253,185,0,.75),rgba(255,212,92,.95),rgba(253,185,0,.75))!important;box-shadow:inset 0 .125em .2em rgba(0,0,0,.18),inset 0 -.125em .125em rgba(255,255,255,.55),0 0 .9em rgba(253,185,0,.55),0 .1em .1em -.05em rgba(0,0,0,.3)!important}
html body #pad50#pad50 button:active::before,html body #pad50#pad50 button.on::before{background-position:50% 15%;--pg-a2:-15deg}
html body #pad50#pad50 .c{font-size:10.5px;letter-spacing:.04em;color:#e9e4d6;background:linear-gradient(-75deg,rgba(255,255,255,.02),rgba(255,255,255,.1),rgba(255,255,255,.02));box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
html body #pad50#pad50 .c::after{display:none}
@media (hover:none) and (pointer:coarse){html body #pad50#pad50 button::after{--pg-a1:-75deg}html body #pad50#pad50 button::before{--pg-a2:-45deg}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){html body #pad50#pad50 .dp,html body #pad50#pad50 .side{background:#11151be6}}
</style>`;

async function withLoader(res, extra = '') {
  const ct = res.headers.get('content-type') || '';
  if (res.status !== 200 || !ct.includes('text/html')) return res;
  let put = false;
  return new HTMLRewriter()
    .on('head > title', { element(e) { if (!put) { put = true; e.after(LOADER_HTML + extra, { html: true }); } } })
    .on('body', { element(e) { if (!put) { put = true; e.prepend(LOADER_HTML + extra, { html: true }); } } })
    .transform(res);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname;
    const email = await verifiedEmail(req).catch(() => null);
    if (!email) return blocked('Não foi possível confirmar o seu login. Feche a página e entre de novo pelo link do site.', '/', 'Entrar de novo');
    const prof = profileOf(email);
    if (path.startsWith('/api/rdo/')) return env.DADOS ? rdoApi(req, env, url, prof, email) : json({ error: 'armazenamento não configurado' }, 503);
    if (prof === 'apontador') {
      if (isRdo(path)) return withLoader(await env.ASSETS.fetch(req));
      if (path.startsWith('/api/')) return json({ error: 'sem acesso' }, 403);
      return Response.redirect(url.origin + '/rdo', 302);
    }
    if (prof === 'equipe' && isRdo(path)) return blocked('O RDO é usado só pelos apontadores. Você tem acesso ao 3D, à pluviometria e às paralisações.', '/', 'Ir para o início');
    if (path.startsWith('/api/')) return api(req, env, url);
    return withLoader(await env.ASSETS.fetch(req), path === '/3d' || path === '/3d.html' ? PAD_CSS + '<script src="/ajustes3d.js?v=2" defer></script><script src="/cena3d.js?v=1" defer></script><script src="/eixos3d.js?v=4" defer></script><script src="/clima3d.js?v=3" defer></script><script src="/ficha3d.js?v=5" defer></script><script src="/cronogramas3d.js?v=1" defer></script><script src="/cenarios3d.js?v=1" defer></script><script src="/previsao3d.js?v=6" defer></script><script src="/ocultar3d.js?v=4" defer></script><script src="/pintar3d.js?v=3" defer></script><script src="/batch3d.js?v=1" defer></script><script src="/rdopasta3d.js?v=1" defer></script><script src="/publicar3d.js?v=2" defer></script>' : '');
  }
};
