/* Ponte Joinville — "Pintar peças" no 3D (V1.55)
   Para completar a previsão à mão: liga o modo, escolhe a cor e clica nas peças.
     Até 31/12/2026  → cinza igual às concluídas        Até 30/03/2027 → a cor escolhida em "Cor da previsão"
     cores livres    → para destacar o que quiser       Sem cor        → tira a cor da peça (mesmo a do cronograma)
     Cronograma      → apaga a pintura e volta a usar a data da planilha
   A pintura vale só para o que ainda não foi executado (o realizado continua em cinza).
   Fica salva na nuvem (mesmo armazenamento do avanço da obra), então aparece igual no computador e no celular.
   Cada peça guarda a hora em que foi pintada: se dois aparelhos pintarem ao mesmo tempo, as pinturas se juntam. */
(function () {
  'use strict';
  var KEY = 'ponte-pintura-v55', API = '/api/state';
  var TOOLS = [
    { k: 'c1', l: 'Até 31/12/2026', t: 'Previsto até 31/12/2026 (cinza igual às concluídas)' },
    { k: 'c2', l: 'Até 30/03/2027', t: 'Previsto até 30/03/2027 (cor escolhida em "Cor da previsão")' },
    { k: '#ff9a3c', t: 'Laranja' }, { k: '#ef5350', t: 'Vermelho' }, { k: '#f06292', t: 'Rosa' }, { k: '#42a5f5', t: 'Azul' }, { k: '#26c6da', t: 'Ciano' }, { k: '#66bb6a', t: 'Verde' },
    { k: 'custom', t: 'Outra cor' },
    { k: 'none', l: 'Sem cor', t: 'Tira a cor da peça, inclusive a do cronograma' },
    { k: null, l: 'Cronograma', t: 'Apaga a pintura e volta a usar a data da planilha' }
  ];
  var data = {}, undo = [], mode = false, tool = 'c2', custom = '#9575cd', btn = null, bar = null, canvas = null, down = null, msg = '', serverT = 0, pushing = false, again = false;
  try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); if (o && o.items && typeof o.items === 'object') data = o.items; if (o && /^#[0-9a-f]{6}$/i.test(o.custom || '')) custom = o.custom; } catch (e) {}

  function val(key) { var e = data[key]; return e && e.c ? e.c : null; }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify({ items: data, custom: custom })); } catch (e) {} }
  function count() { var n = 0; for (var k in data) if (data[k] && data[k].c) n++; return n; }
  function refresh() { try { window.__prev53 && window.__prev53.refresh(); } catch (e) {} ui(); }

  // ---------- nuvem ----------
  function merge(items) { var ch = false; for (var k in items) { var b = items[k], a = data[k]; if (!b || typeof b.t !== 'number') continue; if (!a || b.t > a.t) { data[k] = b; ch = true; } } return ch; }
  function pull() {
    return fetch(API + '?full=1&keys=' + KEY, { cache: 'no-store' }).then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null; })
      .then(function (j) { var s = j && j[KEY]; if (!s || s.v == null) return false; serverT = s.t || 0; var o = {}; try { o = JSON.parse(s.v) || {}; } catch (e) {} var ch = merge(o.items || {}); if (ch) saveLocal(); return ch; })
      .catch(function () { return false; });
  }
  function push() {
    if (pushing) { again = true; return; }
    pushing = true;
    pull().then(function () {
      var t = Math.max(Date.now(), serverT + 1);
      return fetch(API + '/' + encodeURIComponent(KEY), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: JSON.stringify({ items: data }), t: t }) })
        .then(function (r) { if (r.ok) serverT = t; else if (r.status === 409) again = true; });
    }).catch(function () { setTimeout(push, 30000); }).then(function () { pushing = false; if (again) { again = false; setTimeout(push, 400); } });
  }
  pull().then(function (ch) { if (ch) refresh(); });
  setInterval(function () { if (document.visibilityState === 'visible' && !pushing) pull().then(function (ch) { if (ch) refresh(); }); }, 90000);

  // ---------- pintar ----------
  function nameOf(key) { try { var r = (window.__v22.rows || []).filter(function (x) { return x.key === key; })[0]; if (r && r.name) return r.name; } catch (e) {} return key; }
  function label(k) { return k === 'c1' ? 'até 31/12/2026' : k === 'c2' ? 'até 30/03/2027' : k === 'none' ? 'sem cor' : k === null ? 'volta ao cronograma' : 'cor livre'; }
  function paint(key) {
    var i = key.indexOf('-'), b = key.slice(0, i), s = key.slice(i + 1), k = tool === 'custom' ? custom : tool;
    if (k !== null && k !== 'none' && window.__prev53 && window.__prev53.pending && window.__prev53.pending(b, s) === 0) { msg = nameOf(key) + ' já está executada'; ui(); return; }
    var prev = data[key] ? { c: data[key].c, t: data[key].t } : null;
    if ((prev && prev.c || null) === k) { msg = nameOf(key) + ' já está assim'; ui(); return; }
    undo.push({ key: key, prev: prev });
    data[key] = { c: k, t: Date.now() };
    msg = nameOf(key) + ' → ' + label(k);
    saveLocal(); refresh(); push();
  }
  function undoLast() {
    var u = undo.pop(); if (!u) return;
    data[u.key] = u.prev ? { c: u.prev.c, t: Date.now() } : { c: null, t: Date.now() };
    msg = 'Desfeito: ' + nameOf(u.key); saveLocal(); refresh(); push();
  }
  var armed = 0;
  function clearAll() {
    if (Date.now() - armed > 4000) { armed = Date.now(); msg = 'Clique de novo em "Limpar" para apagar todas as pinturas'; ui(); return; }
    armed = 0; var t = Date.now(); for (var k in data) if (data[k] && data[k].c) data[k] = { c: null, t: t };
    undo = []; msg = 'Pinturas apagadas: tudo segue o cronograma'; saveLocal(); refresh(); push();
  }
  function setMode(v) {
    mode = !!v; if (mode && window.__oc54 && window.__oc54.mode) window.__oc54.setMode(false);
    if (canvas) canvas.style.cursor = mode ? 'cell' : ''; document.body.classList.toggle('pt55-on', mode);
    if (mode) { msg = ''; clearSel(); } ui();
  }
  function clearSel() { var c = document.getElementById('v22-clear'); if (c && typeof c.onclick === 'function') { try { c.onclick(); } catch (e) {} } }
  function bindCanvas() {
    var el = window.__v22 && window.__v22.controls && window.__v22.controls.domElement;
    if (!el || el === canvas) return;
    canvas = el; if (mode) canvas.style.cursor = 'cell';
    el.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
    // roda depois do clique do próprio 3D (que seleciona a peça): pinta a peça clicada e desfaz a seleção
    el.addEventListener('pointerup', function (e) {
      if (!mode || !down) return;
      var moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6; down = null; if (moved) return;
      var h = null, p = null, key = null;
      try { h = window.__v23.hit(e.clientX, e.clientY); } catch (x) {}
      try { p = window.__prev53 && window.__prev53.pick ? window.__prev53.pick(e.clientX, e.clientY) : null; } catch (x) {}
      if (h && h.object && h.object.userData && h.object.userData.b) key = h.object.userData.b + '-' + h.object.userData.s;
      if (p && (!h || p.distance < h.distance)) key = p.key;
      if (key) paint(key);
      setTimeout(clearSel, 0);
    });
  }

  // ---------- tela ----------
  function c2() { try { return window.__prev53.style.color; } catch (e) { return '#f6d34a'; } }
  function css() {
    if (document.getElementById('pt55-css')) return;
    var s = document.createElement('style'); s.id = 'pt55-css';
    s.textContent = 'body.pt55-on #fc50{display:none!important}body.pt55-on #oc54-bar{bottom:118px}' +
      '#pt55-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:7;width:max-content;max-width:calc(100% - 24px);padding:9px 11px;border-radius:12px;background:#11151bee;border:1px solid #ffffff26;color:#eef1f5;font:12.5px var(--f34,system-ui);box-shadow:0 10px 30px #0008;backdrop-filter:blur(8px)}#pt55-bar[hidden]{display:none}' +
      '#pt55-bar .r{display:flex;align-items:center;gap:6px;flex-wrap:wrap}#pt55-bar .r+.r{margin-top:8px}#pt55-bar b{font-weight:650;margin-right:4px}#pt55-bar .m{flex:1;min-width:160px;color:#c3cad2}' +
      '#pt55-bar button{font:inherit;font-size:12px;border:1px solid #ffffff33;background:#ffffff12;color:#eef1f5;border-radius:8px;padding:5px 9px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}#pt55-bar button:disabled{opacity:.45;cursor:default}' +
      '#pt55-bar button[aria-pressed=true]{border-color:#FDB900;box-shadow:0 0 0 1px #FDB900 inset;background:#FDB90022}#pt55-bar button.sw{width:28px;height:26px;padding:0;justify-content:center}#pt55-bar i{display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid #0006}#pt55-bar button.sw i{width:16px;height:16px}' +
      '#pt55-bar button.ok{background:#FDB900;border-color:#FDB900;color:#151515;font-weight:650}#pt55-bar input[type=color]{position:absolute;opacity:0;width:0;height:0;pointer-events:none}' +
      '@media (max-width:760px){#pt55-bar{left:6px;right:6px;bottom:6px;transform:none;width:auto;max-width:none;padding:6px 7px;font-size:11.5px}body.pt55-on #oc54-bar{display:none}#pt55-bar .r{flex-wrap:nowrap;gap:5px}#pt55-bar .r:first-child{overflow-x:auto;scrollbar-width:none;padding-bottom:1px}#pt55-bar .r:first-child::-webkit-scrollbar{display:none}#pt55-bar .r+.r{margin-top:6px}#pt55-bar button{flex:none;font-size:11.5px;padding:4px 7px}#pt55-bar button.sw{width:26px;height:24px}#pt55-bar b{display:none}#pt55-bar .m{min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#pt55-bar button[data-a=clear]{display:none}}';
    document.head.append(s);
  }
  function mount() {
    var f = document.getElementById('v23-focus'); if (!f) return;
    if (!btn || !btn.isConnected) {
      btn = document.createElement('button'); btn.type = 'button'; btn.id = 'pt55-btn'; btn.className = f.className;
      btn.title = 'Pintar peças à mão para completar a previsão';
      btn.onclick = function () { setMode(!mode); };
      var after = document.getElementById('oc54-btn') || document.getElementById('pc54-btn') || document.getElementById('pv53-btn') || f; after.after(btn); ui();
    }
    var pad = document.getElementById('pad50'), host = pad ? pad.parentElement : null;
    if (host && (!bar || bar.parentElement !== host)) { css(); if (!bar) { bar = document.createElement('div'); bar.id = 'pt55-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Pintar peças'); } host.append(bar); ui(); }
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ui() {
    var n = count();
    if (btn) { btn.setAttribute('aria-pressed', String(mode)); btn.textContent = (innerWidth < 760 ? 'Pintar' : 'Pintar peças') + (n ? ' (' + n + ')' : ''); }
    if (!bar) return;
    bar.hidden = !mode; if (!mode) return;
    var col = c2();
    bar.innerHTML = '<div class="r"><b>Pintar</b>' + TOOLS.map(function (t, i) {
      var k = t.k, sel = k === tool ? 'true' : 'false', sw = k === 'c1' ? '#969ba0' : k === 'c2' ? col : k === 'custom' ? custom : k && k[0] === '#' ? k : null;
      var lb = t.l && innerWidth < 760 ? (k === 'c1' ? '31/12' : k === 'c2' ? '30/03' : t.l) : t.l;
      var inner = (sw ? '<i style="background:' + sw + (k === 'custom' ? ';outline:2px dashed #fff6;outline-offset:1px' : '') + '"></i>' : '') + (lb ? esc(lb) : '');
      return '<button type="button" data-i="' + i + '" class="' + (t.l ? '' : 'sw') + '" title="' + esc(t.t) + '" aria-label="' + esc(t.t) + '" aria-pressed="' + sel + '">' + inner + '</button>';
    }).join('') + '<input type="color" aria-label="Escolher outra cor" value="' + custom + '"></div>' +
      '<div class="r"><span class="m">' + esc(msg || 'Escolha a cor e clique nas peças.') + '</span><button type="button" data-a="undo"' + (undo.length ? '' : ' disabled') + '>Desfazer</button><button type="button" data-a="clear"' + (n ? '' : ' disabled') + '>Limpar' + (n ? ' (' + n + ')' : '') + '</button><button type="button" class="ok" data-a="done">Concluir</button></div>';
    var inp = bar.querySelector('input[type=color]');
    inp.oninput = function () { custom = inp.value; tool = 'custom'; saveLocal(); var b2 = bar.querySelector('button[data-i="8"] i'); if (b2) b2.style.background = custom; bar.querySelectorAll('button[data-i]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.i === '8')); }); };
    inp.onchange = function () { ui(); };
    bar.querySelectorAll('button[data-i]').forEach(function (x) { x.onclick = function () { var t = TOOLS[+x.dataset.i]; if (t.k === 'custom') { tool = 'custom'; inp.click(); ui(); return; } tool = t.k; ui(); }; });
    bar.querySelectorAll('button[data-a]').forEach(function (x) { x.onclick = function () { var a = x.dataset.a; if (a === 'undo') undoLast(); else if (a === 'clear') clearAll(); else if (a === 'done') setMode(false); }; });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mode && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) setMode(false); });
  setInterval(function () { if (window.__v40 && window.__v40.scene) { mount(); bindCanvas(); } }, 400);
  window.__pt55 = { get: val, get mode() { return mode; }, setMode: setMode, get items() { return JSON.parse(JSON.stringify(data)); }, setTool: function (k) { tool = k; ui(); }, paint: paint, undo: undoLast, pull: pull };
})();
