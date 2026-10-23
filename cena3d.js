/* Ponte Joinville — cena do 3D (V1.58)
   · Barco: fica um só barco, o de apoio no rio do centro da obra (entre os apoios 9 e 10). Opção "Barco" no painel
     mostra/esconde. Escondido, ele espera no cais e não leva ninguém.
   · Colaboradores: opção "Colaboradores" no painel mostra/esconde os bonecos. Cada boneco tinha ~36 pecinhas
     desenhadas separadas; aqui as pecinhas paradas entre si são juntadas (corpo, cada perna, cada braço), com as
     mesmas cores e o mesmo acabamento — o boneco continua andando e mexendo braços e pernas igual.
   · Tela do 3D mais alta fora da tela cheia (ocupa quase toda a altura da janela). */
(function () {
  'use strict';
  var PUB = window.__pub58 || null;
  var K_W = 'ponte-bonecos-v58', K_B = 'ponte-barco-v58';
  function rd(k, def) { if (PUB && PUB.cena && k in PUB.cena) return PUB.cena[k]; try { var v = localStorage.getItem(k); return v == null ? def : v === '1'; } catch (e) { return def; } }
  function wr(k, v) { if (PUB) return; try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} }
  var workersOn = rd(K_W, true), boatOn = rd(K_B, true);

  // ---------- tela do 3D mais alta ----------
  var css = document.createElement('style'); css.id = 'cena58-css';
  css.textContent = 'html body #aduela-v1 .av-scene:not(.av-expanded):not(:fullscreen){height:clamp(460px,calc(100vh - 130px),1300px)!important}' +
    '@media (max-width:800px){html body #aduela-v1 .av-scene:not(.av-expanded):not(:fullscreen){height:clamp(340px,64vh,820px)!important}}';
  document.head.appendChild(css);
  var resized = 0; function kick() { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }
  setTimeout(kick, 600); setTimeout(kick, 2500); setTimeout(kick, 8000);

  // ---------- classes do three.js tiradas da cena ----------
  var C = null;
  function ctors(scene) {
    if (C) return C;
    var c = {};
    scene.traverse(function (o) {
      if (!c.Mesh && o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position && o.material && o.material.isMeshStandardMaterial) {
        c.Mesh = o.constructor; c.Attr = o.geometry.attributes.position.constructor; c.Std = o.material.constructor;
        for (var p = Object.getPrototypeOf(o.geometry); p && !c.BG; p = Object.getPrototypeOf(p)) { if (Object.prototype.hasOwnProperty.call(p, 'constructor')) { try { if (new p.constructor().type === 'BufferGeometry') c.BG = p.constructor; } catch (x) {} } }
      }
    });
    c.M4 = scene.matrix.constructor;
    return (C = c.Mesh && c.BG && c.Std ? c : null);
  }

  // ---------- bonecos: junta as pecinhas de cada parte (corpo, pernas, braços) ----------
  var mats = {};
  function matFor(m) {
    var k = [m.roughness, m.metalness, m.side, m.flatShading].join('|');
    if (!mats[k]) { var n = m.clone(); n.color.setRGB(1, 1, 1); n.vertexColors = true; n.map = null; n.name = 'Boneco (cores por vértice)'; mats[k] = n; }
    return mats[k];
  }
  function mergePart(part, skip) {
    // pecinhas desta parte (sem entrar nas partes que se mexem sozinhas)
    var list = [];
    (function walk(o) { o.children.forEach(function (ch) { if (skip.indexOf(ch) >= 0) return; if (ch.isMesh && !ch.isInstancedMesh && ch.visible && ch.material && !Array.isArray(ch.material) && !ch.material.transparent && ch.material.isMeshStandardMaterial) list.push(ch); walk(ch); }); })(part);
    if (list.length < 2) return 0;
    part.updateMatrixWorld(true);
    var inv = new C.M4().copy(part.matrixWorld).invert(), groups = {};
    list.forEach(function (m) { var k = [m.material.roughness, m.material.metalness, m.material.side, m.material.flatShading].join('|'); (groups[k] = groups[k] || []).push(m); });
    var made = 0;
    Object.keys(groups).forEach(function (k) {
      var L = groups[k], nv = 0;
      L.forEach(function (m) { var g = m.geometry; nv += g.index ? g.index.count : g.attributes.position.count; });
      var P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), CO = new Float32Array(nv * 3), o = 0;
      L.forEach(function (m) {
        var g = m.geometry, pos = g.attributes.position, nor = g.attributes.normal, ix = g.index, n = ix ? ix.count : pos.count;
        var M = new C.M4().multiplyMatrices(inv, m.matrixWorld), e = M.elements;
        var a = e[0], b = e[4], c = e[8], d = e[1], f = e[5], h = e[9], kk = e[2], l = e[6], q = e[10];
        var A = f * q - h * l, B = -(d * q - h * kk), Cc = d * l - f * kk, det = a * A + b * B + c * Cc || 1;
        var n00 = A / det, n01 = B / det, n02 = Cc / det, n10 = -(b * q - c * l) / det, n11 = (a * q - c * kk) / det, n12 = -(a * l - b * kk) / det, n20 = (b * h - c * f) / det, n21 = -(a * h - c * d) / det, n22 = (a * f - b * d) / det;
        var col = m.material.color;
        for (var t = 0; t < n; t++) {
          var tt = det < 0 ? (t % 3 === 1 ? t + 1 : t % 3 === 2 ? t - 1 : t) : t, i = ix ? ix.getX(tt) : tt, j = o * 3;
          var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          P[j] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          if (nor) { var nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i), X = n00 * nx + n01 * ny + n02 * nz, Y = n10 * nx + n11 * ny + n12 * nz, Z = n20 * nx + n21 * ny + n22 * nz, len = Math.hypot(X, Y, Z) || 1; N[j] = X / len; N[j + 1] = Y / len; N[j + 2] = Z / len; }
          CO[j] = col.r; CO[j + 1] = col.g; CO[j + 2] = col.b; o++;
        }
      });
      var geo = new C.BG(); geo.setAttribute('position', new C.Attr(P, 3)); geo.setAttribute('normal', new C.Attr(N, 3)); geo.setAttribute('color', new C.Attr(CO, 3));
      geo.computeBoundingSphere();
      var mesh = new C.Mesh(geo, matFor(L[0].material)); mesh.name = 'Boneco · peças juntas (V1.58)'; mesh.userData.w58 = true;
      mesh.castShadow = L[0].castShadow; mesh.receiveShadow = L[0].receiveShadow;
      part.add(mesh); L.forEach(function (m) { m.visible = false; }); made++;
    });
    return made;
  }
  var stats = { workers: 0, meshes: 0, boatsRemoved: 0 };
  function mergeWorkers() {
    var api = window.__v37a, crew = api && api.crew; if (!crew || !crew.length) return;
    crew.forEach(function (w) {
      var r = w.root; if (!r || r.userData.w58) return;
      r.userData.w58 = true;
      try {
        var limbs = (w.legs || []).concat(w.arms || []);
        stats.meshes += mergePart(r, limbs);
        limbs.forEach(function (l) { stats.meshes += mergePart(l, []); });
        stats.workers++;
      } catch (e) { console.warn('bonecos', e); }
    });
  }

  // ---------- barco único + mostrar/esconder ----------
  function boats() {
    var v = window.__v43; if (!v) return;
    try {
      var others = v.boats;
      if (others && others.length) {
        others.forEach(function (o) { if (o && o.boat) { o.boat.visible = false; if (o.boat.parent) o.boat.parent.remove(o.boat); stats.boatsRemoved++; } });
        others.length = 0;
      }
      var f = v.ferry; if (!f || !f.boat) return;
      if (!boatOn && f.state === 'home') f.state = 'hold58';
      if (boatOn && f.state === 'hold58') f.state = 'home';
      f.boat.visible = boatOn;
    } catch (e) {}
  }
  function workersVis() {
    var api = window.__v37a, crew = api && api.crew; if (!crew) return;
    var f = window.__v43 && window.__v43.ferry, seated = {};
    if (f && !boatOn && f.pax) f.pax.forEach(function (p) { if (p.stage === 'seat' && p.w) seated[p.w.i] = 1; });
    var lite = !!window.__mobile47;
    crew.forEach(function (w) { if (!w.root) return; var v = workersOn && !lite && !seated[w.i]; if (w.root.visible !== v) w.root.visible = v; });
  }

  // ---------- opções no painel ----------
  function toggles() {
    var anchor = document.getElementById('av-aduelas58') || document.getElementById('av-vigas57') || document.getElementById('av-prelaje') || document.getElementById('av-environment');
    if (!anchor || document.getElementById('av-bonecos58')) return;
    var after = anchor.closest('label') || anchor;
    [['av-barco58', 'Barco', function () { return boatOn; }, function (v) { boatOn = v; wr(K_B, v); boats(); workersVis(); }],
     ['av-bonecos58', 'Colaboradores', function () { return workersOn; }, function (v) { workersOn = v; wr(K_W, v); workersVis(); }]].forEach(function (d) {
      var lb = document.createElement('label'); lb.style.cssText = 'flex-direction:row;align-items:center';
      lb.innerHTML = '<input type="checkbox" id="' + d[0] + '"> ' + d[1];
      after.after(lb); var ck = lb.querySelector('input'); ck.checked = d[2](); ck.onchange = function () { d[3](ck.checked); };
    });
  }

  function tick() {
    var scene = window.__v40 && window.__v40.scene; if (!scene) return;
    if (ctors(scene)) mergeWorkers();
    boats(); workersVis(); toggles();
  }
  setInterval(tick, 500);
  window.__cena58 = {
    get stats() { return stats; }, get workers() { return workersOn; }, get boat() { return boatOn; },
    setWorkers: function (v) { workersOn = !!v; wr(K_W, workersOn); var c = document.getElementById('av-bonecos58'); if (c) c.checked = workersOn; workersVis(); },
    setBoat: function (v) { boatOn = !!v; wr(K_B, boatOn); var c = document.getElementById('av-barco58'); if (c) c.checked = boatOn; boats(); workersVis(); }
  };
})();
