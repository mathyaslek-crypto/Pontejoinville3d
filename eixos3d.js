/* Ponte Joinville — eixos no chão do 3D (V1.56)
   Para achar os apoios de longe sem mexer nas placas das peças: em cada vão, uma faixa azul no chão
   atravessando a ponte e, na ponta (do lado de fora), uma bolinha com o número do apoio (AP.xx).
   Como no exemplo (faixa entre o 12 e o 11 com AP.11): o número é o do apoio do vão no sentido do encontro
   para o meio da ponte. Adhemar: 16-15 → AP.15 … 11-10 → AP.10. Boa Vista: 01-02 → AP.02 … 08-09 → AP.09;
   no ramo 2000, 01A-02A → AP.02A … 05A-05 → AP.05. O vão central (09-10) fica sem faixa.
   De longe a bolinha cresce (até não encostar na vizinha) e o número fica sempre de frente para quem olha.
   Liga/desliga em "Eixos no chão", no painel do 3D (fica salvo no aparelho). */
(function () {
  'use strict';
  var KEY = 'ponte-eixos-v56', BLUE = '#2f45e0', R0 = 3.6, KMAX = 4.6, WATER = -6.65, ROT0 = 0;
  var show = true; try { show = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  var T = null, root = null, items = [], lastSig = '', timer = null;

  // vãos: [apoio de onde vem, apoio para onde vai (número na bolinha), ramo] — ramo 'both' atravessa os dois ramos
  var SPANS = [
    ['AP16', 'AP15', 'both'], ['AP15', 'AP14', 'both'], ['AP14', 'AP13', 'both'], ['AP13', 'AP12', 'both'], ['AP12', 'AP11', 'both'], ['AP11', 'AP10', 'both'],
    ['AP08', 'AP09', 'both'], ['AP07', 'AP08', 'both'], ['AP06', 'AP07', 'both'], ['AP05', 'AP06', 'both'],
    ['AP04', 'AP05', '1000'], ['AP03', 'AP04', '1000'], ['AP02', 'AP03', '1000'], ['AP01', 'AP02', '1000'],
    ['AP05A', 'AP05', '2000'], ['AP04A', 'AP05A', '2000'], ['AP03A', 'AP04A', '2000'], ['AP02A', 'AP03A', '2000'], ['AP01A', 'AP02A', '2000']
  ];

  function ground(x, z) { var g = null; try { g = window.__v50geo.ground(x, z); } catch (e) {} return Math.max(isFinite(g) ? g : WATER, WATER); }
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

  function tex(text) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 512;
    var c = cv.getContext('2d');
    c.beginPath(); c.arc(256, 256, 236, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.94)'; c.fill();
    c.lineWidth = 34; c.strokeStyle = BLUE; c.stroke();
    c.fillStyle = '#0d1530'; c.textAlign = 'center'; c.textBaseline = 'middle';
    var fs = 178; c.font = 'bold ' + fs + 'px Arial, Helvetica, sans-serif'; while (c.measureText(text).width > 372 && fs > 60) { fs -= 6; c.font = 'bold ' + fs + 'px Arial, Helvetica, sans-serif'; }
    c.lineJoin = 'round'; c.lineWidth = Math.round(fs * 0.07); c.strokeStyle = '#0d1530'; c.strokeText(text, 256, 262); c.fillText(text, 256, 262);   // traço para engrossar a letra (lê melhor de longe)
    var t = new T.Tex(cv); t.colorSpace = 'srgb'; t.anisotropy = window.__mobile47 ? 1 : 8; t.center.set(0.5, 0.5);
    return t;
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
    while (root.children.length) { var o = root.children[0]; root.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }
    items = [];
    var P = piers(), stripMat = mat({ color: BLUE, emissive: BLUE, emissiveIntensity: 0.55 });
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
      root.add(sm); root.add(dm);
      items.push({ S: S, n: n, e: e, strip: sm, disc: dm, k: 0, label: txt, bx: S.x + n.x * (e + R0), bz: S.z + n.z * (e + R0) });
    });
    // tamanho máximo de cada bolinha: não encostar na vizinha
    items.forEach(function (it) { var nn = 80; items.forEach(function (o) { if (o !== it) nn = Math.min(nn, Math.hypot(o.bx - it.bx, o.bz - it.bz)); }); it.kmax = Math.max(1, Math.min(KMAX, 0.46 * nn / R0)); });
    if (root.parent !== scene) scene.add(root);
    update(true);
    return true;
  }

  function stripGeo(it, len, w) {
    var segs = Math.max(2, Math.ceil(len / 2)), pos = [], ix = [], px = -it.n.z, pz = it.n.x;   // px,pz: lado da faixa
    for (var i = 0; i <= segs; i++) {
      var t = i / segs * len, cx = it.S.x + it.n.x * t, cz = it.S.z + it.n.z * t;
      var x1 = cx + px * w / 2, z1 = cz + pz * w / 2, x2 = cx - px * w / 2, z2 = cz - pz * w / 2;
      pos.push(x1, ground(x1, z1) + 0.16, z1, x2, ground(x2, z2) + 0.16, z2);
      if (i) { var a = (i - 1) * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    var g = it.strip.geometry; g.setAttribute('position', new T.Attr(new Float32Array(pos), 3));
    g.setAttribute('normal', new T.Attr(new Float32Array(pos.length).map(function (v, i) { return i % 3 === 1 ? 1 : 0; }), 3));
    g.setIndex(ix); g.computeBoundingSphere();
  }
  function update(force) {
    if (!root || !items.length || !window.__v22 || !window.__v22.camera) return;
    var cm = window.__v22.camera, cam = cm.position, ce = cm.matrixWorld.elements, ux = ce[4], uz = ce[6];   // "para cima" da tela projetado no chão
    if (Math.hypot(ux, uz) < 1e-3) { ux = -ce[8]; uz = -ce[10]; }
    items.forEach(function (it) {
      var bx = it.S.x + it.n.x * (it.e + R0), bz = it.S.z + it.n.z * (it.e + R0);
      var k = Math.round(Math.max(1, Math.min(it.kmax || KMAX, Math.hypot(cam.x - bx, cam.y - ground(bx, bz), cam.z - bz) / 90)) * 20) / 20;
      if (force || k !== it.k) {
        it.k = k; var R = R0 * k, d = it.e + R0 + (R - R0) * 0.5, cx = it.S.x + it.n.x * d, cz = it.S.z + it.n.z * d, y = ground(cx, cz);
        for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; y = Math.max(y, ground(cx + Math.cos(a) * R * 0.8, cz + Math.sin(a) * R * 0.8)); }
        it.disc.position.set(cx, y + 0.22, cz); it.disc.scale.set(R, 1, R);
        stripGeo(it, d, 1.3 * Math.min(k, 2.2));
      }
      // número sempre de frente para quem olha
      var m = it.disc.material.map;
      if (m) { var rot = Math.atan2(-ux, -uz) + ROT0; if (Math.abs(m.rotation - rot) > 0.01) { m.rotation = rot; } }
    });
  }

  function addToggle() {
    if (document.getElementById('av-eixos56')) return;
    var after = document.getElementById('av-prelaje') || document.getElementById('av-environment'); if (!after) return;
    var lb = document.createElement('label'); lb.style.cssText = 'flex-direction:row;align-items:center';
    lb.innerHTML = '<input type="checkbox" id="av-eixos56"> Eixos no chão';
    after.closest('label').after(lb);
    var ck = lb.querySelector('input'); ck.checked = show;
    ck.onchange = function () { show = ck.checked; try { localStorage.setItem(KEY, show ? '1' : '0'); } catch (e) {} if (root) root.visible = show; };
  }

  function tick() {
    var scene = window.__v40 && window.__v40.scene; if (!scene || !window.__v43 || !window.__v39) return;
    addToggle();
    var px = null; scene.traverse(function (o) { if (!px && o.name === 'Peças para seleção') px = o; }); if (!px) return;
    var sig = px.uuid + ':' + px.children.length;
    if (sig !== lastSig) { lastSig = sig; try { build(scene); } catch (e) { console.warn('eixos3d', e); } }
    if (root) { if (root.parent !== scene) scene.add(root); root.visible = show && px.children.length > 60; }   // vista de uma peça só: sem eixos
  }
  setInterval(tick, 700);
  setInterval(function () { if (root && root.visible) update(false); }, 120);
  window.__eixos56 = { setRot0: function (v) { ROT0 = v; update(true); }, get items() { return items.map(function (i) { return { label: i.label, x: i.disc.position.x, z: i.disc.position.z, k: i.k }; }); }, rebuild: function () { lastSig = ''; tick(); } };
})();
