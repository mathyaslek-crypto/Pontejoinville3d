/* Ponte Joinville — "Ocultar peças" no 3D (V1.54; opções de vigas, pré-lajes e aduelas na V1.58)
   Liga o modo, clica em quantas peças quiser e elas somem da tela (nada é apagado: os dados, o RDO e os
   painéis continuam iguais). "Desfazer" traz de volta a última; "Mostrar todas" traz todas.
   As peças ocultas continuam ocultas ao fechar e abrir o site neste aparelho.
   Como o 3D junta as peças em poucas malhas (por material), a peça oculta é retirada dessas malhas pelos seus
   triângulos e arestas; também sai da seleção por clique, das placas e da previsão (previsao3d.js). */
(function () {
  'use strict';
  var KEY = 'ponte-ocultas-v54', PUB = window.__pub58 || null;
  var hidden = new Set(), order = [];
  try { ((PUB && PUB.oc ? PUB.oc.hidden : JSON.parse(localStorage.getItem(KEY) || '[]')) || []).forEach(function (k) { if (typeof k === 'string' && !hidden.has(k)) { hidden.add(k); order.push(k); } }); } catch (e) {}
  var mode = false, btn = null, bar = null, canvas = null, down = null, lastSig = '', names = {};
  // opções do painel (V1.58): desligadas, escondem só o que ainda não foi feito e não tem previsão
  //   Vigas não lançadas · Aduelas não concretadas · Pré-lajes não lançadas (a das pré-lajes é a do próprio 3D)
  var KEY_V = 'ponte-vigas-v57', KEY_A = 'ponte-aduelas-v58', KEY_P = 'ponte-prelajes-v58', beamsOff = false, adOff = false, plOff = null, beamKeys = new Set(), exec = new Set();
  function rdb(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  if (PUB && PUB.oc) { beamsOff = !!PUB.oc.beamsOff; adOff = !!PUB.oc.adOff; plOff = !!PUB.oc.plOff; }
  else { beamsOff = rdb(KEY_V) === '0'; adOff = rdb(KEY_A) === '0'; var pv = rdb(KEY_P); if (pv != null) plOff = pv === '0'; }
  function wrb(k, off) { if (PUB) return; try { localStorage.setItem(k, off ? '0' : '1'); } catch (e) {} }
  var ADU = /^(ARR|FEC|[AB]\d+)$/;
  function isBeamKey(k) { return beamKeys.has(k) || /^[\d.]+-GB/.test(k); }
  function isAdKey(k) { var i = k.indexOf('-'); return i > 0 && ADU.test(k.slice(i + 1)); }
  function forecast(k) { try { var i = k.indexOf('-'); return !!(window.__prev53 && window.__prev53.eff(k.slice(0, i), k.slice(i + 1))); } catch (e) { return false; } }
  function keep(k) { return exec.has(k) || forecast(k); }    // lançada/concretada ou com previsão: continua aparecendo
  function isHid(k) { return hidden.has(k) || (beamsOff && isBeamKey(k) && !keep(k)) || (adOff && isAdKey(k) && !keep(k)); }

  function save() { if (PUB) return; try { localStorage.setItem(KEY, JSON.stringify(order)); } catch (e) {} }
  function findPx(scene) { var px = null; scene.traverse(function (o) { if (!px && o.name === 'Peças para seleção') px = o; }); return px; }
  function q(x, y, z) { return Math.round(x * 1000) + ',' + Math.round(y * 1000) + ',' + Math.round(z * 1000); }
  function ident(e) { return e[0] === 1 && e[5] === 1 && e[10] === 1 && e[15] === 1 && !e[1] && !e[2] && !e[4] && !e[6] && !e[8] && !e[9] && !e[12] && !e[13] && !e[14]; }

  // triângulos e arestas da peça oculta (as malhas agrupadas guardam exatamente as mesmas coordenadas)
  function collect(c, tri, seg, mn, mx) {
    var g = c.geometry, pos = g.attributes.position, ix = g.index, n = ix ? ix.count : pos.count, e = c.matrixWorld.elements, id = ident(e);
    for (var i = 0; i + 2 < n; i += 3) {
      var ks = [];
      for (var j = 0; j < 3; j++) {
        var v = ix ? ix.getX(i + j) : i + j, x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
        if (!id) { var X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14]; x = X; y = Y; z = Z; }
        if (x < mn[0]) mn[0] = x; if (y < mn[1]) mn[1] = y; if (z < mn[2]) mn[2] = z; if (x > mx[0]) mx[0] = x; if (y > mx[1]) mx[1] = y; if (z > mx[2]) mx[2] = z;
        ks.push(q(x, y, z));
      }
      for (j = 0; j < 3; j++) { var a = ks[j], b = ks[(j + 1) % 3]; seg.add(a < b ? a + '|' + b : b + '|' + a); }
      tri.add(ks.slice().sort().join('|'));
    }
  }
  function filter(o, set, any, mn, mx) {
    var g = o.geometry, ud = g.userData.oc54 || (g.userData.oc54 = { orig: g.index });
    if (!any) { if (g.index !== ud.orig) g.setIndex(ud.orig); return 0; }
    var pos = g.attributes.position, ix = ud.orig, n = ix ? ix.count : pos.count, per = o.isMesh ? 3 : 2, e = o.matrixWorld.elements, id = ident(e), keep = [], rem = 0;
    for (var i = 0; i + per - 1 < n; i += per) {
      var ks = [], inside = true;
      for (var j = 0; j < per; j++) {
        var v = ix ? ix.getX(i + j) : i + j, x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
        if (!id) { var X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14]; x = X; y = Y; z = Z; }
        if (x < mn[0] - 0.01 || x > mx[0] + 0.01 || y < mn[1] - 0.01 || y > mx[1] + 0.01 || z < mn[2] - 0.01 || z > mx[2] + 0.01) { inside = false; break; }
        ks.push(q(x, y, z));
      }
      if (inside && set.has(ks.sort().join('|'))) { rem++; continue; }
      for (j = 0; j < per; j++) keep.push(ix ? ix.getX(i + j) : i + j);
    }
    if (rem) g.setIndex(keep); else if (g.index !== ud.orig) g.setIndex(ud.orig);
    return rem;
  }
  var stats = {};
  function apply(changed) {
    var scene = window.__v40 && window.__v40.scene; if (!scene) return;
    var px = findPx(scene); if (!px) return;
    try { if (window.__aj55 && window.__aj55.fix) window.__aj55.fix(px); } catch (e) {}
    var rn = px.parent, tri = new Set(), seg = new Set(), mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], any = false;
    // peças já feitas (alguma parte desenhada cheia: viga lançada, aduela concretada…)
    exec = new Set();
    px.children.forEach(function (c) { var u = c.userData || {}, m = c.material; if (u.b && u.s && m && m.color && !m.transparent && !(m.opacity < 0.99) && m.color.getHex() !== 0xf2cd31) exec.add(u.b + '-' + u.s); });
    px.children.forEach(function (c) {
      var u = c.userData || {}; if (!u.b || !u.s) return;
      if (/^GB/.test(u.s)) beamKeys.add(u.b + '-' + u.s);   // vigas pré-moldadas (GB…)
      if (isHid(u.b + '-' + u.s)) { c.layers.mask = 1 << 30; u.oc54 = 1; if (c.geometry && c.geometry.attributes.position) { collect(c, tri, seg, mn, mx); any = true; } }   // fora do clique
      else if (u.oc54) { c.layers.mask = 1; delete u.oc54; }
    });
    stats = { tri: tri.size, removed: 0, lines: 0 };
    rn.children.forEach(function (o) {
      if (o === px) return;
      var u = o.userData || {};
      if (u.plate41) return;
      if (u.b && u.s) { var h = isHid(u.b + '-' + u.s); if (h && o.visible) { o.visible = false; u.oc54v = 1; } else if (!h && u.oc54v) { o.visible = true; delete u.oc54v; } return; }
      if (!(o.isMesh || o.isLineSegments) || o.isInstancedMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      var r = filter(o, o.isMesh ? tri : seg, any, mn, mx); if (o.isMesh) stats.removed += r; else stats.lines += r;
    });
    // (V1.58) as vigas da simulação da treliça já estão lançadas: continuam sempre à mostra
    scene.children.forEach(function (o) { if (o.name === 'Vigas lançadas na simulação' && o.userData.oc57) { o.visible = true; delete o.userData.oc57; } });
    if (changed && window.__prev53 && window.__prev53.refresh) window.__prev53.refresh();
  }
  function prelajes() { try { window.__prev53 && window.__prev53.prelajes && window.__prev53.prelajes(); } catch (e) {} }
  function addBeamToggle() {
    // pré-lajes: a opção é do próprio 3D; o grupo fica ligado e a escolha passa a esconder só as não lançadas
    var pl = document.getElementById('av-prelaje');
    if (pl && !pl.dataset.h58) {
      pl.dataset.h58 = '1';
      var orig = pl.onchange, wasOff = !pl.checked;
      if (plOff == null) plOff = wasOff;
      if (!pl.checked) { pl.checked = true; try { orig && orig.call(pl); } catch (e) {} }
      pl.checked = !plOff;
      pl.onchange = function () { plOff = !pl.checked; wrb(KEY_P, plOff); prelajes(); };
      relabel(pl, 'Pré-lajes não lançadas', 'Desligado: mostra só as pré-lajes já lançadas');
      prelajes();
    }
    if (!document.getElementById('av-vigas57')) {
      var after = document.getElementById('av-prelaje') || document.getElementById('av-environment'); if (!after) return;
      var lb = document.createElement('label'); lb.style.cssText = 'flex-direction:row;align-items:center';
      lb.innerHTML = '<input type="checkbox" id="av-vigas57"> Vigas não lançadas';
      lb.title = 'Desligado: mostra só as vigas lançadas e as que têm previsão';
      after.closest('label').after(lb);
      var ck = lb.querySelector('input'); ck.checked = !beamsOff;
      ck.onchange = function () { beamsOff = !ck.checked; wrb(KEY_V, beamsOff); apply(true); };
    }
    if (!document.getElementById('av-aduelas58')) {
      var v = document.getElementById('av-vigas57'); if (!v) return;
      var la = document.createElement('label'); la.style.cssText = 'flex-direction:row;align-items:center';
      la.innerHTML = '<input type="checkbox" id="av-aduelas58"> Aduelas não concretadas';
      la.title = 'Desligado: mostra só as aduelas concretadas e as que têm previsão';
      v.closest('label').after(la);
      var ca = la.querySelector('input'); ca.checked = !adOff;
      ca.onchange = function () { adOff = !ca.checked; wrb(KEY_A, adOff); apply(true); };
    }
  }
  function relabel(input, text, title) {
    var lb = input.closest('label'); if (!lb) return; lb.title = title;
    for (var i = lb.childNodes.length - 1; i >= 0; i--) { var n = lb.childNodes[i]; if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = ' ' + text; return; } }
    lb.append(' ' + text);
  }

  function clearSel() { var c = document.getElementById('v22-clear'); if (c && typeof c.onclick === 'function') { try { c.onclick(); } catch (e) {} } }
  function nameOf(key) {
    if (names[key]) return names[key];
    try { var r = (window.__v22.rows || []).filter(function (x) { return x.key === key; })[0]; if (r && r.name) return (names[key] = r.name); } catch (e) {}
    return key;
  }
  function hide(key) { if (hidden.has(key)) return; hidden.add(key); order.push(key); save(); apply(true); ui(); }
  function undo() { var k = order.pop(); if (!k) return; hidden.delete(k); save(); apply(true); ui(); }
  function showAll() { hidden.clear(); order = []; save(); apply(true); ui(); }
  function setMode(v) { mode = !!v; if (mode && window.__pt55 && window.__pt55.mode) window.__pt55.setMode(false); if (canvas) canvas.style.cursor = mode ? 'crosshair' : ''; document.body.classList.toggle('oc54-on', mode); if (mode) clearSel(); ui(); }

  function bindCanvas() {
    var el = window.__v22 && window.__v22.controls && window.__v22.controls.domElement;
    if (!el || el === canvas) return;
    canvas = el; if (mode) canvas.style.cursor = 'crosshair';
    el.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
    // roda depois do clique do próprio 3D (que seleciona a peça): oculta a peça clicada e desfaz a seleção
    el.addEventListener('pointerup', function (e) {
      if (!mode || !down) return;
      var moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6; down = null; if (moved) return;
      var h = null, p = null, key = null;
      try { h = window.__v23.hit(e.clientX, e.clientY); } catch (x) {}
      try { p = window.__prev53 && window.__prev53.pick ? window.__prev53.pick(e.clientX, e.clientY) : null; } catch (x) {}
      if (h && h.object && h.object.userData && h.object.userData.b) key = h.object.userData.b + '-' + h.object.userData.s;
      if (p && (!h || p.distance < h.distance)) key = p.key;
      if (key) hide(key);
      setTimeout(clearSel, 0);
    });
  }

  function css() {
    if (document.getElementById('oc54-css')) return;
    var s = document.createElement('style'); s.id = 'oc54-css';
    s.textContent = 'body.oc54-on #fc50{display:none!important}' +
      '#oc54-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 24px);padding:8px 10px;border-radius:12px;background:#11151be6;border:1px solid #ffffff26;color:#eef1f5;font:12.5px var(--f34,system-ui);box-shadow:0 10px 30px #0008;backdrop-filter:blur(8px)}#oc54-bar[hidden]{display:none}' +
      '#oc54-bar b{font-weight:650}#oc54-bar span{color:#c3cad2}#oc54-bar button{font:inherit;font-size:12px;border:1px solid #ffffff33;background:#ffffff12;color:#eef1f5;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap}#oc54-bar button:disabled{opacity:.45;cursor:default}#oc54-bar button.ok{background:#FDB900;border-color:#FDB900;color:#151515;font-weight:650}' +
      '@media (max-width:760px){#oc54-bar{top:50px;bottom:auto;left:8px;right:8px;transform:none;max-width:none;font-size:12px;padding:6px 8px;gap:6px}#oc54-bar .mx{display:none}}';
    document.head.append(s);
  }
  function mountBtn() {
    var f = document.getElementById('v23-focus'); if (!f) return;
    if (!btn || !btn.isConnected) {
      btn = document.createElement('button'); btn.type = 'button'; btn.id = 'oc54-btn'; btn.className = f.className;
      btn.title = 'Clique nas peças para escondê-las da tela (nada é apagado)';
      btn.onclick = function () { setMode(!mode); };
      var after = document.getElementById('pc54-btn') || document.getElementById('pv53-btn') || document.getElementById('pl50-btn') || f; after.after(btn); ui();
    }
    var pad = document.getElementById('pad50'), host = pad ? pad.parentElement : null;
    if (host && (!bar || bar.parentElement !== host)) {
      css();
      if (!bar) { bar = document.createElement('div'); bar.id = 'oc54-bar'; bar.setAttribute('role', 'status'); }
      host.append(bar); ui();
    }
  }
  function ui() {
    var n = order.length;
    if (btn) { btn.setAttribute('aria-pressed', String(mode)); btn.textContent = (innerWidth < 760 ? 'Ocultar' : 'Ocultar peças') + (n ? ' (' + n + ')' : ''); }
    if (!bar) return;
    bar.hidden = !mode && !n;
    if (bar.hidden) return;
    var last = n ? nameOf(order[n - 1]) : '';
    bar.innerHTML = mode
      ? '<b>Ocultar peças</b><span>' + (n ? 'Última: ' + esc(last) : 'Clique nas peças que quer esconder') + '</span><button type="button" data-a="undo"' + (n ? '' : ' disabled') + '>Desfazer</button><button type="button" data-a="all"' + (n ? '' : ' disabled') + '>Mostrar todas' + (n ? ' (' + n + ')' : '') + '</button><button type="button" class="ok" data-a="done">Concluir</button>'
      : '<span>' + n + (n === 1 ? ' peça oculta' : ' peças ocultas') + '</span><button type="button" class="mx" data-a="edit">Ocultar mais</button><button type="button" data-a="all">Mostrar todas</button>';
    bar.querySelectorAll('button').forEach(function (b) { b.onclick = function () { var a = b.dataset.a; if (a === 'undo') undo(); else if (a === 'all') showAll(); else if (a === 'done') setMode(false); else if (a === 'edit') setMode(true); }; });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mode && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) setMode(false); });

  function tick() {
    var scene = window.__v40 && window.__v40.scene; if (!scene) return;
    mountBtn(); bindCanvas(); addBeamToggle();
    var px = findPx(scene); if (!px) return;
    var sig = px.uuid + ':' + px.children.length + ':' + (px.children[0] ? px.children[0].uuid : '');
    if (sig !== lastSig) { lastSig = sig; apply(false); }   // o 3D refez as malhas (data, partes não iniciadas, vista...)
  }
  setInterval(tick, 300);
  window.__oc54 = {
    has: function (k) { return isHid(k); }, get beamsOff() { return beamsOff; }, get adOff() { return adOff; }, get prelajeOff() { return !!plOff; },
    setBeams: function (v) { beamsOff = !v; wrb(KEY_V, beamsOff); var c = document.getElementById('av-vigas57'); if (c) c.checked = !!v; apply(true); },
    setAduelas: function (v) { adOff = !v; wrb(KEY_A, adOff); var c = document.getElementById('av-aduelas58'); if (c) c.checked = !!v; apply(true); },
    setPrelajes: function (v) { plOff = !v; wrb(KEY_P, plOff); var c = document.getElementById('av-prelaje'); if (c) c.checked = !!v; prelajes(); },
    refreshKeep: function () { if (beamsOff || adOff) apply(true); },
    get list() { return order.slice(); }, get mode() { return mode; }, get stats() { return stats; },
    hide: hide, undo: undo, showAll: showAll, setMode: setMode, apply: function () { apply(true); }
  };
})();
