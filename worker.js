// Ponte Joinville — Worker do site: entrega as páginas e guarda os dados compartilhados entre aparelhos.
// GET /api/state?keys=a,b  → {chave:{t,by,size}} (só metadados); com &full=1 inclui o valor (v)
// PUT /api/state/<chave>    → grava {v,t} se for mais novo que o que está salvo (último a gravar vence)
// O acesso ao site inteiro (inclusive /api) passa pelo login da Cloudflare Access.
const KEYS = new Set([
  'ponte-obra-v26',        // 3D: planilha de executados importada
  'aduelas-registros-v2',  // 3D: datas lançadas à mão nas aduelas
  'ponte-rdo-v35',         // 3D: pacotes do RDO importados
  'ponte-prelaje-v48',     // 3D: marcação manual das pré-lajes
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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return api(req, env, url);
    return env.ASSETS.fetch(req);
  }
};
