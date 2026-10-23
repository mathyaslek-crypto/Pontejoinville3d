/* Ponte Joinville — ajustes de geometria do modelo 3D
   V1.55  Apoio 04 (ramo 1000): blocos 04.1 e 04.2 na altura do bloco 05.1; pilares encurtam por baixo (topo no mesmo
          lugar, travessa na mesma altura) e as estacas acompanham o bloco. Ajuste feito nos dados ao abrir o 3D.
   V1.58  Correções de desenho aplicadas depois de cada montagem do 3D (antes do primeiro quadro):
          · travessas 02A e 03A (ramo 2000, giradas): o 3D subia a base no lugar do corpo, e os pilaretes ficavam
            soltos ~1 m acima. A base volta à altura certa e o corpo sobe até o topo das vigas, como nas outras.
          · cortinas dos encontros 1, 1A, 16 e 16.1: vão da ponta das vigas até a laje da transição (sem fresta).
          · linhas de contorno: o 3D cortava/subia pilaretes, corpo das travessas e cortinas mas deixava as linhas
            no lugar antigo (parecia um pilarete duplicado em cima do outro). As linhas dessas peças são refeitas. */
(function () {
  'use strict';
  var t0 = Date.now();
  function find(L, id) { for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
  function adjust() {
    var tr = null; try { tr = window.__v40 && window.__v40.tr(); } catch (e) {}
    if (!tr || !tr['9.1']) return null;
    var L = tr['9.1'], ref = find(L, 'S5_EB1'), changed = false;
    if (!ref) return false;
    [1, 2].forEach(function (n) {
      var eb = find(L, 'S4_EB' + n), ep = find(L, 'S4_EP' + n);
      if (!eb || eb.adj55 != null) return;
      var dy = ref.y - eb.y; eb.adj55 = dy;
      if (Math.abs(dy) < 0.01) return;
      if (ep) { var top = ep.y + ep.h / 2, bot = ref.y + eb.h / 2; ep.h = Math.max(0.3, top - bot); ep.y = (top + bot) / 2; }
      eb.y = ref.y;
      L.forEach(function (p) { if (p.id.indexOf('S4_PE' + n) === 0) p.y += dy; });
      changed = true;
    });
    return changed;
  }
  function built() { var s = window.__v40 && window.__v40.scene, ok = false; if (s) s.traverse(function (o) { if (!ok && o.name === 'Peças para seleção') ok = true; }); return ok; }
  (function loop() {
    var r = adjust();
    if (r === null) { if (Date.now() - t0 < 90000) setTimeout(loop, 150); return; }
    if (r && built()) { try { window.__v31.rebuild(); } catch (e) { console.warn('ajustes3d', e); } }
  })();

  // =====================================================================================================
  // V1.58 — correções depois de cada montagem
  // =====================================================================================================
  var rnRef = null, lastSig = '', stats = { runs: 0, trav: [], cort: [], edges: null, ms: 0 };
  var EDGE = 0x617385, FORM = 0xf2cd31, WEB_UP = 1.7;
  var H = function (x, y, z) { return Math.round(x * 1000) + ',' + Math.round(y * 1000) + ',' + Math.round(z * 1000); };

  function findPx() {
    if (rnRef && rnRef.parent) {
      var ch = rnRef.children;
      for (var i = ch.length - 1; i >= 0; i--) if (ch[i].name === 'Peças para seleção') return ch[i];
    }
    var s = window.__v40 && window.__v40.scene, px = null; if (!s) return null;
    s.traverse(function (o) { if (!px && o.name === 'Peças para seleção') px = o; });
    rnRef = px ? px.parent : null; return px;
  }
  function frame(b, p) {   // eixo local do apoio: u ao longo do vão, v ao longo do apoio
    var c = window.__v43.uf(b, p), a = p.angle || 0, co = Math.cos(a), si = Math.sin(a);
    return {
      cx: c[0], cz: c[2], co: co, si: si,
      u: function (x, z) { return (x - c[0]) * co - (z - c[2]) * si; },
      v: function (x, z) { return (x - c[0]) * si + (z - c[2]) * co; },
      xz: function (u, v) { return [c[0] + u * co + v * si, c[2] - u * si + v * co]; }
    };
  }
  function partsBy(px, re) {
    var out = {};
    px.children.forEach(function (c) { var u = c.userData || {}; if (c.isMesh && u.b && u.s && re.test(u.s)) (out[u.b + '|' + u.s] = out[u.b + '|' + u.s] || []).push(c); });
    return out;
  }
  function boxOf(geo) { if (!geo.boundingBox) geo.computeBoundingBox(); return geo.boundingBox; }
  // aplica fn(x,y,z)->[x,y,z] nos vértices da peça de seleção e nos mesmos vértices das malhas agrupadas do 3D
  function remap(rn, px, part, fn) {
    var pos = part.geometry.attributes.position, map = new Map(), bb = boxOf(part.geometry).clone().expandByScalar(0.01), i, r;
    for (i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = H(x, y, z);
      if (!map.has(k)) map.set(k, fn(x, y, z));
      r = map.get(k); pos.setXYZ(i, r[0], r[1], r[2]);
    }
    pos.needsUpdate = true; part.geometry.computeBoundingBox(); part.geometry.computeBoundingSphere();
    var n = 0;
    rn.children.forEach(function (o) {
      if (o === px || !o.isMesh || o.isInstancedMesh || (o.userData && o.userData.s) || !o.geometry || !o.geometry.attributes.position) return;
      var g = o.geometry, a = g.attributes.position, gb = boxOf(g); if (!gb.intersectsBox(bb)) return;
      var arr = a.array, ch = false;
      for (var j = 0; j < a.count; j++) {
        var X = arr[j * 3], Y = arr[j * 3 + 1], Z = arr[j * 3 + 2];
        if (X < bb.min.x || X > bb.max.x || Y < bb.min.y || Y > bb.max.y || Z < bb.min.z || Z > bb.max.z) continue;
        r = map.get(H(X, Y, Z)); if (!r) continue;
        arr[j * 3] = r[0]; arr[j * 3 + 1] = r[1]; arr[j * 3 + 2] = r[2]; ch = true; n++;
      }
      if (ch) { a.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere(); }
    });
    return n;
  }
  function localRange(part, F) {
    var pos = part.geometry.attributes.position, r = { u0: 1e9, u1: -1e9, v0: 1e9, v1: -1e9, y0: 1e9, y1: -1e9 };
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), u = F.u(x, z), v = F.v(x, z);
      if (u < r.u0) r.u0 = u; if (u > r.u1) r.u1 = u; if (v < r.v0) r.v0 = v; if (v > r.v1) r.v1 = v; if (y < r.y0) r.y0 = y; if (y > r.y1) r.y1 = y;
    }
    return r;
  }
  // pontas das vigas perto da travessa (mesma regra do 3D: até 2,2 m ao longo do vão e 6,5 m ao longo do apoio)
  function beamEnds(tr, b, F) {
    var out = [];
    (tr[b] || []).forEach(function (q) {
      if (q.retired23 || !/^GB/.test(q.id) || !q.w) return;
      var c; try { c = window.__v43.uf(b, q); } catch (e) { return; }
      var a = q.angle || 0, ux = Math.cos(a), uz = -Math.sin(a), h = q.w / 2;
      [[c[0] + ux * h, c[2] + uz * h], [c[0] - ux * h, c[2] - uz * h]].forEach(function (e) {
        var u = F.u(e[0], e[1]), v = F.v(e[0], e[1]); if (Math.abs(u) < 2.2 && Math.abs(v) < 6.5) out.push(u);
      });
    });
    return out;
  }

  // ---------- travessas em que o 3D subiu a base no lugar do corpo ----------
  function fixTrav(tr, rn, px) {
    var by = partsBy(px, /(?:^|_)TRAV$/), done = [];
    Object.keys(by).forEach(function (key) {
      var i = key.indexOf('|'), b = key.slice(0, i), s = key.slice(i + 1), p = find(tr[b] || [], s); if (!p) return;
      var F = frame(b, p), L = by[key].map(function (c) { return { c: c, r: localRange(c, F) }; })
        .filter(function (x) { return x.r.v1 - x.r.v0 > 10.5; });           // base e corpo ocupam o apoio inteiro
      if (L.length < 2) return;
      L.sort(function (a, c) { return a.r.y0 - c.r.y0; });
      var base = L[0], web = L[1];
      if ((base.r.y1 - base.r.y0) <= (web.r.y1 - web.r.y0) + 0.3) return;    // normal: o corpo é a parte alta
      var us = beamEnds(tr, b, F), lf = us.filter(function (u) { return u < -0.3; }), rt = us.filter(function (u) { return u > 0.3; });
      var Lw = lf.length ? Math.min(1.9, Math.min.apply(0, lf.map(function (u) { return -u; }))) : 0.8;
      var Rw = rt.length ? Math.min(1.9, Math.min.apply(0, rt)) : 0.8;
      var bm = (base.r.y0 + base.r.y1) / 2, wm = (web.r.y0 + web.r.y1) / 2;
      remap(rn, px, base.c, function (x, y, z) {
        var u = F.u(x, z), v = F.v(x, z), nu = u < -0.3 ? -1.9 : u > 0.3 ? 1.9 : u, q = F.xz(nu, v);
        return [q[0], y > bm ? y - WEB_UP : y, q[1]];
      });
      remap(rn, px, web.c, function (x, y, z) {
        var u = F.u(x, z), v = F.v(x, z), nu = u < -0.3 ? -Lw : u > 0.3 ? Rw : u, q = F.xz(nu, v);
        return [q[0], y > wm ? y + WEB_UP : y, q[1]];
      });
      done.push(key);
    });
    return done;
  }

  // ---------- cortinas dos encontros: da ponta das vigas até a laje da transição ----------
  function fixCortinas(tr, rn, px) {
    var walls = partsBy(px, /^EN[0-9A]+_WALL$/), lajes = partsBy(px, /^T\d_M1_LAJE$/), done = [];
    Object.keys(walls).forEach(function (key) {
      var i = key.indexOf('|'), b = key.slice(0, i), s = key.slice(i + 1), p = find(tr[b] || [], s); if (!p || p.kind23 !== 'wall') return;
      var cort = walls[key].filter(function (c) { return c.userData.k === 1; }); if (!cort.length) return;
      var F = frame(b, p), dir = p.dir || 1, W = function (x, z) { return dir * F.u(x, z); };
      var wT = 0.65, laje = lajes[b + '|T' + p.transition + '_M1_LAJE'];
      if (laje) {
        var m = 1e9; laje.forEach(function (c) { var a = c.geometry.attributes.position; for (var j = 0; j < a.count; j++) { var x = a.getX(j), z = a.getZ(j); if (Math.abs(F.v(x, z)) < 6.6) m = Math.min(m, W(x, z)); } });
        if (m < 5) wT = m;
      }
      cort.forEach(function (c) {
        var a = c.geometry.attributes.position, w0 = 1e9, w1 = -1e9;
        for (var j = 0; j < a.count; j++) { var w = W(a.getX(j), a.getZ(j)); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
        if (wT - w1 < 0.02 || wT - w1 > 2.6) return;
        var mid = (w0 + w1) / 2;
        remap(rn, px, c, function (x, y, z) {
          if (W(x, z) <= mid) return [x, y, z];
          var q = F.xz(dir * wT, F.v(x, z)); return [q[0], y, q[1]];
        });
        done.push(key + ' ' + (wT - w0).toFixed(2) + ' m');
      });
    });
    return done;
  }

  // ---------- linhas de contorno refeitas a partir das peças de seleção ----------
  function featureEdges(geo, out) {     // mesmo critério do EdgesGeometry do 3D (ângulo de 12°)
    var pos = geo.attributes.position, ix = geo.index, n = ix ? ix.count : pos.count, cos = Math.cos(12 * Math.PI / 180), E = {}, P = [], i, j;
    var hv = function (k) { return Math.round(pos.getX(k) * 1e4) + ',' + Math.round(pos.getY(k) * 1e4) + ',' + Math.round(pos.getZ(k) * 1e4); };
    for (i = 0; i + 2 < n; i += 3) {
      var a = ix ? ix.getX(i) : i, b = ix ? ix.getX(i + 1) : i + 1, c = ix ? ix.getX(i + 2) : i + 2, vs = [a, b, c];
      var ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a), ux = pos.getX(b) - ax, uy = pos.getY(b) - ay, uz = pos.getZ(b) - az, wx = pos.getX(c) - ax, wy = pos.getY(c) - ay, wz = pos.getZ(c) - az;
      var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz); if (l < 1e-10) continue; nx /= l; ny /= l; nz /= l;
      var hs = [hv(a), hv(b), hv(c)]; if (hs[0] === hs[1] || hs[1] === hs[2] || hs[2] === hs[0]) continue;
      for (j = 0; j < 3; j++) {
        var k0 = hs[j], k1 = hs[(j + 1) % 3], key = k0 + '_' + k1, rev = k1 + '_' + k0;
        if (E[rev]) { var e = E[rev]; if (nx * e.n[0] + ny * e.n[1] + nz * e.n[2] <= cos) P.push(e.a, e.b); E[rev] = null; }
        else if (!(key in E)) E[key] = { a: vs[j], b: vs[(j + 1) % 3], n: [nx, ny, nz] };
      }
    }
    for (var k in E) if (E[k]) P.push(E[k].a, E[k].b);
    for (i = 0; i < P.length; i += 2) out.push([pos.getX(P[i]), pos.getY(P[i]), pos.getZ(P[i]), pos.getX(P[i + 1]), pos.getY(P[i + 1]), pos.getZ(P[i + 1])]);
  }
  function segKey(s) { var a = H(s[0], s[1], s[2]), b = H(s[3], s[4], s[5]); return a < b ? a + '|' + b : b + '|' + a; }
  function pointOnTri(px_, py, pz, t) {   // ponto sobre o triângulo (tolerância 2 mm)
    var ax = t[0], ay = t[1], az = t[2], ux = t[3] - ax, uy = t[4] - ay, uz = t[5] - az, wx = t[6] - ax, wy = t[7] - ay, wz = t[8] - az;
    var nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, l = Math.hypot(nx, ny, nz); if (l < 1e-10) return false;
    var dx = px_ - ax, dy = py - ay, dz = pz - az; if (Math.abs((dx * nx + dy * ny + dz * nz) / l) > 0.002) return false;
    var uu = ux * ux + uy * uy + uz * uz, uw = ux * wx + uy * wy + uz * wz, ww = wx * wx + wy * wy + wz * wz, du = dx * ux + dy * uy + dz * uz, dw = dx * wx + dy * wy + dz * wz, den = uu * ww - uw * uw;
    if (Math.abs(den) < 1e-12) return false;
    var s = (ww * du - uw * dw) / den, r = (uu * dw - uw * du) / den, e = 0.002 / Math.sqrt(Math.max(uu, ww));
    return s >= -e && r >= -e && s + r <= 1 + e;
  }
  function trisOf(c) {
    if (c.userData.tris58 && c.userData.tris58.g === c.geometry && c.userData.tris58.v === c.geometry.attributes.position.version) return c.userData.tris58.t;
    var g = c.geometry, a = g.attributes.position, ix = g.index, n = ix ? ix.count : a.count, t = [];
    for (var i = 0; i + 2 < n; i += 3) { var q = []; for (var j = 0; j < 3; j++) { var k = ix ? ix.getX(i + j) : i + j; q.push(a.getX(k), a.getY(k), a.getZ(k)); } t.push(q); }
    c.userData.tris58 = { g: g, v: a.version, t: t }; return t;
  }
  function fixEdges(rn, px) {
    var TARGET = /(?:^|_)TRAV$|_TRAV_P[A-F]$|^EN[0-9A]+_WALL$/;
    var lines = rn.children.filter(function (o) { return o.isLineSegments && !o.name && o.material && o.material.color && o.material.color.getHex() === EDGE && !(o.userData && o.userData.s); });
    if (!lines.length) return null;
    var lineFor = function (op) { var want = op < 0.2 ? 0.27 : 0.38, best = null; lines.forEach(function (l) { if (!best || Math.abs(l.material.opacity - want) < Math.abs(best.material.opacity - want)) best = l; }); return best; };
    // regiões das peças-alvo (caixa da peça, um pouco maior; pilaretes: inclui onde o topo estava antes do corte)
    var regs = [], tgt = {}, others = [];
    px.children.forEach(function (c) { var u = c.userData || {}; if (!c.isMesh || !u.s) return; if (TARGET.test(u.s)) (tgt[u.b + '|' + u.s] = tgt[u.b + '|' + u.s] || []).push(c); else others.push(c); });
    Object.keys(tgt).forEach(function (k) {
      var bb = null; tgt[k].forEach(function (c) { var b = boxOf(c.geometry); bb = bb ? bb.union(b.clone()) : b.clone(); });
      bb.expandByScalar(0.02); if (/_TRAV_P[A-F]$/.test(k)) bb.max.y += 1.25;
      regs.push(bb);
    });
    if (!regs.length) return null;
    var CELL = 4, grid = new Map();
    regs.forEach(function (r, i) { for (var gx = Math.floor(r.min.x / CELL); gx <= Math.floor(r.max.x / CELL); gx++) for (var gz = Math.floor(r.min.z / CELL); gz <= Math.floor(r.max.z / CELL); gz++) { var k = gx + ',' + gz; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); } });
    var inside = function (x, y, z, r) { return x >= r.min.x && x <= r.max.x && y >= r.min.y && y <= r.max.y && z >= r.min.z && z <= r.max.z; };
    var regOf = function (s) { var L = grid.get(Math.floor(s[0] / CELL) + ',' + Math.floor(s[2] / CELL)); if (!L) return -1; for (var i = 0; i < L.length; i++) { var r = regs[L[i]]; if (inside(s[0], s[1], s[2], r) && inside(s[3], s[4], s[5], r)) return L[i]; } return -1; };
    // contornos certos das peças-alvo
    var want = new Map();   // segKey -> {s, line}
    Object.keys(tgt).forEach(function (k) {
      tgt[k].forEach(function (c) {
        var m = c.material; if (!m || !m.color || m.color.getHex() === FORM || c.layers.mask === (1 << 30)) return;
        var segs = []; featureEdges(c.geometry, segs);
        var ln = lineFor(m.transparent ? m.opacity : 1);
        segs.forEach(function (s) { var key = segKey(s); if (!want.has(key)) want.set(key, { s: s, line: ln }); });
      });
    });
    // peças vizinhas (vigas, pilares, transição...) que podem ter linhas dentro das regiões
    var near = {}; others.forEach(function (c, i) { var b = boxOf(c.geometry); for (var r = 0; r < regs.length; r++) if (b.intersectsBox(regs[r])) { (near[r] = near[r] || []).push(c); } });
    var removed = 0, kept = 0, added = 0, present = new Set();
    lines.forEach(function (l) {
      var a = l.geometry.attributes.position, arr = a.array, n = a.count, out = new Float32Array(arr.length), m = 0, ch = false;
      for (var i = 0; i + 1 < n; i += 2) {
        var s = [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2], arr[i * 3 + 3], arr[i * 3 + 4], arr[i * 3 + 5]], r = regOf(s), keep = true;
        if (r >= 0) {
          var key = segKey(s);
          if (want.has(key)) { if (present.has(key)) keep = false; else present.add(key); }
          else {
            keep = false;
            var cand = near[r] || [], mx = (s[0] + s[3]) / 2, my = (s[1] + s[4]) / 2, mz = (s[2] + s[5]) / 2;
            for (var c = 0; c < cand.length && !keep; c++) {
              var bb = boxOf(cand[c].geometry); if (!inside(mx, my, mz, { min: { x: bb.min.x - .01, y: bb.min.y - .01, z: bb.min.z - .01 }, max: { x: bb.max.x + .01, y: bb.max.y + .01, z: bb.max.z + .01 } })) continue;
              var T = trisOf(cand[c]), ok0 = false, ok1 = false, okm = false;
              for (var t = 0; t < T.length && !(ok0 && ok1 && okm); t++) { if (!ok0 && pointOnTri(s[0], s[1], s[2], T[t])) ok0 = true; if (!ok1 && pointOnTri(s[3], s[4], s[5], T[t])) ok1 = true; if (!okm && pointOnTri(mx, my, mz, T[t])) okm = true; }
              if (ok0 && ok1 && okm) keep = true;
            }
          }
          if (keep) kept++; else { removed++; ch = true; }
        }
        if (keep) { out.set(s, m); m += 6; }
      }
      l.userData.out58 = { arr: out, m: m, ch: ch };
    });
    var extra = new Map(); lines.forEach(function (l) { extra.set(l, []); });
    want.forEach(function (w, key) { if (!present.has(key) && regOf(w.s) >= 0) { extra.get(w.line).push(w.s); added++; } });
    lines.forEach(function (l) {
      var o = l.userData.out58, ex = extra.get(l); delete l.userData.out58;
      if (!o.ch && !ex.length) return;
      var arr = new Float32Array(o.m + ex.length * 6); arr.set(o.arr.subarray(0, o.m)); var m = o.m;
      ex.forEach(function (s) { arr.set(s, m); m += 6; });
      var G = l.geometry.constructor, A = l.geometry.attributes.position.constructor, g = new G();
      g.setAttribute('position', new A(arr, 3)); g.computeBoundingSphere(); g.computeBoundingBox();
      var old = l.geometry; l.geometry = g; try { old.dispose(); } catch (e) {}
    });
    return { removed: removed, kept: kept, added: added, regions: regs.length };
  }

  function fix(pxGiven) {
    var px = pxGiven || findPx(); if (!px || !px.parent) return false;
    if (pxGiven) rnRef = px.parent;
    var sig = px.uuid + ':' + px.children.length;
    if (sig === lastSig) return false;
    lastSig = sig;
    var tr = null; try { tr = window.__v40.tr(); } catch (e) {}
    if (!tr || !window.__v43 || !window.__v43.uf) { lastSig = ''; return false; }
    var t = performance.now(), rn = px.parent;
    try { stats.trav = fixTrav(tr, rn, px); } catch (e) { console.warn('ajustes3d travessas', e); }
    try { stats.cort = fixCortinas(tr, rn, px); } catch (e) { console.warn('ajustes3d cortinas', e); }
    try { stats.edges = fixEdges(rn, px); } catch (e) { console.warn('ajustes3d linhas', e); }
    stats.runs++; stats.ms = Math.round(performance.now() - t);
    return true;
  }
  // roda antes de cada quadro (só trabalha quando o 3D foi remontado) e também quando os outros scripts pedem
  (function hook() {
    var s = window.__v40 && window.__v40.scene;
    if (!s) { setTimeout(hook, 300); return; }
    var prev = s.onBeforeRender;
    s.onBeforeRender = function () { try { fix(); } catch (e) {} return prev.apply(this, arguments); };
  })();

  window.__aj55 = { adjust: adjust, fix: fix, get stats() { return stats; } };
})();
