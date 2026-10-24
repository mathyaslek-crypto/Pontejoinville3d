/* Ponte Joinville — previsão do cronograma no 3D (V1.55; planilha Cronograma_Ponte_joinville.xlsx, 21/10/2026)
   Abas usadas: 9.1, 9.2 e Aduela_10 (aduelas) e "Cronograma" (geral: estacas, blocos, pilares, travessas, pilaretes,
   vigas pré-moldadas e peças das transições). Na aba geral, a partir da linha 85, Início/Término de cada tarefa estão
   uma linha abaixo do nome (a coluna Duração confirma); o gerador corrige esse deslocamento.
   As datas realizadas continuam como estão. Só as etapas ainda não iniciadas recebem a cor da previsão de término:
     até 31/12/2026        → cinza sólido, igual às peças concluídas (o 3D mostra a ponte como deve estar no fim do ano)
     01/01 a 30/03/2027    → cor e transparência escolhidas no botão "Cor da previsão" (padrão: amarelo transparente)
   Peças previstas depois de 30/03/2027 ficam como hoje.
   Com "Mostrar partes não iniciadas" desligado: o 3D mostra as concluídas/em execução e a previsão; os nomes (placas)
   continuam nas peças iniciadas e nas que estão na previsão; somem os das demais e as pré-lajes ainda não iniciadas.
   Pilaretes não têm linha própria no cronograma: seguem a data da travessa do mesmo apoio e ramo.
   Estacas: o cronograma agrupa por par de blocos ("Iniciar BLxx.1 e BLxx.4"); cada estaca recebe a data do seu grupo.
   Peças ocultadas no botão "Ocultar peças" (ocultar3d.js) ficam fora da previsão e das placas.
   Peças pintadas à mão no botão "Pintar peças" (pintar3d.js) usam a pintura no lugar da data do cronograma. */
