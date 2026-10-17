/* Ponte Joinville — sincronização dos dados entre aparelhos (Cloudflare KV via /api/state).
   Carregado no <head>, antes do app: puxa do servidor o que estiver mais novo para o armazenamento do navegador
   e, a cada gravação do app nessas chaves, envia a versão nova para o servidor. Sem internet, tudo segue local. */
(function () {
  var me = document.currentScript, KEYS = ((me && me.getAttribute('data-keys')) || '').split(',').filter(Boolean);
  if (!KEYS.length || !window.localStorage || location.protocol === 'file:') return;
  var API = '/api/state', MT = '__sync_t:', LS = window.localStorage, P = Storage.prototype;
  var rawSet = P.setItem, rawGet = P.getItem;
  var st = { ok: false, pulled: [], pushed: [], pending: {}, unsynced: [], error: '' }; window.__sync = st;
  function lt(k) { try { return +rawGet.call(LS, MT + k) || 0; } catch (e) { return 0; } }
  function setT(k, t) { try { rawSet.call(LS, MT + k, String(t)); } catch (e) {} }
  function has(k) { try { return rawGet.call(LS, k) != null; } catch (e) { return false; } }
  function xget(q) { var x = new XMLHttpRequest(); x.open('GET', API + '?' + q, false); x.setRequestHeader('cache-control', 'no-store'); x.send(); if (x.status !== 200 || !/json/.test(x.getResponseHeader('content-type') || '')) throw Error('HTTP ' + x.status); return JSON.parse(x.responseText); }

  // 1) ao abrir: metadados (leve) e depois só os valores que estão mais novos no servidor
  try {
    var meta = xget('keys=' + KEYS.join(',')), need = [];
    st.ok = true;
    KEYS.forEach(function (k) { var s = meta[k], l = lt(k);
      if (s && s.t > l) need.push(k);
      else if (has(k) && s && l > s.t) st.pending[k] = 1;          // alterado aqui sem internet → enviar
      else if (has(k) && !s && !l) st.unsynced.push(k); });         // dados antigos deste aparelho: só envia se o usuário confirmar
    if (need.length) { var full = xget('full=1&keys=' + need.join(','));
      need.forEach(function (k) { var s = full[k]; if (s && s.v != null) { try { rawSet.call(LS, k, s.v); setT(k, s.t); st.pulled.push(k); } catch (e) { st.error = 'sem espaço no navegador'; } } }); }
  } catch (e) { st.error = String(e.message || e); }

  // 2) gravações do app nessas chaves → envio (agrupado em 2,5 s)
  var timers = {};
  var t0 = Date.now();
  P.setItem = function (k, v) { var mine = this === LS && KEYS.indexOf(k) >= 0, old = mine ? rawGet.call(LS, k) : null; rawSet.call(this, k, v);
    // gravações automáticas da abertura da página (primeiros 8 s) e regravações sem mudança não contam como alteração
    if (mine && old !== v && Date.now() - t0 > 8000) { setT(k, Date.now()); st.pending[k] = 1; clearTimeout(timers[k]); timers[k] = setTimeout(function () { push(k); }, 2500); } };
  function push(k) { var v; try { v = rawGet.call(LS, k); } catch (e) { return; } if (v == null) return;
    var t = lt(k) || Date.now();
    fetch(API + '/' + encodeURIComponent(k), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: v, t: t }), keepalive: v.length < 60000 })
      .then(function (r) { if (r.status === 409) { delete st.pending[k]; banner('Este dado foi alterado em outro aparelho.', true); return; } if (!r.ok) throw Error('HTTP ' + r.status); delete st.pending[k]; st.pushed.push(k); toast(); })
      .catch(function () { st.retry = true; setTimeout(function () { if (st.pending[k]) push(k); }, 30000); }); }
  function flush() { for (var k in st.pending) { clearTimeout(timers[k]); push(k); } }
  setTimeout(flush, 1500);   // alterações feitas sem internet
  if (st.ok && st.unsynced.length) document.addEventListener('DOMContentLoaded', function () { setTimeout(function () {
    banner('Os dados deste aparelho ainda não estão na nuvem. Se este é o aparelho com o avanço certo, envie para todos verem o mesmo.', false, 'Enviar para a nuvem', function () {
      var now = Date.now(); st.unsynced.forEach(function (k) { setT(k, now); st.pending[k] = 1; }); st.unsynced = []; flush(); }); }, 2500); });
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { for (var k in timers) clearTimeout(timers[k]); flush(); } else check(); });

  // 3) aviso quando outro aparelho gravar algo novo
  function check() { if (!st.ok) return; fetch(API + '?keys=' + KEYS.join(','), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
    if (!m) return; for (var i = 0; i < KEYS.length; i++) { var k = KEYS[i], s = m[k]; if (s && s.t > lt(k) && !st.pending[k]) { banner('Há dados novos enviados de outro aparelho' + (s.by ? ' (' + s.by + ')' : '') + '.', true); return; } } }).catch(function () {}); }
  setInterval(function () { if (document.visibilityState === 'visible') check(); }, 120000);

  // interface mínima
  var css = '#sync-bn{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);padding:10px 12px 10px 14px;border-radius:10px;background:#151a21;color:#e8e5de;border:1px solid #FDB90066;box-shadow:0 12px 40px #0009;font:13px/1.35 system-ui,-apple-system,Segoe UI,sans-serif}#sync-bn button{font:inherit;font-weight:600;border:0;border-radius:7px;padding:7px 12px;background:#FDB900;color:#151515;cursor:pointer;white-space:nowrap}#sync-bn .x{background:none;color:#9aa3ab;padding:4px 6px;font-weight:400}#sync-tt{position:fixed;right:14px;bottom:14px;z-index:2147483000;padding:6px 10px;border-radius:999px;background:#151a21e6;color:#bfe3c9;border:1px solid #2b6047;font:12px system-ui,sans-serif;opacity:0;transition:opacity .4s;pointer-events:none}';
  function ensureCss() { if (document.getElementById('sync-css')) return; var s = document.createElement('style'); s.id = 'sync-css'; s.textContent = css; (document.head || document.documentElement).appendChild(s); }
  function banner(msg, reload, label, act) { if (!document.body) return; ensureCss(); var b = document.getElementById('sync-bn'); if (!b) { b = document.createElement('div'); b.id = 'sync-bn'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.innerHTML = '<span></span>' + (reload || label ? '<button type="button"></button>' : '') + '<button type="button" class="x" aria-label="Fechar">✕</button>';
    b.firstChild.textContent = msg; var bt = b.querySelectorAll('button'); if (reload) { bt[0].textContent = 'Atualizar'; bt[0].onclick = function () { location.reload(); }; }
    else if (label) { bt[0].textContent = label; bt[0].onclick = function () { b.remove(); act(); }; } bt[bt.length - 1].onclick = function () { b.remove(); }; }
  var tt; function toast() { if (!document.body) return; ensureCss(); var e = document.getElementById('sync-tt'); if (!e) { e = document.createElement('div'); e.id = 'sync-tt'; e.textContent = '✓ Salvo na nuvem'; document.body.appendChild(e); } e.style.opacity = 1; clearTimeout(tt); tt = setTimeout(function () { e.style.opacity = 0; }, 1800); }
  if (st.pulled.length) document.addEventListener('DOMContentLoaded', function () { ensureCss(); var e = document.createElement('div'); e.id = 'sync-tt'; e.textContent = '✓ Dados atualizados da nuvem'; document.body.appendChild(e); setTimeout(function () { e.style.opacity = 1; }, 50); setTimeout(function () { e.style.opacity = 0; }, 2600); });
})();
