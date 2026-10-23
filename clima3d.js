/* Ponte Joinville — céu do 3D (V1.58)
   Céu fixo de tempo bom: poucas nuvens 3D que derivam devagar sobre a ponte e o sol na direção da luz principal.
   Os botões de sol/chuva e de tempo real (Joinville ao vivo) foram retirados a pedido (V1.58).
   As nuvens são desenhadas como instâncias (2 pedidos de desenho para todas as bolhas, em vez de um por bolha). */
(function () {
  'use strict';
  var N_CLOUDS = 4, T = null, root = null, ready = false, sun = null, last = 0, lights = [];
  var B = { x0: -440, x1: 350, z0: -42, z1: 22, y: 95 };
  var mobile = !!window.__mobile47;

  // some com o botão sol/chuva da V1.52 (o 3D continua no tempo bom)
  var css = document.createElement('style'); css.id = 'clima58-css';
  css.textContent = '.wx52,#wx53,#wx52-fx,#wx52-flash{display:none!important}';
  document.head.appendChild(css);

  function grab(scene) {
    var C = {};
    scene.traverse(function (o) {
      if (o.isInstancedMesh && !C.IM) C.IM = o.constructor;
      if (o.isMesh && !o.isInstancedMesh && !C.Mesh) C.Mesh = o.constructor;
      if (o.isGroup && !C.Group) C.Group = o.constructor;
      if (o.isMesh && o.material && o.material.isMeshStandardMaterial && !C.Std) C.Std = o.material.constructor;
      if (o.geometry && o.geometry.type === 'IcosahedronGeometry' && !C.Ico) C.Ico = o.geometry.constructor;
      if (o.isLight) lights.push(o);
    });
    C.V3 = scene.position.constructor;
    return C.Mesh && C.Group && C.Std && C.IM ? C : null;
  }
  function bounds() {
    try {
      var tr = window.__v40.tr(), xs = [], zs = [], ys = [];
      for (var k in tr) tr[k].forEach(function (q) { if (/^GB/.test(q.id) && q.x0 != null) { xs.push(q.x0, q.x1); zs.push(q.z); ys.push(q.y); } });
      if (xs.length) { B.x0 = Math.min.apply(0, xs) - 10; B.x1 = Math.max.apply(0, xs) + 10; B.z0 = Math.min.apply(0, zs) - 14; B.z1 = Math.max.apply(0, zs) + 14; B.y = Math.max.apply(0, ys) + 85; }
    } catch (e) {}
  }

  // ---------- nuvens: grupos de bolhas que respiram e derivam (instâncias) ----------
  var geoPuff = null, imLight = null, imShade = null, clouds = [], dummy = null;
  function cloudMat(top) {
    var m = new T.Std({ roughness: 1, metalness: 0, transparent: true, opacity: .96 });
    m.color.setHSL(.6, top ? .06 : .08, top ? .97 : .84);
    if (m.emissive) m.emissive.setRGB(top ? .09 : .03, top ? .09 : .03, top ? .1 : .035);
    return m;
  }
  function makeCloud(i, n) {
    var size = .8 + Math.random() * .7, puffs = 8 + Math.floor(Math.random() * 6), P = [];
    for (var k = 0; k < puffs; k++) {
      var low = Math.random() < .45, px = (Math.random() - .5) * 26 * size, pz = (Math.random() - .5) * 14 * size, py = low ? -Math.random() * 2.5 : Math.random() * 4 * size;
      var r = (4.5 + Math.random() * 5.5) * size * (1 - Math.abs(px) / (40 * size));
      P.push({ x: px, y: py, z: pz, r: r, low: low, ph: Math.random() * 6.28, sp: .25 + Math.random() * .35 });
    }
    var span = B.x1 - B.x0;
    return { x: B.x0 + span * ((i + Math.random() * .7) / n), y: B.y + Math.random() * 12 + 4, z: B.z0 + Math.random() * (B.z1 - B.z0), v: 1.6 + Math.random() * 1.6, bob: Math.random() * 6.28, P: P };
  }
  function buildClouds() {
    var n = mobile ? Math.ceil(N_CLOUDS * .75) : N_CLOUDS, nl = 0, ns = 0;
    clouds = []; for (var i = 0; i < n; i++) clouds.push(makeCloud(i, n));
    clouds.forEach(function (c) { c.P.forEach(function (p) { if (p.low) ns++; else nl++; }); });
    imLight = new T.IM(geoPuff, cloudMat(true), Math.max(1, nl)); imShade = new T.IM(geoPuff, cloudMat(false), Math.max(1, ns));
    [imLight, imShade].forEach(function (im) { im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; im.name = 'Nuvens (V1.58)'; root.add(im); });
    place(0);
  }
  function place(s) {
    var il = 0, is = 0;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      for (var k = 0; k < c.P.length; k++) {
        var b = c.P[k], w = Math.sin(s * b.sp + b.ph), r = b.r * (1 + w * .06);
        dummy.position.set(c.x + b.x + Math.sin(s * b.sp * .7 + b.ph) * .9, c.y + b.y + w * .6, c.z + b.z + Math.cos(s * b.sp * .6 + b.ph) * .6);
        dummy.scale.set(r * 1.25, r * (b.low ? .62 : .9), r); dummy.updateMatrix();
        if (b.low) imShade.setMatrixAt(is++, dummy.matrix); else imLight.setMatrixAt(il++, dummy.matrix);
      }
    }
    imLight.count = il; imShade.count = is;
    imLight.instanceMatrix.needsUpdate = true; imShade.instanceMatrix.needsUpdate = true;
  }

  // ---------- sol no céu (direção da luz principal) ----------
  function buildSun() {
    var g = new T.Group();
    var core = new T.Mesh(geoPuff, new T.Std({ color: 0xfff6c8, emissive: 0xffe48a, emissiveIntensity: 2.2, roughness: 1, metalness: 0 }));
    var halo = new T.Mesh(geoPuff, new T.Std({ color: 0xfff1b0, emissive: 0xffd970, emissiveIntensity: 1.2, transparent: true, opacity: .18, roughness: 1, metalness: 0, depthWrite: false }));
    core.material.toneMapped = false; halo.material.toneMapped = false;
    core.scale.setScalar(16); halo.scale.setScalar(34); g.add(halo, core);
    var L = lights.filter(function (l) { return l.isDirectionalLight && !l.name; })[0], d = L ? L.position.clone().normalize() : new T.V3(-.55, .66, .37);
    d.y = Math.max(.32, d.y); d.normalize();
    g.position.set((B.x0 + B.x1) / 2 + d.x * 620, 40 + d.y * 520, (B.z0 + B.z1) / 2 + d.z * 620);
    sun = g; root.add(g);
  }

  function inBridgeView() {
    var g = window.__v48 && window.__v48.group, L = window.__v44 && window.__v44.L;
    if (!g && !L) return true; return !!((g && g.visible) || (L && L.visible));
  }
  function tick(t) {
    requestAnimationFrame(tick);
    if (!ready || document.visibilityState !== 'visible') { last = t; return; }
    var scene = window.__v40 && window.__v40.scene; if (!scene) return;
    if (root.parent !== scene) scene.add(root);
    root.visible = inBridgeView(); if (!root.visible) { last = t; return; }
    var dt = Math.min(.05, (t - (last || t)) / 1000); last = t; var s = t / 1000;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i]; c.x += c.v * dt;
      if (c.x > B.x1 + 20) { c.x = B.x0 - 20; c.z = B.z0 + Math.random() * (B.z1 - B.z0); }
      c.y += Math.sin(s * .35 + c.bob) * .012;
    }
    place(s);
    if (sun) sun.children[0].rotation.y += dt * .05;
  }

  function init(n) {
    var scene = window.__v40 && window.__v40.scene;
    if (!scene) { if (n < 80) setTimeout(function () { init(n + 1); }, 700); return; }
    T = grab(scene); if (!T) { if (n < 80) setTimeout(function () { init(n + 1); }, 700); return; }
    try { var w = window.__v52weather; if (w) { if (w.sunny === false) w.set(true); w.noBolt(); } } catch (e) {}
    geoPuff = T.Ico ? new T.Ico(1, 2) : null; if (!geoPuff) return;
    dummy = new T.Group();
    bounds();
    root = new T.Group(); root.name = 'Céu 3D (V1.58)'; scene.add(root);
    buildClouds(); buildSun();
    ready = true; requestAnimationFrame(tick);
  }
  window.__clima53 = { get state() { return { clouds: clouds.length, puffs: imLight ? imLight.count + imShade.count : 0 }; } };
  setTimeout(function () { init(0); }, 1500);
})();
