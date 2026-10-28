// Ponte Joinville — endereço só do RDO, com usuário e senha (V1.68)
// Para os apontadores que não recebem o código da Cloudflare Access no e-mail. Este Worker NÃO fica atrás da Access:
// a pessoa entra com usuário e senha (criados pelo perfil completo na tela "Usuários do RDO" do site principal).
// Depois de entrar ela só vê o RDO e só pode ENVIAR para a Pasta do RDO: mesmo KV e mesmas regras do site principal
// (rdoApi do worker.js com o perfil apontador, que não lista, não baixa e não exclui nada).
// Publicado com: npx wrangler deploy --config wrangler.rdo.jsonc
import { rdoApi } from './worker.js';
import { lerUsuario, gravarUsuario, confereSenha, criaSessao, leSessao, normUser, MAX_FALHAS, BLOQ_MIN, SESSAO_DIAS } from './rdo-auth.js';

const COOKIE = 'rdo_sessao';
const SEG = { 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin', 'x-content-type-options': 'nosniff' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SEG } });
const cookieDe = req => { const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)rdo_sessao=([^;]+)/); return m ? m[1] : ''; };
const setCookie = (v, maxAge) => `${COOKIE}=${v}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ir = (to, cookie) => new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) } });

function paginaLogin(msg, usuario, status = 200) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0e12"><title>RDO · Ponte Joinville</title>
<style>
:root{--bg:#0a0e12;--panel:#0f151b;--ink:#eef1f3;--ink2:#b9c2ca;--muted:#7d8893;--line2:#2a3540;--amber:#f2b33d;--err:#ef6b62;color-scheme:dark}
*{box-sizing:border-box;margin:0}
body{min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;padding:16px}
main{width:100%;max-width:380px;padding:28px 24px;border:1px solid var(--line2);border-radius:16px;background:var(--panel)}
.top{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.mk{width:22px;height:22px;background:var(--amber);clip-path:polygon(50% 0,100% 100%,72% 100%,50% 52%,28% 100%,0 100%)}
.top b{font-weight:600;letter-spacing:.18em;font-size:12.5px}.top span{color:var(--muted);font-size:12.5px;margin-left:auto}
h1{font-size:24px;font-weight:600}p.sub{color:var(--ink2);margin:4px 0 20px}
label{display:block;font-size:13px;color:var(--ink2);margin:14px 0 6px}
.f{position:relative}
input{width:100%;height:48px;border-radius:12px;border:1px solid var(--line2);background:#0b1015;color:var(--ink);padding:0 14px;font:inherit;font-size:16px}
input:focus{outline:none;border-color:var(--amber)}
.ver{position:absolute;right:6px;top:6px;height:36px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--ink2);font:inherit;font-size:13px;cursor:pointer}
button.go{width:100%;height:50px;margin-top:22px;border:0;border-radius:12px;background:var(--amber);color:#151515;font:inherit;font-weight:700;font-size:16px;cursor:pointer}
.msg{margin-top:16px;padding:10px 12px;border-radius:10px;background:#2a1414;color:#ffb4ae;font-size:14px}
.hint{margin-top:18px;color:var(--muted);font-size:13px}
</style></head><body><main>
<div class="top"><div class="mk"></div><b>ALYA</b><span>Ponte Joinville</span></div>
<h1>RDO</h1><p class="sub">Entre com o usuário e a senha que você recebeu.</p>
<form method="post" action="/entrar" autocomplete="on">
<label for="u">Usuário</label><input id="u" name="usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required value="${esc(usuario)}">
<label for="s">Senha</label><div class="f"><input id="s" name="senha" type="password" autocomplete="current-password" required><button class="ver" type="button" id="ver">Mostrar</button></div>
<button class="go" type="submit">Entrar</button>
${msg ? `<p class="msg" role="alert">${esc(msg)}</p>` : ''}
</form>
<p class="hint">Esqueceu a senha? Peça para o responsável pelo RDO trocar.</p>
</main><script>document.getElementById('ver').onclick=function(){var s=document.getElementById('s'),t=s.type==='password';s.type=t?'text':'password';this.textContent=t?'Esconder':'Mostrar';};document.getElementById(${usuario ? "'s'" : "'u'"}).focus();</script></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...SEG } });
}

async function entrar(req, env, url) {
  const o = req.headers.get('origin');
  if (o && o !== url.origin) return paginaLogin('Abra o endereço do RDO e tente de novo.', '', 403);
  let f; try { f = await req.formData(); } catch (e) { return paginaLogin('Preencha o usuário e a senha.', '', 400); }
  const nome = normUser(f.get('usuario')), senha = String(f.get('senha') || '').slice(0, 200);
  const u = await lerUsuario(env, nome);
  if (u && u.bloq && u.bloq > Date.now()) {
    const min = Math.max(1, Math.ceil((u.bloq - Date.now()) / 60e3));
    return paginaLogin(`Muitas senhas erradas. Tente de novo em ${min} minuto${min > 1 ? 's' : ''}.`, nome, 429);
  }
  const ok = await confereSenha(u && u.ativo !== false ? u : null, senha);
  if (!ok) {
    if (u) {
      u.falhas = (u.falhas || 0) + 1;
      if (u.falhas >= MAX_FALHAS) { u.bloq = Date.now() + BLOQ_MIN * 60e3; u.falhas = 0; }
      await gravarUsuario(env, nome, u);
    }
    return paginaLogin('Usuário ou senha incorretos.', nome, 401);
  }
  u.falhas = 0; u.bloq = 0; u.ultimo = new Date().toISOString();
  await gravarUsuario(env, nome, u);
  return ir('/', setCookie(await criaSessao(env, nome, u), SESSAO_DIAS * 86400));
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname, m = req.method;
    if (!env.DADOS) return json({ error: 'armazenamento não configurado' }, 503);
    if (path === '/entrar') {
      if (m === 'POST') return entrar(req, env, url);
      if (await leSessao(env, cookieDe(req))) return ir('/');
      return paginaLogin('', '');
    }
    if (path === '/sair') return ir('/entrar', setCookie('', 0));
    const ses = await leSessao(env, cookieDe(req));
    if (!ses) {
      if (path.startsWith('/api/')) return json({ error: 'Sua sessão terminou. Entre de novo no RDO' }, 401);
      return ir('/entrar', cookieDe(req) ? setCookie('', 0) : '');
    }
    // envio para a Pasta do RDO (o perfil apontador só envia: não lista, não baixa e não exclui)
    if (path.startsWith('/api/rdo/')) {
      const acao = path.split('/')[3];
      const pode = (acao === 'versao' && m === 'GET') || (acao === 'arquivo' && m === 'PUT') || (acao === 'fim' && m === 'POST');
      if (!pode) return json({ error: 'sem acesso' }, 403);
      return rdoApi(req, env, url, 'apontador', ses.u.email || ('usuário ' + ses.nome));
    }
    if (path.startsWith('/api/')) return json({ error: 'sem acesso' }, 403);
    if ((path === '/' || path === '/rdo' || path === '/rdo.html') && (m === 'GET' || m === 'HEAD')) {
      const res = await env.ASSETS.fetch(new Request(url.origin + '/rdo', { method: m }));   // /rdo.html seria redirecionado para /rdo
      const h = new Headers(res.headers); h.set('cache-control', 'no-store'); Object.entries(SEG).forEach(([k, v]) => h.set(k, v));
      if (ses.exp - Date.now() < SESSAO_DIAS * 864e5 / 2) h.append('set-cookie', setCookie(await criaSessao(env, ses.nome, ses.u), SESSAO_DIAS * 86400));   // renova a sessão de quem usa
      return new Response(res.body, { status: res.status, headers: h });
    }
    // qualquer outro arquivo do repositório fica fora deste endereço
    if ((req.headers.get('accept') || '').includes('text/html')) return ir('/');
    return new Response('não encontrado', { status: 404, headers: { 'cache-control': 'no-store' } });
  }
};