(function () {
  'use strict';
  // V1.59: os cronogramas ficam em cronogramas3d.js (um por cenário-base); o cenário ativo vem de cenarios3d.js
  var T = [], D = {}, BASE = null;
  function loadBase() {
    var src = window.__cronData59, C = window.__cen59; if (!src || !src.bases || !src.bases.length) return false;
    var id = C ? C.baseOf(C.active()) : src.padrao, b = null;
    src.bases.forEach(function (x) { if (x.id === id) b = x; }); if (!b) b = src.bases[0];
    if (b.id === BASE) return false; BASE = b.id; T = b.T; D = b.D; return true;
  }
  loadBase();

  var CUT1 = '2026-12-31', CUT2 = '2027-03-30';
  var DONE = 0x969ba0, DONE_EDGE = 0x617385;
  var KEY = 'ponte-previsao-v53', KEY_STYLE = 'ponte-previsao-cor-v54';
  var DEF = { color: '#f6d34a', opacity: 0.46 };
  var SWATCHES = [['Amarelo', '#f6d34a'], ['Laranja', '#ff9a3c'], ['Vermelho', '#ef5350'], ['Rosa', '#f06292'], ['Roxo', '#9575cd'], ['Azul', '#42a5f5'], ['Ciano', '#26c6da'], ['Verde', '#66bb6a'], ['Limão', '#c6d63a']];
  var PLATE_IDS = /(?:^|_)(MBL|EB[12]|BASE|LAJE)$/, ADUELA = /^(ARR|FEC|[AB]\d+)$/;
  var PUB = window.__pub58 || null;   // painel publicado (V1.58): previsão e cores gravadas no arquivo
  var on = true; try { on = PUB && PUB.prev ? PUB.prev.on !== false : localStorage.getItem(KEY) !== '0'; } catch (e) {}
  var style = loadStyle();
  var root = null, mats = null, lmats = null, Mesh = null, Group = null, Lines = null, Geo = null, Attr = null, Box3 = null, Vec3 = null;
  var TexC = null, PlateMat = null, plateRoot = null, myPlates = {}, texCache = {};
  var btn = null, cbtn = null, pan = null, leg = null;
  var lastPxObj = null, counts = { c1: 0, c2: 0 }, cache = null, layoutOK = true, lastPx = null, lastGhost = null, lastPlates = -1, lastPre = 0, listening = false;

  function loadStyle() {
    var s = null; try { s = PUB && PUB.prev && PUB.prev.style ? PUB.prev.style : JSON.parse(localStorage.getItem(KEY_STYLE) || 'null'); } catch (e) {}
    if (!s || !/^#[0-9a-f]{6}$/i.test(s.color || '') || !(s.opacity >= 0.1 && s.opacity <= 1)) s = { color: DEF.color, opacity: DEF.opacity };
    return s;
  }
  function saveStyle() { if (PUB) return; try { localStorage.setItem(KEY_STYLE, JSON.stringify(style)); } catch (e) {} }
  function hex(c) { return parseInt(c.slice(1), 16); }
  function mix(c, t, f) { var a = hex(c), r = (a >> 16) & 255, g = (a >> 8) & 255, b = a & 255; r = Math.round(r + (t - r) * f); g = Math.round(g + (t - g) * f); b = Math.round(b + (t - b) * f); return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }
  function rgba(c, a) { var x = hex(c); return 'rgba(' + ((x >> 16) & 255) + ',' + ((x >> 8) & 255) + ',' + (x & 255) + ',' + a + ')'; }

  function get(b, s) { var r = D[b + '-' + s]; return r ? [r[0], r[1], T[r[2]]] : null; }
  function bandOf(end) { return end <= CUT1 ? 'c1' : end <= CUT2 ? 'c2' : null; }
  function band(b, s) { var r = D[b + '-' + s]; return r ? bandOf(r[1]) : null; }
  function manual(b, s) { try { return window.__pt55 ? window.__pt55.get(b + '-' + s) : null; } catch (e) { return null; } }
  // cor usada na peça: pintura manual ('c1', 'c2', '#cor' ou 'none' = sem cor) ou, sem pintura, a faixa do cronograma
  function eff(b, s) { var m = manual(b, s); if (m === 'none') return null; return m || band(b, s); }
  function hid(b, s) { try { return !!(window.__oc54 && window.__oc54.has(b + '-' + s)); } catch (e) { return false; } }
  // etapa ainda não iniciada: as cores "fantasma" do 3D (nenhuma atividade) e, nas vigas pré-moldadas, as ainda não lançadas
  function isGhost(c) {
    var m = c.material; if (!m || !m.color || !m.transparent || !(m.opacity < 0.5)) return false;
    var h = m.color.getHex(); return h === 0x8b9caa || h === 0x8b9faa || (!!c.userData.beam && (h === 0x70838e || h === 0x969da3));
  }
  function ghostOn() { var g = document.getElementById('av-ghost'); return !g || g.checked; }
  function prazoOn() { var b = document.getElementById('pl50-btn'); return !!(b && b.getAttribute('aria-pressed') === 'true'); }
  function platesOn() { try { return localStorage.getItem('ponte-placas-aduela') !== '0'; } catch (e) { return true; } }
  function findProxies(scene) { var px = null; scene.traverse(function (o) { if (!px && o.name === 'Peças para seleção') px = o; }); return px; }
  function worldBox(c) { if (!c.geometry.boundingBox) c.geometry.computeBoundingBox(); return new Box3().copy(c.geometry.boundingBox).applyMatrix4(c.matrixWorld); }
  function keyOf(u) { return u.b + '|' + u.s + '|' + u.k; }

  // ---------- materiais: até dezembro = mesmo material das concluídas; março = cor escolhida ----------
  var cmats = {}, clmats = {};
  function customMat(c) {
    if (!cmats[c]) { cmats[c] = mats.c2.clone(); if (lmats) clmats[c] = lmats.c2.clone(); }
    var m = cmats[c], op = style.opacity, solid = op >= 0.999;
    m.color.setHex(hex(c)); m.opacity = solid ? 1 : op; m.transparent = !solid; m.depthWrite = solid; m.side = 2;
    if (m.emissive) m.emissive.setHex(hex(mix(c, 0, 0.72))); m.needsUpdate = true;
    if (clmats[c]) { var l = clmats[c]; l.color.setHex(hex(mix(c, 0, 0.28))); l.opacity = solid ? 0.55 : 0.7; l.transparent = true; l.depthWrite = false; l.needsUpdate = true; }
    return m;
  }
  function applyStyle() {
    if (!mats) return;
    for (var c in cmats) customMat(c);
    var m = mats.c2, op = style.opacity, solid = op >= 0.999;
    m.color.setHex(hex(style.color)); m.opacity = solid ? 1 : op; m.transparent = !solid; m.depthWrite = solid; m.side = 2;   // os dois lados: algumas peças do 3D têm faces com a frente virada para dentro
    if (m.emissive) m.emissive.setHex(hex(mix(style.color, 0, 0.72)));
    m.needsUpdate = true;
    if (lmats) { var l = lmats.c2; l.color.setHex(hex(mix(style.color, 0, 0.28))); l.opacity = solid ? 0.55 : 0.7; l.transparent = true; l.depthWrite = false; l.needsUpdate = true; }
    legend(); paintPanel();
  }
  function syncDone(rn) {
    // copia o material das peças concluídas (mesmo cinza, mesmo acabamento)
    var src = null;
    rn.children.forEach(function (o) { var mt = o.material; if (!src && o.isMesh && !o.userData.b && !o.userData.plate41 && mt && !Array.isArray(mt) && mt.color && mt.color.getHex() === DONE && !mt.transparent) src = mt; });
    var m = mats.c1;
    if (src && m.userData.src53 !== src.uuid) { m.copy(src); m.userData.src53 = src.uuid; }
    else if (!src && !m.userData.src53) { m.color.setHex(DONE); m.roughness = 0.85; m.metalness = 0; m.side = 2; }
    m.transparent = false; m.opacity = 1; m.depthWrite = true; m.side = 2; m.map = null; m.vertexColors = false; m.needsUpdate = true;
    if (lmats) { var l = lmats.c1; l.color.setHex(DONE_EDGE); l.opacity = 0.38; l.transparent = true; l.depthWrite = false; l.needsUpdate = true; }
  }

  // Com as partes não iniciadas ligadas, o 3D desenha todas as peças: guarda a geometria das peças com previsão,
  // a posição de referência de cada peça e a área das placas, para continuar mostrando a previsão quando elas forem desligadas.
  function snapshot(px) {
    var items = [], centers = {}, plates = [], adu = {};
    px.children.forEach(function (c) {
      var u = c.userData || {}; if (!u.b || !u.s || !c.isMesh) return;
      var bx = worldBox(c), key = keyOf(u);
      if (!centers[key]) centers[key] = bx.getCenter(new Vec3());
      if (PLATE_IDS.test(u.s)) plates.push({ b: u.b, s: u.s, x0: bx.min.x - 0.15, x1: bx.max.x + 0.15, z0: bx.min.z - 0.15, z1: bx.max.z + 0.15, y0: bx.min.y - 0.1, y1: bx.max.y + 4 });
      if (ADUELA.test(u.s)) { var a = adu[u.b + '|' + u.s]; if (!a) adu[u.b + '|' + u.s] = a = { b: u.b, s: u.s, box: bx.clone() }; else a.box.union(bx); }
      items.push({ key: key, b: u.b, s: u.s, geo: c.geometry, mw: c.matrixWorld.clone(), c: bx.getCenter(new Vec3()), box: bx, ghost: isGhost(c) });
    });
    return { items: items, centers: centers, plates: plates, adu: adu };
  }
  // Partes não iniciadas desligadas: o 3D só tem as peças iniciadas. Confere se a vista é a mesma da última captura
  // (mesma posição da grande maioria das peças) e quais trechos (ramos) estão visíveis.
  function current(px) {
    var present = {}, pieces = {}, bset = {}, mbl = {}, n = 0, bad = 0;
    px.children.forEach(function (c) {
      var u = c.userData || {}; if (!u.b || !u.s || !c.isMesh) return;
      var key = keyOf(u); bset[u.b] = 1;
      if (!isGhost(c)) { present[key] = 1; pieces[u.b + '|' + u.s] = 1; if (u.s === 'MBL') { var bx = worldBox(c), pk = u.b + '|MBL'; if (mbl[pk]) mbl[pk].union(bx); else mbl[pk] = bx; } }
      if (n < 600 && cache && cache.centers[key]) { n++; if (worldBox(c).getCenter(new Vec3()).distanceTo(cache.centers[key]) > 0.05) bad++; }
    });
    return { present: present, pieces: pieces, bset: bset, mbl: mbl, ok: n > 0 && bad <= n * 0.15 };   // algumas peças em terra mudam um pouco de altura conforme as vizinhas; vista diferente muda quase tudo
  }

  // Triângulos da peça (coordenadas do mundo, ampliados 0,6% em torno do centro para não brigar com a superfície
  // original) e as arestas vivas (como o contorno das peças do 3D). Calculado uma vez e reaproveitado.
  var PREP = {};
  function prep(it) {
    if (it.tp) return;
    var sig = (it.band === 'c1' ? 'c1' : 'cx') + (it.geo.index ? it.geo.index.count : it.geo.attributes.position.count) + '@' + it.c.x.toFixed(3) + ',' + it.c.y.toFixed(3) + ',' + it.c.z.toFixed(3), pc = PREP[it.key + '#' + sig];
    if (pc) { it.tp = pc.tp; it.tn = pc.tn; it.te = pc.te; return; }
    var g = it.geo, pos = g.attributes.position, ix = g.index, n = ix ? ix.count : pos.count, e = it.mw.elements, s = 1.006, lim = it.band === 'c1' ? 0.978 : 0.94;
    var tp = new Float32Array(n * 3), tn = new Float32Array(n * 3), i, j, k, v, x, y, z;
    for (i = 0; i < n; i++) {
      v = ix ? ix.getX(i) : i; x = pos.getX(v); y = pos.getY(v); z = pos.getZ(v);
      tp[i * 3] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * s + it.c.x * (1 - s);
      tp[i * 3 + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * s + it.c.y * (1 - s);
      tp[i * 3 + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * s + it.c.z * (1 - s);
    }
    var E = {}, out = [], q = function (a) { return Math.round(tp[a] * 500) + ',' + Math.round(tp[a + 1] * 500) + ',' + Math.round(tp[a + 2] * 500); };
    for (i = 0; i + 2 < n; i += 3) {
      var a = i * 3, b = a + 3, c = a + 6;
      var ux = tp[b] - tp[a], uy = tp[b + 1] - tp[a + 1], uz = tp[b + 2] - tp[a + 2], wx = tp[c] - tp[a], wy = tp[c + 1] - tp[a + 1], wz = tp[c + 2] - tp[a + 2];
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      for (j = 0; j < 3; j++) { tn[a + j * 3] = nx; tn[a + j * 3 + 1] = ny; tn[a + j * 3 + 2] = nz; }
      if (l < 1e-9) continue;
      var vs = [a, b, c], ks = [q(a), q(b), q(c)];
      for (j = 0; j < 3; j++) {
        var k1 = ks[j], k2 = ks[(j + 1) % 3]; if (k1 === k2) continue;
        k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
        var r = E[k];
        if (!r) E[k] = { n: [nx, ny, nz], a: vs[j], b: vs[(j + 1) % 3], f: 0, c: 1 };
        else { r.c++; if (r.n[0] * nx + r.n[1] * ny + r.n[2] * nz < lim) r.f = 1; }
      }
    }
    for (k in E) { var r2 = E[k]; if (r2.c === 1 || r2.f) out.push(tp[r2.a], tp[r2.a + 1], tp[r2.a + 2], tp[r2.b], tp[r2.b + 1], tp[r2.b + 2]); }
    it.tp = tp; it.tn = tn; it.te = new Float32Array(out);
    PREP[it.key + '#' + sig] = { tp: it.tp, tn: it.tn, te: it.te };
  }
  function merged(list, key) {
    var n = 0, m = 0; list.forEach(function (it) { n += it[key].length; });
    var a = new Float32Array(n); list.forEach(function (it) { a.set(it[key], m); m += it[key].length; });
    return a;
  }

  var cur = null, shown = [], shownItems = [], ccounts = {};
  function rebuild(scene, px, g) {
    while (root.children.length) { var old = root.children[0]; root.remove(old); if (old.geometry) old.geometry.dispose(); }
    counts = { c1: 0, c2: 0 }; ccounts = {}; cur = null; shown = []; shownItems = [];
    syncDone(px.parent);
    if (g) { cache = snapshot(px); layoutOK = true; }
    else if (cache) { cur = current(px); layoutOK = cur.ok; }
    if (cache && layoutOK) {
      var seen = {}, by = { c1: [], c2: [] };
      cache.items.forEach(function (it) {
        var k = eff(it.b, it.s); if (!k) return;
        if (it.band !== k) { if ((it.band === 'c1') !== (k === 'c1')) it.tp = null; it.band = k; }
        if (g ? !it.ghost : (cur.present[it.key] || !cur.bset[it.b])) return;
        // blocos dos apoios 9 e 10: sem as partes não iniciadas, o 3D junta as camadas na mesma situação num sólido só
        if (!g && it.s === 'MBL' && cur.mbl[it.b + '|MBL'] && cur.mbl[it.b + '|MBL'].clone().expandByScalar(0.05).containsPoint(it.c)) return;
        if (hid(it.b, it.s)) return;
        try { prep(it); } catch (e) { return; }
        (by[k] = by[k] || []).push(it); shownItems.push(it);
        var pk = it.b + '-' + it.s; if (!seen[pk]) { seen[pk] = 1; if (k === 'c1' || k === 'c2') counts[k]++; else ccounts[k] = (ccounts[k] || 0) + 1; shown.push(pk); }
      });
      Object.keys(by).forEach(function (k) {
        if (!by[k].length) return;
        var mt = k === 'c1' || k === 'c2' ? mats[k] : customMat(k), lm = k === 'c1' || k === 'c2' ? (lmats && lmats[k]) : clmats[k];
        var geo = new Geo(); geo.setAttribute('position', new Attr(merged(by[k], 'tp'), 3)); geo.setAttribute('normal', new Attr(merged(by[k], 'tn'), 3)); geo.computeBoundingSphere();
        var mesh = new Mesh(geo, mt); mesh.renderOrder = k === 'c1' ? 0 : 2; mesh.name = 'Previsão ' + k; mesh.userData.prev53 = k; root.add(mesh);
        if (Lines && lm) { var lg = new Geo(); lg.setAttribute('position', new Attr(merged(by[k], 'te'), 3)); lg.computeBoundingSphere(); var ln = new Lines(lg, lm); ln.renderOrder = 3; ln.userData.prev53 = k; root.add(ln); }
      });
    }
    if (root.parent !== scene) scene.add(root);
    legend();
  }

  // escolha de peça pela previsão (peças não iniciadas não existem no 3D quando as partes não iniciadas estão desligadas)
  function pick(clientX, clientY) {
    if (!root || !root.visible || !shownItems.length || !window.__v22) return null;
    var cam = window.__v22.camera, el = window.__v22.controls && window.__v22.controls.domElement; if (!cam || !el) return null;
    var r = el.getBoundingClientRect(), nx = (clientX - r.left) / r.width * 2 - 1, ny = 1 - (clientY - r.top) / r.height * 2;
    var o = new Vec3().setFromMatrixPosition(cam.matrixWorld), d = new Vec3(nx, ny, 0.5).unproject(cam).sub(o).normalize();
    var best = null, bd = Infinity;
    shownItems.forEach(function (it) {
      var b = it.box, t0 = 0, t1 = bd, ax, inv, ta, tb, ok = true;
      for (var i = 0; i < 3 && ok; i++) { ax = i === 0 ? 'x' : i === 1 ? 'y' : 'z'; inv = 1 / d[ax]; ta = (b.min[ax] - 0.05 - o[ax]) * inv; tb = (b.max[ax] + 0.05 - o[ax]) * inv; if (ta > tb) { var w = ta; ta = tb; tb = w; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) ok = false; }
      if (!ok) return;
      var p = it.tp;
      for (var k = 0; k + 8 < p.length; k += 9) {
        var e1x = p[k + 3] - p[k], e1y = p[k + 4] - p[k + 1], e1z = p[k + 5] - p[k + 2], e2x = p[k + 6] - p[k], e2y = p[k + 7] - p[k + 1], e2z = p[k + 8] - p[k + 2];
        var hx = d.y * e2z - d.z * e2y, hy = d.z * e2x - d.x * e2z, hz = d.x * e2y - d.y * e2x, a = e1x * hx + e1y * hy + e1z * hz;
        if (Math.abs(a) < 1e-9) continue;
        var f = 1 / a, sx = o.x - p[k], sy = o.y - p[k + 1], sz = o.z - p[k + 2], u = f * (sx * hx + sy * hy + sz * hz); if (u < 0 || u > 1) continue;
        var qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = f * (d.x * qx + d.y * qy + d.z * qz); if (v < 0 || u + v > 1) continue;
        var t = f * (e2x * qx + e2y * qy + e2z * qz); if (t > 1e-4 && t < bd) { bd = t; best = it; }
      }
    });
    return best ? { key: best.b + '-' + best.s, b: best.b, s: best.s, distance: bd } : null;
  }

  // ---------- placas (nomes) ----------
  function hiddenBoxes(px) {
    var out = [], seen = {};
    if (!window.__oc54 || (!window.__oc54.list.length && !window.__oc54.extCount)) return out;
    var acc = {};
    px.children.forEach(function (c) { var u = c.userData || {}; if (!u.b || !u.s || !hid(u.b, u.s)) return; var k = u.b + '|' + u.s, bx = worldBox(c); if (acc[k]) acc[k].union(bx); else acc[k] = bx; });
    if (cache) { cache.plates.forEach(function (a) { if (hid(a.b, a.s) && !acc[a.b + '|' + a.s]) out.push({ x0: a.x0, x1: a.x1, z0: a.z0, z1: a.z1, y0: a.y0, y1: a.y1 }); });
      for (var k in cache.adu) { var a = cache.adu[k]; if (hid(a.b, a.s) && !acc[k]) acc[k] = a.box.clone(); } }
    for (var k2 in acc) { var b = acc[k2]; if (seen[k2]) continue; seen[k2] = 1; out.push({ x0: b.min.x - 0.05, x1: b.max.x + 0.05, z0: b.min.z - 0.05, z1: b.max.z + 0.05, y0: b.min.y - 0.1, y1: b.max.y + 0.6 }); }
    return out;
  }
  function inBox(p, a) { return p.x >= a.x0 && p.x <= a.x1 && p.z >= a.z0 && p.z <= a.z1 && p.y >= a.y0 && p.y <= a.y1; }
  function platePass(scene, px, g) {
    var plates = []; scene.traverse(function (o) { if (o.userData && o.userData.plate41) { plates.push(o); if (!TexC && o.material && o.material.map) { TexC = o.material.map.constructor; PlateMat = o.material.constructor; } } });
    lastPlates = plates.length;
    var filter = !g && cache && layoutOK && !prazoOn(), started = {}, hb = hiddenBoxes(px);
    if (filter) px.children.forEach(function (c) { var u = c.userData || {}; if (u.b && u.s && !isGhost(c)) started[u.b + '|' + u.s] = 1; });
    var wp = new Vec3();
    plates.forEach(function (p) {
      var vis = true; p.getWorldPosition(wp);
      for (var h = 0; h < hb.length && vis; h++) if (inBox(wp, hb[h])) vis = false;
      if (vis && filter) {
        for (var i = 0; i < cache.plates.length; i++) {
          var a = cache.plates[i];
          // continua o nome da peça iniciada/concluída e da peça que está na previsão (até 30/03/2027)
          if (inBox(wp, a)) { vis = !!started[a.b + '|' + a.s] || (on && !!eff(a.b, a.s)); if (vis) break; }
        }
      }
      if (!vis && p.visible) { p.visible = false; p.userData.hid53 = 1; }
      else if (vis && p.userData.hid53) { p.visible = true; delete p.userData.hid53; }
    });
    adPlates(scene, filter ? started : null);
  }
  // Com as partes não iniciadas desligadas o 3D não desenha a placa das aduelas não iniciadas: cria as das que estão na previsão
  function adLabel(id, b) { return id === 'ARR' ? 'AD ARRANQUE ' + b : id === 'FEC' ? 'AD FECHAMENTO ' + b : 'AD ' + String(id.slice(1)).padStart(2, '0') + ' - ' + id[0]; }
  function plateTex(text, sub, H) {
    var key = text + '|' + sub + '|' + H; if (texCache[key]) return texCache[key];
    var S = window.__mobile47 ? 0.5 : 1, cv = document.createElement('canvas'); cv.width = Math.round(1024 * S); cv.height = Math.round(H * S);
    var c = cv.getContext('2d'); c.scale(S, S);
    c.fillStyle = '#0f2a44'; c.fillRect(0, 0, 1024, H); c.fillStyle = '#36b4cc'; c.fillRect(0, 0, 22, H);
    c.strokeStyle = '#ffffff33'; c.lineWidth = 6; c.strokeRect(3, 3, 1018, H - 6);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    var big = Math.round(H * 0.46), ty = H * 0.40;
    c.font = 'bold ' + big + 'px Arial'; c.lineWidth = Math.max(6, big * 0.12); c.strokeStyle = '#05121f'; c.strokeText(text, 523, ty, 940); c.fillStyle = '#ffffff'; c.fillText(text, 523, ty, 940);
    var sm = Math.round(H * 0.22); c.font = 'bold ' + sm + 'px Arial'; c.fillStyle = '#bcd7ea'; c.fillText(sub, 523, H * 0.79, 940);
    var t = new TexC(cv); t.colorSpace = 'srgb'; t.anisotropy = window.__mobile47 ? 1 : 8; t.center.set(0.5, 0.5);
    return (texCache[key] = t);
  }
  function makePlate(a) {
    var id = a.s, b = a.b, bx = a.box, len = bx.max.x - bx.min.x, arr = id === 'ARR', w = Math.max(0.6, Math.min(len - 0.4, arr ? 5.4 : 2.6)), d = w * (arr ? 0.3 : 0.4);
    var H = Math.round(1024 * Math.max(0.22, Math.min(0.6, d / w))), ramo = 'RAMO ' + (b.slice(-2) === '.1' ? '1000' : '2000');
    var g = new Geo(); g.setAttribute('position', new Attr(new Float32Array([-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 0, d / 2, -w / 2, 0, d / 2]), 3));
    g.setAttribute('uv', new Attr(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2)); g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
    var m = new PlateMat({ map: plateTex(adLabel(id, b), arr || id === 'FEC' ? ramo : b + ' · ' + ramo, H), side: 2, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    var o = new Mesh(g, m); o.position.set((bx.min.x + bx.max.x) / 2, 9.12, (bx.min.z + bx.max.z) / 2); o.userData.plate54 = a.b + '|' + a.s;
    return o;
  }
  function adPlates(scene, started) {
    var want = {};
    if (started && TexC && PlateMat && cache && platesOn() && on) {
      for (var k in cache.adu) { var a = cache.adu[k]; if (!started[k] && eff(a.b, a.s) && !hid(a.b, a.s)) want[k] = a; }
    }
    if (!plateRoot) { plateRoot = new Group(); plateRoot.name = 'Placas da previsão (V1.54)'; }
    for (var k1 in myPlates) if (!want[k1]) { var o = myPlates[k1]; plateRoot.remove(o); o.geometry.dispose(); o.material.dispose(); delete myPlates[k1]; }
    for (var k2 in want) if (!myPlates[k2]) { try { myPlates[k2] = makePlate(want[k2]); plateRoot.add(myPlates[k2]); } catch (e) {} }
    if (plateRoot.parent !== scene) scene.add(plateRoot);
  }
  function flipPlates() {   // texto sempre de frente para quem olha (como as placas do 3D)
    if (!plateRoot || !plateRoot.children.length || !window.__v22 || !window.__v22.camera) return;
    var cp = window.__v22.camera.position;
    plateRoot.children.forEach(function (o) { var m = o.material.map, want = cp.z - o.position.z < 0 ? Math.PI : 0; if (m && m.rotation !== want) m.rotation = want; });
  }

  // pré-lajes ainda não iniciadas somem junto (ficam só as concluídas e em execução)
  function prelajePass(g) {
    var v = window.__v48; if (!v || !v.meshes || !v.spec || !v.status) return;
    var restore = false, plOff = !!(window.__oc54 && window.__oc54.prelajeOff), hideAll = (!g && !prazoOn()) || plOff;
    v.spec.forEach(function (s) {
      var im = v.meshes.get(s.uid); if (!im) return;
      var k = ''; try { k = v.status(s).k; } catch (e) { return; }
      if (hideAll && k !== 'ok' && k !== 'and') { if (im.visible) { im.visible = false; im.userData.hid53 = 1; } }
      else if (im.userData.hid53) { delete im.userData.hid53; restore = true; }
    });
    if (restore) { try { v.paint(); } catch (e) {} }
  }

  // ---------- legenda, botões e painel de cor ----------
  function css() {
    if (document.getElementById('pv54-css')) return;
    var s = document.createElement('style'); s.id = 'pv54-css';
    s.textContent = '#pv53-leg{position:absolute;left:12px;top:56px;z-index:5;max-width:min(320px,calc(100% - 24px));padding:9px 11px;border-radius:10px;background:#11151bdd;border:1px solid #ffffff22;color:#eef1f5;font:12px var(--f34,system-ui);box-shadow:0 6px 24px #0006;pointer-events:none}#pv53-leg b{display:block;font-size:12.5px;margin-bottom:5px}#pv53-leg div{display:flex;align-items:center;gap:7px;margin-top:3px}#pv53-leg i{width:12px;height:12px;border-radius:3px;flex:none;border:1px solid #ffffff55}#pv53-leg span{flex:1}#pv53-leg em{font-style:normal;color:#aab3bd;font-variant-numeric:tabular-nums}#pv53-leg small{display:block;margin-top:6px;color:#aab3bd;font-size:11px;line-height:1.35}@media (max-width:760px){#pv53-leg{top:auto;bottom:12px;left:8px;max-width:calc(100% - 128px);font-size:11px;padding:7px 9px}}' +
      // barra de botões do 3D: com os botões novos ela quebra em duas linhas (sem cobrir os botões "lado") e, no celular, rola de lado
      '.v23-zoom{flex-wrap:wrap!important;justify-content:flex-end!important;row-gap:6px;max-width:calc(100% - 330px)}@media (max-width:760px){.v23-zoom{left:5px!important;max-width:none;flex-wrap:nowrap!important;justify-content:flex-start!important;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.v23-zoom::-webkit-scrollbar{display:none}.v23-zoom>*{flex:none!important}.v23-zoom button{white-space:nowrap}}' +
      '#pc54-pan{position:fixed;z-index:2147482000;width:min(300px,calc(100vw - 24px));padding:12px 13px 13px;border-radius:12px;background:#11151bf5;border:1px solid #ffffff26;color:#eef1f5;font:12.5px var(--f34,system-ui);box-shadow:0 14px 40px #000a;backdrop-filter:blur(10px)}#pc54-pan[hidden]{display:none}#pc54-pan h4{margin:0 0 2px;font-size:13px}#pc54-pan p{margin:0 0 9px;color:#aab3bd;font-size:11.5px;line-height:1.35}' +
      '#pc54-pan .sw{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:10px}#pc54-pan .sw button{height:30px;border-radius:8px;border:2px solid transparent;cursor:pointer;box-shadow:inset 0 0 0 1px #0004}#pc54-pan .sw button[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 2px #FDB900}' +
      '#pc54-pan label{display:flex;align-items:center;gap:8px;margin-top:8px}#pc54-pan label span{flex:1}#pc54-pan input[type=color]{width:42px;height:28px;padding:0;border:1px solid #ffffff33;border-radius:6px;background:none;cursor:pointer}#pc54-pan input[type=range]{flex:1.4;accent-color:#FDB900}#pc54-pan output{min-width:38px;text-align:right;font-variant-numeric:tabular-nums;color:#dfe4ea}' +
      '#pc54-pan .pv{margin-top:10px;height:34px;border-radius:8px;background:repeating-linear-gradient(45deg,#3b4450 0 8px,#2a313a 8px 16px);position:relative;overflow:hidden}#pc54-pan .pv i{position:absolute;inset:6px 10px;border-radius:5px;border:2px solid}#pc54-pan .ft{display:flex;justify-content:space-between;align-items:center;margin-top:11px}#pc54-pan .ft small{color:#aab3bd;font-size:11px}#pc54-pan .ft button{font:inherit;font-size:12px;border:1px solid #ffffff33;background:#ffffff12;color:#eef1f5;border-radius:7px;padding:6px 10px;cursor:pointer}';
    document.head.append(s);
  }
  function legend() {
    css();
    if (!leg) { leg = document.createElement('div'); leg.id = 'pv53-leg'; }
    var pad = document.getElementById('pad50'), host = pad ? pad.parentElement : null;
    if (!on || prazoOn() || !host) { if (leg.isConnected) leg.remove(); return; }
    if (leg.parentElement !== host) host.append(leg);
    var g = ghostOn(), note = !g && cache && !layoutOK ? '<small>Volte à vista geral da ponte para ver a previsão sem as partes não iniciadas.</small>' : '';
    var sm = innerWidth < 760;
    var C = window.__cen59, cn = C ? C.name(C.active()) : '';
    leg.innerHTML = '<b>Previsão do cronograma</b>' + (cn ? '<small class="cn59">Cenário: ' + cn.replace(/[&<>]/g, '') + '</small>' : '') + '<div><i style="background:#969ba0"></i><span>' + (sm ? 'Concluída ou prev. até 31/12/26' : 'Concluída ou prevista até 31/12/2026') + '</span><em>' + counts.c1 + (sm ? '' : ' prev.') + '</em></div><div><i style="background:' + rgba(style.color, Math.max(0.35, style.opacity)) + ';border-color:' + mix(style.color, 0, 0.28) + '"></i><span>' + (sm ? 'Prevista até 30/03/27' : 'Prevista de 01/01 a 30/03/2027') + '</span><em>' + counts.c2 + '</em></div>' +
      Object.keys(ccounts).map(function (c) { return '<div><i style="background:' + rgba(c, Math.max(0.35, style.opacity)) + ';border-color:' + mix(c, 0, 0.28) + '"></i><span>Pintura livre</span><em>' + ccounts[c] + '</em></div>'; }).join('') + note;
  }
  function mountBtn() {
    var f = document.getElementById('v23-focus'); if (!f) return false;
    var made = false;
    if (!btn || !btn.isConnected) { made = true;
      btn = document.createElement('button'); btn.type = 'button'; btn.id = 'pv53-btn'; btn.className = f.className; btn.title = 'Mostrar a previsão do cronograma (aduelas, estacas, blocos, pilares, travessas e pilaretes)';
      btn.onclick = function () { on = !on; if (!PUB) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} } state(); lastPx = null; };
      var after = document.getElementById('pl50-btn') || f; after.after(btn);
    }
    if (!cbtn || !cbtn.isConnected) { made = true;
      cbtn = document.createElement('button'); cbtn.type = 'button'; cbtn.id = 'pc54-btn'; cbtn.className = f.className; cbtn.title = 'Escolher a cor e a transparência da previsão de 01/01 a 30/03/2027';
      cbtn.setAttribute('aria-haspopup', 'dialog'); cbtn.onclick = function (e) { e.stopPropagation(); togglePanel(); };
      btn.after(cbtn);
    }
    if (made) state(); return true;
  }
  function state() {
    if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.textContent = innerWidth < 760 ? 'Previsão' : (on ? 'Previsão: ligada' : 'Previsão: desligada'); }
    if (cbtn) { cbtn.innerHTML = '<i style="display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px;background:' + rgba(style.color, Math.max(0.45, style.opacity)) + ';border:1px solid ' + mix(style.color, 0, 0.3) + '"></i>' + (innerWidth < 760 ? 'Cor' : 'Cor da previsão'); cbtn.hidden = !on; cbtn.setAttribute('aria-expanded', String(!!(pan && !pan.hidden))); }
    if (root) root.visible = on && !prazoOn();
    if (plateRoot) plateRoot.visible = on && !prazoOn();
    legend();
  }
  function buildPanel() {
    css();
    pan = document.createElement('div'); pan.id = 'pc54-pan'; pan.hidden = true; pan.setAttribute('role', 'dialog'); pan.setAttribute('aria-label', 'Cor da previsão');
    pan.innerHTML = '<h4>Previsão de 01/01 a 30/03/2027</h4><p>Até 31/12/2026 a previsão fica no mesmo cinza das peças concluídas.</p><div class="sw">' +
      SWATCHES.map(function (s) { return '<button type="button" data-c="' + s[1] + '" title="' + s[0] + '" aria-label="' + s[0] + '" style="background:' + s[1] + '"></button>'; }).join('') +
      '<button type="button" data-c="custom" title="Outra cor" aria-label="Outra cor" style="background:conic-gradient(#ef5350,#f6d34a,#66bb6a,#26c6da,#42a5f5,#9575cd,#f06292,#ef5350)"></button></div>' +
      '<label><span>Outra cor</span><input type="color" aria-label="Escolher outra cor"></label>' +
      '<label><span>Transparência</span><input type="range" min="0" max="90" step="5" aria-label="Transparência da peça"><output></output></label>' +
      '<div class="pv" aria-hidden="true"><i></i></div><div class="ft"><small>Salvo neste aparelho</small><button type="button" class="rs">Voltar ao padrão</button></div>';
    document.body.append(pan);
    var col = pan.querySelector('input[type=color]'), rng = pan.querySelector('input[type=range]');
    pan.querySelectorAll('.sw button').forEach(function (b) { b.onclick = function () { if (b.dataset.c === 'custom') { col.click(); return; } style.color = b.dataset.c; saveStyle(); applyStyle(); state(); }; });
    col.oninput = function () { style.color = col.value; saveStyle(); applyStyle(); state(); };
    rng.oninput = function () { style.opacity = Math.round((1 - rng.value / 100) * 100) / 100; saveStyle(); applyStyle(); state(); };
    pan.querySelector('.rs').onclick = function () { style = { color: DEF.color, opacity: DEF.opacity }; saveStyle(); applyStyle(); state(); };
    pan.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { if (pan && !pan.hidden) { pan.hidden = true; state(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pan && !pan.hidden) { pan.hidden = true; state(); cbtn && cbtn.focus(); } });
    addEventListener('resize', place); addEventListener('scroll', place, true);
  }
  function place() {
    if (!pan || pan.hidden || !cbtn) return;
    var r = cbtn.getBoundingClientRect(), w = pan.offsetWidth || 300;
    pan.style.left = Math.max(12, Math.min(r.right - w, innerWidth - w - 12)) + 'px';
    pan.style.top = Math.min(r.bottom + 8, innerHeight - pan.offsetHeight - 12) + 'px';
  }
  function paintPanel() {
    if (!pan) return;
    var known = SWATCHES.some(function (s) { return s[1].toLowerCase() === style.color.toLowerCase(); });
    pan.querySelectorAll('.sw button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.c === 'custom' ? !known : b.dataset.c.toLowerCase() === style.color.toLowerCase())); });
    var t = Math.round((1 - style.opacity) * 100);
    pan.querySelector('input[type=color]').value = style.color; pan.querySelector('input[type=range]').value = t; pan.querySelector('output').textContent = t + '%';
    var i = pan.querySelector('.pv i'); i.style.background = rgba(style.color, style.opacity); i.style.borderColor = mix(style.color, 0, 0.28);
  }
  function togglePanel() { if (!pan) buildPanel(); pan.hidden = !pan.hidden; if (!pan.hidden) { paintPanel(); place(); } state(); }

  // ---------- laço principal ----------
  function tick() {
    var scene = window.__v40 && window.__v40.scene; if (!scene) return;
    if (!Mesh) {
      scene.traverse(function (o) {
        if (!Mesh && o.isMesh && !o.isInstancedMesh && o.material && o.material.isMeshStandardMaterial && !o.material.map) { Mesh = o.constructor; mats = { c1: o.material.clone(), c2: o.material.clone() }; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); Box3 = o.geometry.boundingBox.constructor; Vec3 = o.geometry.boundingBox.min.constructor; Attr = o.geometry.attributes.position.constructor;
          // BufferGeometry "pura" (a malha encontrada pode ser uma BoxGeometry etc., que já nasce com índice próprio)
          for (var pr = Object.getPrototypeOf(o.geometry); pr && !Geo; pr = Object.getPrototypeOf(pr)) { if (Object.prototype.hasOwnProperty.call(pr, 'constructor')) { try { if (new pr.constructor().type === 'BufferGeometry') Geo = pr.constructor; } catch (x) {} } } }
        if (!Lines && o.isLineSegments && o.material && o.material.isLineBasicMaterial && !Array.isArray(o.material)) { Lines = o.constructor; lmats = { c1: o.material.clone(), c2: o.material.clone() }; }
        if (!Group && o.isGroup) Group = o.constructor; });
      if (!Mesh || !Group) return;
      if (Attr && !/BufferAttribute$/.test(Attr.name || '') && Attr.prototype && !('setXYZ' in Attr.prototype)) Attr = null;
      if (!Attr || !Geo) { Mesh = null; return; }
      ['c1', 'c2'].forEach(function (k) { var m = mats[k]; m.roughness = 0.5; m.metalness = 0; m.side = 0; m.map = null; m.vertexColors = false; if (lmats) lmats[k].vertexColors = false; });
      applyStyle();
      root = new Group(); root.name = 'Previsão do cronograma (V1.54)';
    }
    mountBtn();
    if (!listening) { var gb = document.getElementById('av-ghost'); if (gb) { listening = true; gb.addEventListener('change', function () { setTimeout(function () { prelajePass(ghostOn()); }, 30); setTimeout(tick, 60); }); } }
    var px = findProxies(scene); try { if (px && window.__aj55 && window.__aj55.fix) window.__aj55.fix(px); } catch (e) {}
    var g = ghostOn() || prazoOn(), sig = px ? px.uuid + ':' + px.children.length + ':' + (px.children[0] ? px.children[0].uuid : '') : '';
    if (px) lastPxObj = px;
    if (px && (sig !== lastPx || g !== lastGhost)) { lastPx = sig; lastGhost = g; rebuild(scene, px, g); platePass(scene, px, g); prelajePass(g); lastPre = Date.now(); }
    else if (px) {
      var n = 0; scene.traverse(function (o) { if (o.userData && o.userData.plate41) n++; });
      if (n !== lastPlates) platePass(scene, px, g);
      if (Date.now() - lastPre > 2500) { lastPre = Date.now(); prelajePass(g); }
    }
    if (root && root.parent !== scene) scene.add(root);
    if (root) root.visible = on && !prazoOn();
    if (plateRoot) plateRoot.visible = on && !prazoOn();
    if (leg && ((on && !prazoOn()) !== leg.isConnected)) legend();
  }
  setInterval(tick, 700);
  setInterval(flipPlates, 250);
  // troca de cenário: outro cronograma e/ou outra pintura
  (function hookScen() {
    var C = window.__cen59; if (!C) { setTimeout(hookScen, 300); return; }
    C.on(function () { loadBase(); lastPx = null; legend(); tick(); });
    if (loadBase()) { lastPx = null; }
  })();
  window.__prev53 = {
    get: get, band: band, eff: eff, manual: manual, pick: pick,
    // etapas ainda não iniciadas da peça na situação atual (0 = peça já toda executada ou fora da vista)
    pending: function (b, s) {
      if (!cache) return 0; var g = ghostOn() || prazoOn(), cu = !g && lastPxObj ? current(lastPxObj) : null, n = 0;
      cache.items.forEach(function (it) { if (it.b === b && it.s === s && (g ? it.ghost : !!cu && !cu.present[it.key] && !!cu.bset[it.b])) n++; });
      return n; },
    get customCounts() { return ccounts; },
    refresh: function () { lastPx = null; tick(); },
    chipStyle: function (b, s) { var k = eff(b, s); if (k && k[0] === '#') return { bg: rgba(k, 0.22), fg: mix(k, 255, 0.45) }; return k === 'c1' ? { bg: '#969ba033', fg: '#dfe3e7' } : k === 'c2' ? { bg: rgba(style.color, 0.22), fg: mix(style.color, 255, 0.45) } : { bg: '#ffffff14', fg: '#c9d0d8' }; },
    get style() { return { color: style.color, opacity: style.opacity }; },
    setStyle: function (c, o) { if (c) style.color = c; if (o != null) style.opacity = Math.max(0.1, Math.min(1, o)); saveStyle(); applyStyle(); state(); },
    get data() { var o = {}; for (var k in D) { var i = k.indexOf('-'), b = k.slice(0, i); (o[b] = o[b] || {})[k.slice(i + 1)] = [D[k][0], D[k][1]]; } return o; },
    get counts() { return counts; }, get shown() { return shown.slice(); }, get ready() { return !!cache; }, get layoutOK() { return layoutOK; },
    get adPlates() { return Object.keys(myPlates); },
    toggle: function (v) { on = v == null ? !on : !!v; state(); lastPx = null; },
    get on() { return on; }, get base() { return BASE; },
    prelajes: function () { prelajePass(ghostOn() || prazoOn()); }
  };
})();
