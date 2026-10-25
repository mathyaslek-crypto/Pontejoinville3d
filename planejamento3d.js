/* Ponte Joinville — Planejamento de cenários (V1.66)
   Página /planejamento: o mesmo 3D da produção, mas só para criar e visualizar cenários. Nada do que se mexe aqui muda
   o 3D de produção (/3d), que continua mostrando a obra real.
   Cada cenário tem: nome, data de corte, base (do zero = só as peças já concretadas, ou um cronograma: AP.11 com estaca
   de 800 / de 1200), pintura das peças, posição dos cantitravels e dos carros de avanço (treliças), vigas lançadas pela
   treliça lançadeira e aparência do 3D. Ficam na nuvem, iguais em todos os computadores, e qualquer um pode editar.
   Como funciona: este arquivo roda antes do 3D e separa o armazenamento do navegador por cenário (as preferências e
   posições que o 3D grava vão para o cenário aberto); os dados da obra (planilha, RDO, cronograma) são lidos da
   produção e nunca alterados. Trocar de cenário recarrega a página com o cenário escolhido. */
(function () {
  'use strict';
  var PUB = window.__pub58 || null;
  var CLOUD = 'ponte-planejamento-v66', IDX = 'pl66-index', LAST = 'pl66-last', API = '/api/state';
  var LS = null; try { LS = window.localStorage; } catch (e) {}
  if (!LS) return;
  var Pp = Storage.prototype, oGet = Pp.getItem, oSet = Pp.setItem, oRem = Pp.removeItem;
  function rget(k) { try { return oGet.call(LS, k); } catch (e) { return null; } }
  function rset(k, v) { try { oSet.call(LS, k, v); return true; } catch (e) { return false; } }
  function rrem(k) { try { oRem.call(LS, k); } catch (e) {} }
  function allKeys() { var o = []; try { for (var i = 0; i < LS.length; i++) o.push(LS.key(i)); } catch (e) {} return o; }
  // dados da obra: lidos da produção, nunca gravados daqui · preferências do aparelho: normais
  var PASS = /^(ponte-obra-v26|aduelas-registros-v2|ponte-rdo-v35|ponte-prelaje-v48|ponte-plano-v50|ponte-hist-v50|ponte-rdo-pasta.*|aduelas-offline|alya-.*|__sync_t:.*|pl66.*|sync-.*)$/;
  var DEVICE = /^(ponte-modo)$/;
  function NSof(id) { return 'pl66:' + id + ':'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function br(d) { return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : ''; }
  var BASES = { zero: 'Do zero (só as peças já concretadas)', 'ap11-800': 'Cronograma AP.11 com estaca de 800', original: 'Cronograma AP.11 com estaca de 1200' };
  function baseName(b) { try { var s = window.__cronData59; if (s && b !== 'zero') for (var i = 0; i < s.bases.length; i++) if (s.bases[i].id === b) return 'Cronograma ' + s.bases[i].nome; } catch (e) {} return BASES[b] || BASES.zero; }

  // ---------- lista de cenários (cache deste aparelho + nuvem) ----------
  var idx = {}; try { idx = JSON.parse(rget(IDX) || '{}') || {}; } catch (e) { idx = {}; }
  function saveIdx() { rset(IDX, JSON.stringify(idx)); }
  function clearNS(id) { var p = NSof(id); allKeys().forEach(function (k) { if (k.indexOf(p) === 0) rrem(k); }); }
  function collect(id) { var p = NSof(id), o = {}; allKeys().forEach(function (k) { if (k.indexOf(p) === 0) { var v = rget(k); if (v != null && v.length < 400000) o[k.slice(p.length)] = v; } }); return o; }
  function applyCloud(blob) {
    var sc = (blob && blob.sc) || {}, ch = {};
    for (var id in sc) {
      var c = sc[id], l = idx[id]; if (!c || typeof c.t !== 'number') continue;
      if (!l || c.t > (l.t || 0)) {
        idx[id] = { nome: c.nome, data: c.data, base: c.base, criado: c.criado, t: c.t, pt: c.t, del: !!c.del };
        clearNS(id); if (!c.del && c.ls) for (var k in c.ls) rset(NSof(id) + k, c.ls[k]);
        ch[id] = 1;
      } else if (c.t === l.t) l.pt = c.t;
    }
    saveIdx(); return ch;
  }
  var prodCT = null, serverT = 0, cloudOK = false;
  if (!PUB && location.protocol !== 'file:') {
    try {   // antes do 3D abrir: traz da nuvem os cenários (como faz o sync.js com os dados da obra)
      var x = new XMLHttpRequest(); x.open('GET', API + '?full=1&keys=' + CLOUD + ',ponte-cantitravel-v62', false); x.setRequestHeader('cache-control', 'no-store'); x.send();
      if (x.status === 200 && /json/.test(x.getResponseHeader('content-type') || '')) {
        var j = JSON.parse(x.responseText); cloudOK = true;
        if (j[CLOUD] && j[CLOUD].v != null) { serverT = j[CLOUD].t || 0; applyCloud(JSON.parse(j[CLOUD].v)); }
        if (j['ponte-cantitravel-v62'] && j['ponte-cantitravel-v62'].v != null) prodCT = j['ponte-cantitravel-v62'].v;
      }
    } catch (e) {}
  }
  function live(id) { return !!(id && idx[id] && !idx[id].del); }
  function ordered() { return Object.keys(idx).filter(live).sort(function (a, b) { return (idx[a].criado || 0) - (idx[b].criado || 0); }); }
  var q = null; try { q = new URLSearchParams(location.search).get('c'); } catch (e) {}
  var cur = live(q) ? q : live(rget(LAST)) ? rget(LAST) : (ordered().slice(-1)[0] || null);
  var PLAN;
  if (PUB && PUB.plan) PLAN = PUB.plan;
  else if (cur) PLAN = { id: cur, nome: idx[cur].nome, data: idx[cur].data, base: idx[cur].base || 'zero' };
  else PLAN = { id: '_vazio', nome: 'Nenhum cenário criado', data: new Date().getFullYear() + '-12-31', base: 'zero', vazio: true };
  window.__plan66 = PLAN;
  if (!PUB && cur) { rset(LAST, cur); try { if (q !== cur) history.replaceState(null, '', location.pathname + '?c=' + encodeURIComponent(cur)); } catch (e) {} }
  var NS = NSof(PLAN.id);

  // ---------- armazenamento separado por cenário ----------
  var mem = {};
  function iso(k) { return !PASS.test(k) && !DEVICE.test(k); }
  Pp.getItem = function (k) {
    if (this !== LS || !iso(String(k))) return oGet.apply(this, arguments);
    k = String(k);
    if (PUB) { if (Object.prototype.hasOwnProperty.call(mem, k)) return mem[k]; return PUB.ls && Object.prototype.hasOwnProperty.call(PUB.ls, k) ? PUB.ls[k] : null; }
    return oGet.call(this, NS + k);
  };
  Pp.setItem = function (k, v) {
    if (this !== LS) return oSet.apply(this, arguments);
    k = String(k);
    if (DEVICE.test(k) || /^pl66/.test(k)) return oSet.apply(this, arguments);
    if (!iso(k)) return;                                  // dados da obra: o planejamento não grava
    v = String(v);
    if (PUB) { mem[k] = v; return; }
    var old = oGet.call(this, NS + k); oSet.call(this, NS + k, v);
    if (old !== v) touch();
  };
  Pp.removeItem = function (k) {
    if (this !== LS) return oRem.apply(this, arguments);
    k = String(k);
    if (DEVICE.test(k) || /^pl66/.test(k)) return oRem.apply(this, arguments);
    if (!iso(k)) return;
    if (PUB) { delete mem[k]; return; }
    if (oGet.call(this, NS + k) != null) { oRem.call(this, NS + k); touch(); }
  };

  // ---------- nuvem ----------
  var pushing = false, again = false, pushT = null, lastPush = 0, remoteMsg = '';
  function touch() { if (PUB || PLAN.vazio || !idx[PLAN.id]) return; idx[PLAN.id].t = Date.now(); saveIdx(); clearTimeout(pushT); pushT = setTimeout(push, 2500); }
  function pullBlob() {
    if (PUB) return Promise.resolve(null);
    return fetch(API + '?full=1&keys=' + CLOUD, { cache: 'no-store' }).then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null; })
      .then(function (j) { if (!j) return null; cloudOK = true; var s = j[CLOUD]; if (!s || s.v == null) return { sc: {} }; serverT = Math.max(serverT, s.t || 0); try { return JSON.parse(s.v) || { sc: {} }; } catch (e) { return { sc: {} }; } })
      .catch(function () { return null; });
  }
  function pull() {
    return pullBlob().then(function (b) {
      if (!b) return; var ch = applyCloud(b);
      if (ch[PLAN.id] && !PLAN.vazio) remoteChanged();
      if (!live(PLAN.id) && !PLAN.vazio) { remoteMsg = 'Este cenário foi apagado em outro computador.'; }
      ui();
    });
  }
  function remoteChanged() { remoteMsg = 'Este cenário foi alterado em outro computador.'; ui(); }
  function push() {
    if (PUB) return; if (pushing) { again = true; return; }
    pushing = true;
    pullBlob().then(function (blob) {
      if (!blob) throw Error('sem nuvem');
      var ch = applyCloud(blob); if (ch[PLAN.id] && !PLAN.vazio) remoteChanged();
      var sc = blob.sc || {}, any = false;
      for (var id in idx) {
        var e = idx[id]; if ((e.t || 0) <= (e.pt || 0)) continue;
        sc[id] = { nome: e.nome, data: e.data, base: e.base, criado: e.criado, t: e.t, del: !!e.del, ls: e.del ? null : collect(id) }; any = true;
      }
      if (!any) return;
      var t = Math.max(Date.now(), serverT + 1);
      return fetch(API + '/' + encodeURIComponent(CLOUD), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: JSON.stringify({ sc: sc }), t: t }) })
        .then(function (r) {
          if (r.ok) { serverT = t; for (var id2 in sc) if (idx[id2] && sc[id2].t === idx[id2].t) idx[id2].pt = idx[id2].t; saveIdx(); lastPush = Date.now(); ui(); }
          else if (r.status === 409) again = true;
        });
    }).catch(function () { setTimeout(push, 30000); }).then(function () { pushing = false; if (again) { again = false; setTimeout(push, 500); } });
  }

  // ---------- criar, duplicar, renomear, data de corte, apagar ----------
  var SEED = ['ponte-placas-aduela', 'ponte-prelaje-vis48', 'ponte-bonecos-v58', 'ponte-barco-v58', 'ponte-vigas-v57', 'ponte-aduelas-v58', 'ponte-prelajes-v58', 'ponte-previsao-cor-v54', 'ponte-eixos-v56', 'ponte-clima-v52', 'ponte-aparencia-v66'];
  function newId() { return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function go(id) { location.href = location.pathname + (id ? '?c=' + encodeURIComponent(id) : ''); }
  function finish(id) { push(); setTimeout(function () { go(id); }, 900); }
  function create(nome, data, base) {
    var id = newId(), ns = NSof(id), t = Date.now();
    snapAppearance();
    SEED.forEach(function (k) { var v = rget(NS + k); if (v == null && PLAN.vazio) v = rget(k); if (v != null) rset(ns + k, v); });
    var tr = rget('ponte-trelicas-v41'); if (tr != null) rset(ns + 'ponte-trelicas-v41', tr);          // carros de avanço como estão na produção
    var ct = prodCT || rget('ponte-cantitravel-v62'); if (ct != null) rset(ns + 'ponte-cantitravel-v62', ct);   // cantitravels como estão hoje
    rset(ns + 'ponte-previsao-v53', '1'); rset(ns + 'ponte-cor-prazo-v50', '0');
    idx[id] = { nome: String(nome).slice(0, 60), data: data, base: BASES[base] ? base : 'zero', criado: t, t: t, pt: 0 }; saveIdx();
    finish(id); return id;
  }
  function duplicate(src) {
    if (!live(src)) return null; if (src === PLAN.id) snapAppearance();
    var id = newId(), t = Date.now(), from = NSof(src), to = NSof(id);
    allKeys().forEach(function (k) { if (k.indexOf(from) === 0) rset(to + k.slice(from.length), rget(k)); });
    var s = idx[src]; idx[id] = { nome: ('Cópia de ' + s.nome).slice(0, 60), data: s.data, base: s.base, criado: t, t: t, pt: 0 }; saveIdx();
    finish(id); return id;
  }
  function rename(id, nome) { if (!live(id) || !String(nome).trim()) return; idx[id].nome = String(nome).trim().slice(0, 60); idx[id].t = Date.now(); saveIdx(); if (id === PLAN.id) { PLAN.nome = idx[id].nome; refresh(); } push(); ui(); }
  function setData(id, data) {
    if (!live(id) || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return; idx[id].data = data; idx[id].t = Date.now(); saveIdx();
    if (id === PLAN.id) { PLAN.data = data; refresh(); } push(); ui();
  }
  function remove(id) {
    if (!live(id)) return; idx[id].del = true; idx[id].t = Date.now(); saveIdx(); clearNS(id); push();
    if (id === PLAN.id) { var o = ordered(); setTimeout(function () { go(o.slice(-1)[0] || null); }, 900); }
    ui();
  }
  function refresh() {
    try { window.__prev53 && window.__prev53.refresh(); } catch (e) {}
    try { window.__pt55 && window.__pt55.refresh && window.__pt55.refresh(); } catch (e) {}
    try { document.title = 'Planejamento · ' + PLAN.nome; } catch (e) {}
  }

  // ---------- aparência do 3D (o 3D não guarda estas opções; aqui ficam no cenário) ----------
  var AP_IDS = ['av-soil', 'av-ghost', 'av-environment', 'av-bars', 'av-crane-choice'], AP_KEY = 'ponte-aparencia-v66', apDone = {}, apSaved = null, restoring = false;
  try { apSaved = JSON.parse(localStorage.getItem(AP_KEY) || 'null'); } catch (e) {}
  function snapAppearance() {
    if (PUB || restoring) return; var o = {};
    AP_IDS.forEach(function (id) { var el = document.getElementById(id); if (el) o[id] = el.type === 'checkbox' ? el.checked : el.value; });
    if (Object.keys(o).length) { try { localStorage.setItem(AP_KEY, JSON.stringify(o)); } catch (e) {} }
  }
  document.addEventListener('change', function (e) { var t = e.target; if (t && t.id && AP_IDS.indexOf(t.id) >= 0 && !restoring) snapAppearance(); }, true);
  var readyAt = 0;
  function restoreAppearance() {
    if (!apSaved) return true;
    var all = true;
    AP_IDS.forEach(function (id) {
      if (apDone[id] || !(id in apSaved)) return;
      var el = document.getElementById(id); if (!el) { all = false; return; }
      var want = apSaved[id], has = el.type === 'checkbox' ? el.checked : el.value;
      if (has !== want) { restoring = true; try { if (el.type === 'checkbox') el.checked = !!want; else el.value = want; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} restoring = false; }
      apDone[id] = 1;
    });
    return all;
  }

  // ---------- treliça lançadeira: vigas lançadas até a data de corte ----------
  var SPANS = [['GBV_P1', '15-16'], ['GB14_15', '14-15'], ['GB13_14', '13-14'], ['GB12_13', '12-13'], ['GB11_12', '11-12']];
  var beamCache = null, beamSig = '';
  function findPx() { var sc = window.__v40 && window.__v40.scene, px = null; if (sc) sc.traverse(function (o) { if (!px && o.name === 'Peças para seleção') px = o; }); return px; }
  function beams() {
    var px = findPx(); if (!px) return null;
    var sig = px.uuid + ':' + px.children.length; if (beamCache && sig === beamSig) return beamCache;
    var list = [], seen = {}, exec = {};
    px.children.forEach(function (c) {
      var u = c.userData || {}, b = String(u.b || ''), s = String(u.s || ''); if (b !== '10.1' && b !== '10.2') return;
      var m = c.material; if (m && m.color && !m.transparent && !(m.opacity < 0.99) && m.color.getHex() !== 0xf2cd31) exec[b + '-' + s] = 1;
      for (var i = 0; i < SPANS.length; i++) if (s.indexOf(SPANS[i][0] + '_') === 0) {
        var k = b + '-' + s; if (seen[k]) break; seen[k] = 1;
        list.push({ k: k, b: b, s: s, span: i, vao: SPANS[i][1], n: parseInt(s.slice(SPANS[i][0].length + 1), 10) || 0 }); break;
      }
    });
    list.sort(function (a, b) { return a.span - b.span || (a.b < b.b ? -1 : a.b > b.b ? 1 : 0) || a.n - b.n; });
    list.forEach(function (x) { x.exec = !!exec[x.k]; });
    beamSig = sig; return (beamCache = list);
  }
  function paintOf(k) { try { return window.__pt55 ? window.__pt55.get(k) : null; } catch (e) { return null; } }
  function launched() { var L = beams(); if (!L) return null; var n = 0, next = null; L.forEach(function (x) { if (x.exec || paintOf(x.k) === 'c1') n++; else if (!next) next = x; }); return { n: n, total: L.length, next: next }; }
  function launchStep(dir) {
    var L = beams(), pt = window.__pt55; if (!L || !pt || !pt.setMany) return;
    if (dir > 0) { for (var i = 0; i < L.length; i++) if (!L[i].exec && paintOf(L[i].k) !== 'c1') { var o = {}; o[L[i].k] = 'c1'; pt.setMany(o); break; } }
    else { for (var j = L.length - 1; j >= 0; j--) if (!L[j].exec && paintOf(L[j].k) === 'c1') { var o2 = {}; o2[L[j].k] = null; pt.setMany(o2); break; } }
    setTimeout(ui, 50);
  }

  // ---------- painel "Planejamento · cenários" (logo abaixo do 3D) ----------
  var box = null, editing = null, confirmDel = null;
  function css() {
    if (document.getElementById('pl66-css')) return;
    var s = document.createElement('style'); s.id = 'pl66-css';
    s.textContent = '#pl66{margin:4px 8px 12px;padding:12px 14px;border:1px solid #fdb90055;border-radius:8px;background:linear-gradient(180deg,#171d27,#10151c);color:#e8e5de;font:13px var(--f34,system-ui)}' +
      '#pl66 header{background:none!important;padding:0!important;border:0!important;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;margin-bottom:8px}#pl66 header b{color:#FDB900;font-size:14px}#pl66 header span{color:#9aa3ab;font-size:12px}#pl66 header em{margin-left:auto;font-style:normal;font-size:11.5px;color:#8fd3a5}' +
      '#pl66 .cur{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 12px;border-radius:8px;background:#fdb9000f;border:1px solid #fdb90040}#pl66 .cur .nm{flex:1;min-width:240px;display:flex;flex-direction:column;gap:3px}#pl66 .cur small{color:#c7b26a;font-size:11px;letter-spacing:.06em;text-transform:uppercase}#pl66 .cur b{font-size:15px}#pl66 .cur span{color:#b9c1c8;font-size:12px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}' +
      '#pl66 button,#pl66 select{font:inherit;font-size:12px;padding:6px 11px;border-radius:5px;border:1px solid #ffffff30;background:#ffffff0d;color:#dfe5ea;cursor:pointer}#pl66 button.main{border-color:#FDB900;background:#FDB900;color:#151515;font-weight:600}#pl66 button.dg{border-color:#ef535088;color:#ffb4b0}#pl66 button:disabled{opacity:.4;cursor:default}' +
      '#pl66 input[type=date],#pl66 input[type=text]{font:inherit;font-size:12.5px;padding:5px 8px;border-radius:5px;border:1px solid #ffffff30;background:#0e1319;color:#fff;color-scheme:dark}#pl66 input:focus{outline:2px solid #FDB900;outline-offset:1px}' +
      '#pl66 .ln{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:9px 0 2px;font-size:12.5px;color:#c3cad2}#pl66 .ln b{color:#fff}#pl66 .ln small{color:#9aa3ab}' +
      '#pl66 .gr{margin:12px 0 4px;color:#8f99a4;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}' +
      '#pl66 .it{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:7px 0;border-top:1px solid #ffffff12}#pl66 .it .tx{flex:1;min-width:200px}#pl66 .it .tx b{display:block;font-weight:600}#pl66 .it .tx small{color:#9aa4ae;font-size:11.5px}#pl66 .it.on .tx b::after{content:" · aberto";color:#FDB900;font-weight:500}#pl66 .it .bt{display:flex;flex-wrap:wrap;gap:5px}' +
      '#pl66 .new{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px 22px;align-items:start;padding:8px 0 2px}#pl66 .new .fs{display:flex;flex-direction:column;gap:10px}' +
      '#pl66 .new label{display:flex!important;flex-direction:column!important;gap:4px;font-size:12px;color:#c3cad2;margin:0!important;padding:0!important;min-height:0!important}#pl66 .new .fs input{width:100%;max-width:300px;box-sizing:border-box}' +
      '#pl66 .new .bs{display:flex;flex-direction:column;gap:7px}#pl66 .new .bs>span{font-size:12px;color:#c3cad2}#pl66 .new .bs label{flex-direction:row!important;align-items:center;gap:8px;font-size:12.5px;color:#e8e5de}#pl66 .new input[type=radio]{accent-color:#FDB900;margin:0;width:15px;height:15px}#pl66 .new .go{align-self:end;justify-self:start}' +
      '#pl66 .msg{margin-top:8px;padding:7px 10px;border-radius:6px;background:#0b0e12;border:1px solid #ffe08a55;font-size:12.5px;color:#ffe08a;display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
      '.pl66-tag{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#FDB900;color:#151515;font-size:11px;font-weight:700;letter-spacing:.04em;vertical-align:middle}';
    document.head.append(s);
  }
  function mount() {
    var sc = document.getElementById('av-scene'); if (!sc) return;
    css();
    if (!box) {
      box = document.createElement('section'); box.id = 'pl66'; box.setAttribute('aria-label', 'Planejamento de cenários');
      box.addEventListener('click', onClick); box.addEventListener('change', onChange);
      box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('input[type=text]')) { var b = e.target.closest('.it,.new') && e.target.closest('.it,.new').querySelector('button.main'); if (b) b.click(); } });
    }
    if (box.previousElementSibling !== sc) { sc.after(box); ui(); }
  }
  function onClick(e) {
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var a = b.dataset.a, id = b.dataset.id;
    if (a === 'open') go(id);
    else if (a === 'dup') duplicate(id);
    else if (a === 'ren') { editing = id; confirmDel = null; ui(); var i = box.querySelector('[data-edit]'); if (i) { i.focus(); i.select(); } }
    else if (a === 'ren-ok') { var inp = box.querySelector('[data-edit]'); rename(id, inp ? inp.value : ''); editing = null; ui(); }
    else if (a === 'cancel') { editing = null; confirmDel = null; ui(); }
    else if (a === 'del') { confirmDel = id; editing = null; ui(); }
    else if (a === 'del-ok') { confirmDel = null; remove(id); }
    else if (a === 'create') {
      var nm = box.querySelector('#pl66-nome'), dt = box.querySelector('#pl66-data-new'), bs = box.querySelector('input[name=pl66-base]:checked');
      var nome = (nm && nm.value || '').trim(), data = dt && dt.value;
      if (!nome) { nm.focus(); flash('Dê um nome ao cenário.'); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) { dt.focus(); flash('Escolha a data de corte do cenário.'); return; }
      b.disabled = true; b.textContent = 'Criando…'; create(nome, data, bs ? bs.value : 'zero');
    }
    else if (a === 'pub') { var p = document.getElementById('av-publish'); if (p) p.click(); else flash('O botão de publicar ainda não carregou; tente de novo em alguns segundos.'); }
    else if (a === 'lan+') launchStep(1);
    else if (a === 'lan-') launchStep(-1);
    else if (a === 'reload') location.reload();
  }
  function onChange(e) { var t = e.target; if (t.id === 'pl66-data-cur' && t.value) setData(PLAN.id, t.value); }
  var flashMsg = '', flashT = null;
  function flash(m) { flashMsg = m; ui(); clearTimeout(flashT); flashT = setTimeout(function () { flashMsg = ''; ui(); }, 5000); }
  function ui() {
    if (!box) return;
    var list = ordered(), h = '', L = PUB ? null : launched();
    h += '<header><b>Planejamento · cenários</b><span>Separado da produção: o que você mexe aqui fica só no cenário aberto</span><em>' + (PUB ? '' : lastPush && Date.now() - lastPush < 8000 ? '✓ Salvo na nuvem' : cloudOK ? 'Igual em todos os computadores' : '') + '</em></header>';
    if (PLAN.vazio && !PUB) h += '<div class="cur"><div class="nm"><small>Comece aqui</small><b>Crie o primeiro cenário</b><span>Escolha o nome, a data de corte e de onde começar.</span></div></div>';
    else {
      h += '<div class="cur"><div class="nm"><small>' + (PUB ? 'Cenário publicado' : 'Cenário aberto') + '</small><b>' + esc(PLAN.nome) + '</b><span>Data de corte ' +
        (PUB ? '<b>' + br(PLAN.data) + '</b>' : '<input type="date" id="pl66-data-cur" value="' + esc(PLAN.data) + '" aria-label="Data de corte do cenário">') + ' · ' + esc(baseName(PLAN.base)) + '</span></div>' +
        (PUB ? '' : '<div class="bt"><button type="button" data-a="pub" title="Gera o HTML deste cenário para enviar às pessoas">Publicar este cenário</button></div>') + '</div>';
      if (!PUB) h += '<div class="ln">Treliça lançadeira · vigas lançadas até o corte: <b>' + (L ? L.n + ' de ' + L.total : '…') + '</b>' + (L && L.next ? '<small>próxima: vão ' + L.next.vao + ' · ramo ' + (L.next.b === '10.1' ? '1000' : '2000') + '</small>' : L ? '<small>todas lançadas</small>' : '') +
        '<button type="button" data-a="lan-" title="Tira a última viga lançada neste cenário"' + (L && L.n ? '' : ' disabled') + '>◀ Uma a menos</button><button type="button" data-a="lan+" class="main" title="Lança a próxima viga até a data de corte (pinta de cinza)"' + (L && L.next ? '' : ' disabled') + '>Lançar a próxima ▶</button>' +
        '<small>Cantitravels e carros de avanço: nos painéis abaixo; a posição fica salva neste cenário.</small></div>';
    }
    if (remoteMsg && !PUB) h += '<div class="msg">' + esc(remoteMsg) + ' <button type="button" data-a="reload">Atualizar</button></div>';
    if (flashMsg) h += '<div class="msg">' + esc(flashMsg) + '</div>';
    if (!PUB) {
      h += '<div class="gr">Cenários (' + list.length + ')</div>';
      if (!list.length) h += '<div class="it"><div class="tx"><small>Nenhum cenário ainda.</small></div></div>';
      list.forEach(function (id) {
        var s = idx[id], on = id === PLAN.id;
        h += '<div class="it' + (on ? ' on' : '') + '"><div class="tx">' + (editing === id ? '<input type="text" data-edit value="' + esc(s.nome) + '" maxlength="60" aria-label="Novo nome">' : '<b>' + esc(s.nome) + '</b>') +
          '<small>Corte ' + br(s.data) + ' · ' + esc(baseName(s.base)) + '</small></div><div class="bt">' +
          (editing === id ? '<button type="button" class="main" data-a="ren-ok" data-id="' + id + '">Salvar nome</button><button type="button" data-a="cancel">Cancelar</button>' :
           confirmDel === id ? '<span style="color:#ffb4b0;font-size:12px">Apagar este cenário?</span><button type="button" class="dg" data-a="del-ok" data-id="' + id + '">Apagar</button><button type="button" data-a="cancel">Cancelar</button>' :
           (on ? '' : '<button type="button" class="main" data-a="open" data-id="' + id + '">Abrir</button>') + '<button type="button" data-a="dup" data-id="' + id + '">Duplicar</button><button type="button" data-a="ren" data-id="' + id + '">Renomear</button><button type="button" class="dg" data-a="del" data-id="' + id + '">Apagar</button>') + '</div></div>';
      });
      var dflt = PLAN.data || (new Date().getFullYear() + '-12-31');
      h += '<div class="gr">Novo cenário</div><div class="new"><div class="fs"><label>Nome<input type="text" id="pl66-nome" maxlength="60" placeholder="Ex.: Estaca 800 · fim de 2026"></label>' +
        '<label>Data de corte<input type="date" id="pl66-data-new" value="' + esc(dflt) + '"></label></div><div class="bs"><span>Começar de</span>' +
        ['zero', 'ap11-800', 'original'].map(function (k, i) { return '<label><input type="radio" name="pl66-base" value="' + k + '"' + (i ? '' : ' checked') + '> ' + esc(baseName(k)) + '</label>'; }).join('') +
        '</div><div class="go"><button type="button" class="main" data-a="create">Criar cenário</button></div></div>';
    }
    var keep = document.activeElement && box.contains(document.activeElement) && document.activeElement.id ? document.activeElement.id : null, vals = {};
    box.querySelectorAll('#pl66-nome,#pl66-data-new').forEach(function (i) { vals[i.id] = i.value; });
    var radio = box.querySelector('input[name=pl66-base]:checked');
    box.innerHTML = h;
    for (var k in vals) { var el = box.querySelector('#' + k); if (el) el.value = vals[k]; }
    if (radio) { var r2 = box.querySelector('input[name=pl66-base][value="' + radio.value + '"]'); if (r2) r2.checked = true; }
    if (keep) { var f = box.querySelector('#' + keep); if (f) f.focus(); }
  }
  function header() {
    try {
      if (!document.body) return;
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) { if (n.nodeValue.trim() === 'Controle de produção') { n.nodeValue = 'Planejamento de cenários'; var t = document.createElement('span'); t.className = 'pl66-tag'; t.textContent = 'PLANEJAMENTO'; n.parentNode.appendChild(t); return true; } }
    } catch (e) {}
    return false;
  }

  // ---------- partida ----------
  try { document.title = 'Planejamento · ' + PLAN.nome; } catch (e) {}
  var headDone = false, apTries = 0, lastL = '';
  setInterval(function () {
    if (!headDone) headDone = header();
    mount();
    var sc = window.__v40 && window.__v40.scene;
    if (sc && findPx()) { if (!readyAt) readyAt = Date.now(); if (Date.now() - readyAt > 1500 && apTries < 80) { apTries++; if (restoreAppearance()) apTries = 99; } }
    var L = PUB ? null : launched(), s = L ? L.n + '/' + (L.next ? L.next.k : '') : '';
    if (s !== lastL) { lastL = s; ui(); }
  }, 500);
  if (!PUB) {
    for (var id0 in idx) if ((idx[id0].t || 0) > (idx[id0].pt || 0)) { setTimeout(push, 3000); break; }   // alterações feitas sem internet
    setInterval(function () { if (document.visibilityState === 'visible' && !pushing) pull(); }, 60000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !pushing) pull(); });
  }
  window.__pl66 = {
    get plan() { return PLAN; }, get list() { return ordered().map(function (id) { return Object.assign({ id: id }, idx[id]); }); },
    create: create, duplicate: duplicate, rename: rename, setData: setData, remove: remove, go: go, push: push, pull: pull,
    launched: launched, launchStep: launchStep, beams: beams,
    snapLS: function () { snapAppearance(); return PUB ? Object.assign({}, PUB.ls || {}, mem) : collect(PLAN.id); }
  };
})();
