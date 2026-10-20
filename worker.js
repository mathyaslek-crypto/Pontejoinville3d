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
  'alya-pluvio-v1',        // painel de pluviometria
  'alya-paral-v1'          // painel de paralisações
]);
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function api(req, env, url) {
  if (!env.DADOS) return json({ error: 'armazenamento não configurado' }, 503);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','state',key?]
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

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname;
    const email = await verifiedEmail(req).catch(() => null);
    if (!email) return blocked('Não foi possível confirmar o seu login. Feche a página e entre de novo pelo link do site.', '/', 'Entrar de novo');
    const prof = profileOf(email);
    if (prof === 'apontador') {
      if (isRdo(path)) return env.ASSETS.fetch(req);
      if (path.startsWith('/api/')) return json({ error: 'sem acesso' }, 403);
      return Response.redirect(url.origin + '/rdo', 302);
    }
    if (prof === 'equipe' && isRdo(path)) return blocked('O RDO é usado só pelos apontadores. Você tem acesso ao 3D, à pluviometria e às paralisações.', '/', 'Ir para o início');
    if (path.startsWith('/api/')) return api(req, env, url);
    return env.ASSETS.fetch(req);
  }
};
