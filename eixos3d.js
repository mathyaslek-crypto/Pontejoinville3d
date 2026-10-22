/* Ponte Joinville — eixos no chão do 3D (V1.57: bolinha menor e com acabamento de prancha; linha de eixo traço-ponto)
   Para achar os apoios de longe sem mexer nas placas das peças: em cada vão, uma faixa azul no chão
   atravessando a ponte e, na ponta (do lado de fora), uma bolinha com o número do apoio (AP.xx).
   Como no exemplo (faixa entre o 12 e o 11 com AP.11): o número é o do apoio do vão no sentido do encontro
   para o meio da ponte. Adhemar: 16-15 → AP.15 … 11-10 → AP.10. Boa Vista: 01-02 → AP.02 … 08-09 → AP.09;
   no ramo 2000, 01A-02A → AP.02A … 05A-05 → AP.05. O vão central (09-10) fica sem faixa.
   De longe a bolinha cresce (até não encostar na vizinha) e o número fica sempre de frente para quem olha.
   Liga/desliga em "Eixos no chão", no painel do 3D (fica salvo no aparelho). */
(function () {
  'use strict';
  var KEY = 'ponte-eixos-v56', BLUE = '#2f45e0', NAVY = '#14205c', R0 = 3.0, KMAX = 2.5, WATER = -6.65, ROT0 = 0;
  var show = true; try { show = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  var T = null, root = null, items = [], lastSig = '', timer = null, lastCam = '';

  // vãos: [apoio de onde vem, apoio para onde vai (número na bolinha), ramo] — ramo 'both' atravessa os dois ramos
  var SPANS = [
    ['AP16', 'AP15', 'both'], ['AP15', 'AP14', 'both'], ['AP14', 'AP13', 'both'], ['AP13', 'AP12', 'both'], ['AP12', 'AP11', 'both'], ['AP11', 'AP10', 'both'],
    ['AP08', 'AP09', 'both'], ['AP07', 'AP08', 'both'], ['AP06', 'AP07', 'both'], ['AP05', 'AP06', 'both'],
    ['AP04', 'AP05', '1000'], ['AP03', 'AP04', '1000'], ['AP02', 'AP03', '1000'], ['AP01', 'AP02', '1000'],
    ['AP05A', 'AP05', '2000'], ['AP04A', 'AP05A', '2000'], ['AP03A', 'AP04A', '2000'], ['AP02A', 'AP03A', '2000'], ['AP01A', 'AP02A', '2000']
  ];

  // Altura do terreno: lida direto da malha do "Terreno" (grade regular) com interpolação — sem lançar raio na malha
  // inteira a cada consulta (era isso que pesava). Se a malha não for uma grade, usa o cálculo do 3D com memória.
  var HF = null, memo = new Map();
  function heightfield() {
    if (HF && HF.mesh.parent) return HF; HF = null;
    var scene = window.__v40 && window.__v40.scene, t = null; if (!scene) return null;
    scene.traverse(function (o) { if (!t && o.isMesh && /^Terreno/.test(o.name || '')) t = o; });
    if (!t || !t.geometry || !t.geometry.attributes.position) return null;
    t.updateMatrixWorld(true);
    var pos = t.geometry.attributes.position, n = pos.count, e = t.matrixWorld.elements, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); X[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; Y[i] = e[1] * x + e[5] * y + e[9] * z + e[13]; Z[i] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
    var rowX = Math.abs(Z[1] - Z[0]) < 1e-3, A = rowX ? Z : X, nx = 1; while (nx < n && Math.abs(A[nx] - A[0]) < 1e-3) nx++;
    var nz = n / nx; if (nx < 2 || nz < 2 || nz !== Math.floor(nz)) return null;
    var U = rowX ? X : Z, V = rowX ? Z : X, u0 = U[0], du = (U[nx - 1] - U[0]) / (nx - 1), v0 = V[0], dv = (V[n - 1] - V[0]) / (nz - 1);
    for (var k = 0; k < 40; k++) { var j = Math.floor(Math.random() * n); if (Math.abs(U[j] - (u0 + (j % nx) * du)) > 0.05 || Math.abs(V[j] - (v0 + Math.floor(j / nx) * dv)) > 0.05) return null; }
    return (HF = { mesh: t, rowX: rowX, nx: nx, nz: nz, u0: u0, du: du, v0: v0, dv: dv, Y: Y });
  }
  function ground(x, z) {
    var h = heightfield(), g = null;
    if (h) {
      var u = h.rowX ? x : z, v = h.rowX ? z : x, fu = (u - h.u0) / h.du, fv = (v - h.v0) / h.dv;
      if (fu >= 0 && fv >= 0 && fu <= h.nx - 1 && fv <= h.nz - 1) {
        var i = Math.min(h.nx - 2, Math.floor(fu)), j = Math.min(h.nz - 2, Math.floor(fv)), a = fu - i, b = fv - j, Y = h.Y, r = j * h.nx + i;
        g = (Y[r] * (1 - a) + Y[r + 1] * a) * (1 - b) + (Y[r + h.nx] * (1 - a) + Y[r + h.nx + 1] * a) * b;
      }
    }
    if (g == null) {
      var key = Math.round(x * 2) + ',' + Math.round(z * 2);
      if (memo.has(key)) g = memo.get(key);
      else { try { g = window.__v50geo.ground(x, z); } catch (e) {} memo.set(key, g); }
    }
    return Math.max(isFinite(g) && g != null ? g : WATER, WATER);
  }
  function ctors(scene) {
    if (T) return T;
    var C = {};
    scene.traverse(function (o) {
      if (!C.Mesh && o.isMesh && !o.isInstancedMesh && o.material && o.material.isMeshStandardMaterial && !o.material.map) { C.Mesh = o.constructor; C.Std = o.material.constructor; C.Attr = o.geometry.attributes.position.constructor;
        for (var p = Object.getPrototypeOf(o.geometry); p && !C.BG; p = Object.getPrototypeOf(p)) { if (Object.prototype.hasOwnProperty.call(p, 'constructor')) { try { if (new p.constructor().type === 'BufferGeometry') C.BG = p.constructor; } catch (x) {} } } }
      if (!C.Group && o.isGroup) C.Group = o.constructor;
      if (!C.Tex && o.userData && o.userData.plate41 && o.material && o.material.map) C.Tex = o.material.map.constructor;
    });
    if (!C.Mesh || !C.BG || !C.Group || !C.Tex || !C.Attr) return null;
    return (T = C);
  }

  // posição de cada apoio por ramo, pela travessa (ou encontro / bloco dos apoios 9 e 10)
  function piers() {
    var out = {}, tr = window.__v40.tr(), src = window.__v39.src() || [];
    src.forEach(function (e) {
      if (e.kind !== 'TRAVESSAS') return;
      (e.targets || []).forEach(function (t) {
        var p = (tr[t.b] || []).find(function (q) { return q.id === t.id; }); if (!p) return;
        var u = window.__v43.uf(t.b, p), ap = String(e.apoio).replace(/^AP0+(?=\d)/, 'AP').replace(/^AP(\d)(A?)$/, 'AP0$1$2');
        out[ap + '|' + e.ramo] = { x: u[0], z: u[2] };
      });
    });
    [['9.1', '1000', 'AP09'], ['9.2', '2000', 'AP09'], ['10.1', '1000', 'AP10'], ['10.2', '2000', 'AP10']].forEach(function (a) {
      var p = (tr[a[0]] || []).find(function (q) { return q.id === 'MBL'; }); if (!p) return;
      var u = window.__v43.uf(a[0], p); out[a[2] + '|' + a[1]] = { x: u[0], z: u[2] };
    });
    return out;
  }

  function canvasTex(cv) { var t = new T.Tex(cv); t.colorSpace = 'srgb'; t.anisotropy = window.__mobile47 ? 2 : 8; t.center.set(0.5, 0.5); return t; }
  function tex(text) {
    var S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
    var c = cv.getContext('2d'), num = text.replace(/^AP\.?/, ''), F = 'Arial, Helvetica, sans-serif';
    // anel externo azul, fundo branco levemente acinzentado nas bordas, filete interno
    c.beginPath(); c.arc(256, 256, 244, 0, Math.PI * 2); c.fillStyle = BLUE; c.fill();
    var g = c.createRadialGradient(256, 236, 40, 256, 256, 222); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#eef1f8');
    c.beginPath(); c.arc(256, 256, 222, 0, Math.PI * 2); c.fillStyle = g; c.fill();
    c.beginPath(); c.arc(256, 256, 204, 0, Math.PI * 2); c.lineWidth = 4; c.strokeStyle = 'rgba(47,69,224,.35)'; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillStyle = BLUE; c.font = 'bold 70px ' + F; c.fillText('AP', 256, 178);
    c.beginPath(); c.moveTo(196, 202); c.lineTo(316, 202); c.lineWidth = 5; c.strokeStyle = 'rgba(47,69,224,.55)'; c.stroke();
    var fs = 196; c.font = 'bold ' + fs + 'px ' + F; while (c.measureText(num).width > 320 && fs > 80) { fs -= 6; c.font = 'bold ' + fs + 'px ' + F; }
    c.fillStyle = NAVY; c.fillText(num, 256, 206 + fs * 0.74);
    return canvasTex(cv);
  }
  function shadowTex() {   // sombra suave da bolinha no chão
    var cv = document.createElement('canvas'); cv.width = cv.height = 128; var c = cv.getContext('2d');
    var g = c.createRadialGradient(64, 64, 34, 64, 64, 63); g.addColorStop(0, 'rgba(10,18,40,.42)'); g.addColorStop(1, 'rgba(10,18,40,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); return canvasTex(cv);
  }
  function dashTex() {      // linha de eixo traço-ponto (repete ao longo da faixa)
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 32; var c = cv.getContext('2d');
    c.fillStyle = BLUE; c.fillRect(0, 4, 150, 24); c.beginPath(); c.arc(196, 16, 12, 0, Math.PI * 2); c.fill();
    var t = canvasTex(cv); t.wrapS = 1000; t.wrapT = 1001; return t;    // repetir ao longo / prender nas bordas
  }
  function disc() {
    var n = 56, pos = [0, 0, 0], uv = [0.5, 0.5], ix = [];
    for (var i = 0; i <= n; i++) { var a = i / n * Math.PI * 2, x = Math.cos(a), z = Math.sin(a); pos.push(x, 0, z); uv.push(0.5 + x / 2, 0.5 - z / 2); if (i) ix.push(0, i + 1, i); }
    var g = new T.BG(); g.setAttribute('position', new T.Attr(new Float32Array(pos), 3)); g.setAttribute('uv', new T.Attr(new Float32Array(uv), 2));
    g.setAttribute('normal', new T.Attr(new Float32Array(pos.length).map(function (v, i) { return i % 3 === 1 ? 1 : 0; }), 3)); g.setIndex(ix);
    return g;
  }
  function mat(opts) {
    var m = new T.Std(opts); m.roughness = 1; m.metalness = 0; m.side = 2; m.polygonOffset = true; m.polygonOffsetFactor = -4; m.polygonOffsetUnits = -4; return m;
  }

  function build(scene) {
    if (!ctors(scene)) return false;
    if (!root) { root = new T.Group(); root.name = 'Eixos no chão (V1.56)'; }
    while (root.children.length) { var o = root.children[0]; root.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map && o.material.map.userData.keep !== 1) o.material.map.dispose(); o.material.dispose(); } }
    items = [];
    var P = piers(), dash = dashTex(), shTex = shadowTex();
    var stripMat = mat({ color: 0xffffff, map: dash, emissive: 0xffffff, emissiveMap: dash, emissiveIntensity: 0.6, transparent: true, alphaTest: 0.35, depthWrite: false });
    var shMat = mat({ color: 0x000000, map: shTex, transparent: true, depthWrite: false }); shMat.emissive.setHex(0); 
    SPANS.forEach(function (sp) {
      var r = sp[2], ka = r === '2000' ? '2000' : '1000', a = P[sp[0] + '|' + ka] || P[sp[0] + '|' + (ka === '1000' ? '2000' : '1000')], b = P[sp[1] + '|' + ka] || P[sp[1] + '|' + (ka === '1000' ? '2000' : '1000')];
      if (!a || !b) return;
      var mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, S, n, e;
      if (r === 'both') { S = { x: mx, z: -15.5 }; n = { x: 0, z: 1 }; e = 31; }
      else {
        var dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; n = { x: -dz / l, z: dx / l };      // perpendicular ao vão
        var out = r === '1000' ? 1 : -1; if ((n.z || 0) * out < 0) { n.x = -n.x; n.z = -n.z; }            // para fora: ramo 1000 → +z, ramo 2000 → −z
        S = { x: mx - n.x * 7.5, z: mz - n.z * 7.5 }; e = 15;
      }
      var txt = sp[1].replace(/^AP/, 'AP.');
      var dm = new T.Mesh(disc(), mat({ color: 0xffffff, map: null, emissive: 0xffffff, emissiveIntensity: 0.8, transparent: true, depthWrite: false }));
      var tx = tex(txt); dm.material.map = tx; dm.material.emissiveMap = tx; dm.material.needsUpdate = true; dm.renderOrder = 4;
      var g = new T.BG(); var sm = new T.Mesh(g, stripMat); sm.renderOrder = 3;
      var sh = new T.Mesh(disc(), shMat); sh.renderOrder = 3;
      root.add(sm); root.add(sh); root.add(dm);
      items.push({ S: S, n: n, e: e, strip: sm, disc: dm, shadow: sh, k: 0, label: txt, bx: S.x + n.x * (e + 1.5 + R0), bz: S.z + n.z * (e + 1.5 + R0) });
    });
    // tamanho máximo de cada bolinha: não encostar na vizinha
    items.forEach(function (it) { var nn = 80; items.forEach(function (o) { if (o !== it) nn = Math.min(nn, Math.hypot(o.bx - it.bx, o.bz - it.bz)); }); it.kmax = Math.max(1, Math.min(KMAX, 0.4 * nn / R0)); });
    if (root.parent !== scene) scene.add(root);
    update(true);
    return true;
  }

  function stripGeo(it, len, w) {
    var segs = Math.max(2, Math.ceil(len / 2)), pos = [], uv = [], ix = [], px = -it.n.z, pz = it.n.x, P = 4.2 * Math.max(1, w / 0.5);   // px,pz: lado da faixa
    for (var i = 0; i <= segs; i++) {
      var t = i / segs * len, cx = it.S.x + it.n.x * t, cz = it.S.z + it.n.z * t;
      var x1 = cx + px * w / 2, z1 = cz + pz * w / 2, x2 = cx - px * w / 2, z2 = cz - pz * w / 2;
      pos.push(x1, ground(x1, z1) + 0.16, z1, x2, ground(x2, z2) + 0.16, z2); uv.push(t / P, 1, t / P, 0);
      if (i) { var a = (i - 1) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var g = it.strip.geometry; g.setAttribute('position', new T.Attr(new Float32Array(pos), 3)); g.setAttribute('uv', new T.Attr(new Float32Array(uv), 2));
    g.setAttribute('normal', new T.Attr(new Float32Array(pos.length).map(function (v, i) { return i % 3 === 1 ? 1 : 0; }), 3));
    g.setIndex(ix); g.computeBoundingSphere();
  }
  function update(force) {
    if (!root || !items.length || !window.__v22 || !window.__v22.camera) return;
    var cm = window.__v22.camera, cam = cm.position, ce = cm.matrixWorld.elements, ux = ce[4], uz = ce[6];   // "para cima" da tela projetado no chão
    var sig = ce[0] + ',' + ce[4] + ',' + ce[6] + ',' + ce[12] + ',' + ce[13] + ',' + ce[14];
    if (!force && sig === lastCam) return; lastCam = sig;                                                       // câmera parada: nada a refazer
    if (Math.hypot(ux, uz) < 1e-3) { ux = -ce[8]; uz = -ce[10]; }
    items.forEach(function (it) {
      var bx = it.bx, bz = it.bz; if (it.by == null) it.by = ground(bx, bz);
      var k = Math.round(Math.max(1, Math.min(it.kmax || KMAX, Math.hypot(cam.x - bx, cam.y - it.by, cam.z - bz) / 130)) * 20) / 20;
      if (force || k !== it.k) {
        it.k = k; var R = R0 * k, d = it.e + 1.5 + R, cx = it.S.x + it.n.x * d, cz = it.S.z + it.n.z * d, y = ground(cx, cz);
        for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; y = Math.max(y, ground(cx + Math.cos(a) * R * 0.8, cz + Math.sin(a) * R * 0.8)); }
        it.disc.position.set(cx, y + 0.24, cz); it.disc.scale.set(R, 1, R);
        it.shadow.position.set(cx + R * 0.06, y + 0.18, cz + R * 0.08); it.shadow.scale.set(R * 1.22, 1, R * 1.22);
        stripGeo(it, d - R * 0.9, 0.5 * k);
      }
      // número sempre de frente para quem olha
      var m = it.disc.material.map;
      if (m) { var rot = Math.atan2(-ux, -uz) + ROT0; if (Math.abs(m.rotation - rot) > 0.01) { m.rotation = rot; } }
    });
  }

  // abre uma clareira nas árvores ilustrativas em volta de cada bolinha (senão as copas cobrem o número)
  var cleared = [], treeDone = new WeakSet();
  function zones() {
    var L = R0 * KMAX;
    return items.map(function (it) { return { it: it, a: it.e + 0.5, b: it.e + 1.5 + 2 * L + 1.5, w: L + 1.8 }; });
  }
  function inZone(x, z, Z) {
    for (var i = 0; i < Z.length; i++) { var it = Z[i].it, dx = x - it.S.x, dz = z - it.S.z, along = dx * it.n.x + dz * it.n.z, side = Math.abs(dx * -it.n.z + dz * it.n.x); if (along > Z[i].a && along < Z[i].b && side < Z[i].w) return true; }
    return false;
  }
  function clearTrees(scene) {
    if (!items.length) return;
    var Z = zones(), M = scene.matrix.constructor, m = new M(), zero = new M().makeScale(0, 0, 0);
    scene.traverse(function (o) {
      if (!o.isInstancedMesh || treeDone.has(o) || !/copas|troncos|arbustos/.test(o.name || '')) return;
      treeDone.add(o); o.updateMatrixWorld(true); var w = o.matrixWorld.elements, ch = false;
      for (var i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); var e = m.elements, x = w[0] * e[12] + w[4] * e[13] + w[8] * e[14] + w[12], z = w[2] * e[12] + w[6] * e[13] + w[10] * e[14] + w[14];
        if (inZone(x, z, Z)) { cleared.push({ o: o, i: i, m: m.clone() }); o.setMatrixAt(i, zero); ch = true; }
      }
      if (ch) { o.instanceMatrix.needsUpdate = true; if (o.computeBoundingSphere) o.boundingSphere = null; }
    });
  }
  function restoreTrees() {
    var touched = new Set();
    cleared.forEach(function (c) { c.o.setMatrixAt(c.i, c.m); touched.add(c.o); });
    touched.forEach(function (o) { o.instanceMatrix.needsUpdate = true; });
    cleared = []; treeDone = new WeakSet();
  }

  function addToggle() {
    if (document.getElementById('av-eixos56')) return;
    var after = document.getElementById('av-prelaje') || document.getElementById('av-environment'); if (!after) return;
    var lb = document.createElement('label'); lb.style.cssText = 'flex-direction:row;align-items:center';
    lb.innerHTML = '<input type="checkbox" id="av-eixos56"> Eixos no chão';
    after.closest('label').after(lb);
    var ck = lb.querySelector('input'); ck.checked = show;
    ck.onchange = function () { show = ck.checked; try { localStorage.setItem(KEY, show ? '1' : '0'); } catch (e) {} if (root) root.visible = show; if (!show) restoreTrees(); };
  }

  function tick() {
    var scene = window.__v40 && window.__v40.scene; if (!scene || !window.__v43 || !window.__v39) return;
    addToggle();
    var px = null; scene.traverse(function (o) { if (!px && o.name === 'Peças para seleção') px = o; }); if (!px) return;
    var sig = px.uuid + ':' + px.children.length;
    if (sig !== lastSig) { lastSig = sig; try { build(scene); } catch (e) { console.warn('eixos3d', e); } }
    if (root) { if (root.parent !== scene) scene.add(root); root.visible = show && px.children.length > 60; }   // vista de uma peça só: sem eixos
    if (root && root.visible) clearTrees(scene);
  }
  setInterval(tick, 700);
  setInterval(function () { if (root && root.visible) update(false); }, 120);
  window.__eixos56 = { ground: ground, get hf() { return !!heightfield(); }, setRot0: function (v) { ROT0 = v; update(true); }, get items() { return items.map(function (i) { return { label: i.label, x: i.disc.position.x, z: i.disc.position.z, k: i.k }; }); }, rebuild: function () { lastSig = ''; tick(); } };
})();
