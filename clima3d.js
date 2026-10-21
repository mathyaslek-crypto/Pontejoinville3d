/* Ponte Joinville — Clima 3D (V1.53)
   Nuvens 3D que se movem só sobre a ponte, chuva e raios saindo das nuvens e sol no céu, ligados ao tempo real de Joinville
   (Open-Meteo, via /api/clima do próprio site). Carregado pelo Worker no 3d.html; usa as classes do three.js que já estão na cena.
   O botão sol/chuva da V1.52 continua: ao tocar nele o clima passa para manual; o selo "Ao vivo" volta ao tempo real. */
(function () {
  'use strict';
  var MODES = {
    sol:        { n: 4,  dark: 0,   rain: 0,    bolts: false, sun: true,  sunny: true,  label: 'Sol' },
    parcial:    { n: 9,  dark: .08, rain: 0,    bolts: false, sun: true,  sunny: true,  label: 'Nublado com sol' },
    nublado:    { n: 15, dark: .3,  rain: 0,    bolts: false, sun: false, sunny: true,  dim: .62, label: 'Nublado' },
    chuva:      { n: 16, dark: .55, rain: 1,    bolts: false, sun: false, sunny: false, label: 'Chuva' },
    tempestade: { n: 18, dark: .75, rain: 1.5,  bolts: true,  sun: false, sunny: false, label: 'Chuva com raios' }
  };
  var LIVE_KEY = 'ponte-clima-live-v53';
  var live = true; try { live = localStorage.getItem(LIVE_KEY) !== '0'; } catch (e) {}
  var mode = 'sol', wx = null, T = null, root = null, ready = false;
  var clouds = [], rain = null, bolt = null, sun = null, lights = [], flashT = 0, nextBolt = 0, last = 0;
  var B = { x0: -440, x1: 350, z0: -42, z1: 22, y: 44 };   // faixa da ponte (ajustada pelos dados do 3D)
  var mobile = !!window.__mobile47;

  // ---------- classes do three.js tiradas da própria cena ----------
  function grab(scene) {
    var C = {};
    scene.traverse(function (o) {
      if (o.isMesh && !o.isInstancedMesh && !C.Mesh) C.Mesh = o.constructor;
      if (o.isGroup && !C.Group) C.Group = o.constructor;
      if (o.isLineSegments && !C.LS) { C.LS = o.constructor; C.LM = o.material.constructor; }
      if (o.isMesh && o.material && o.material.isMeshStandardMaterial && !C.Std) C.Std = o.material.constructor;
      if (o.geometry && o.geometry.type === 'IcosahedronGeometry' && !C.Ico) C.Ico = o.geometry.constructor;
      if (o.geometry && o.geometry.attributes && o.geometry.attributes.position && !C.Attr) C.Attr = o.geometry.attributes.position.constructor;
      if (o.geometry && !C.BG) {
        var p = Object.getPrototypeOf(o.geometry);
        while (p && !C.BG) { if (Object.prototype.hasOwnProperty.call(p, 'constructor')) { try { var t = new p.constructor(); if (t.type === 'BufferGeometry') C.BG = p.constructor; } catch (e) {} } p = Object.getPrototypeOf(p); }
      }
      if (o.isLight) lights.push(o);
    });
    C.V3 = scene.position.constructor;
    return C.Mesh && C.Group && C.LS && C.Std && C.BG && C.Attr ? C : null;
  }
  function bounds() {
    try {
      var tr = window.__v40.tr(), xs = [], zs = [], ys = [];
      for (var k in tr) tr[k].forEach(function (q) { if (/^GB/.test(q.id) && q.x0 != null) { xs.push(q.x0, q.x1); zs.push(q.z); ys.push(q.y); } });
      if (xs.length) { B.x0 = Math.min.apply(0, xs) - 10; B.x1 = Math.max.apply(0, xs) + 10; B.z0 = Math.min.apply(0, zs) - 14; B.z1 = Math.max.apply(0, zs) + 14; B.y = Math.max.apply(0, ys) + 36; }
    } catch (e) {}
  }

  // ---------- nuvens: grupos de "bolhas" 3D que respiram e derivam ----------
  var geoPuff = null, matLight = null, matShade = null;
  function cloudMats(dark) {
    var top = new T.Color().setHSL(.6, .06, .97 - dark * .78), bot = new T.Color().setHSL(.6, .08, .84 - dark * .82);
    if (!matLight) { matLight = new T.Std({ roughness: 1, metalness: 0, transparent: true, opacity: .96 }); matShade = new T.Std({ roughness: 1, metalness: 0, transparent: true, opacity: .96 }); }
    matLight.color.copy(top); matShade.color.copy(bot);
    matLight.emissive && matLight.emissive.setRGB(Math.max(0, .09 - dark * .12), Math.max(0, .09 - dark * .12), Math.max(0, .1 - dark * .12));
    matShade.emissive && matShade.emissive.setRGB(dark > .4 ? 0 : .03, dark > .4 ? 0 : .03, dark > .4 ? 0 : .035);
  }
  function makeCloud(i, n, m) {
    var g = new T.Group(), size = (m.dark > .4 ? 1.25 : 1) * (.8 + Math.random() * .7), puffs = 8 + Math.floor(Math.random() * 6);
    for (var k = 0; k < puffs; k++) {
      var low = Math.random() < .45, mesh = new T.Mesh(geoPuff, low ? matShade : matLight);
      var px = (Math.random() - .5) * 26 * size, pz = (Math.random() - .5) * 14 * size, py = low ? -Math.random() * 2.5 : Math.random() * 4 * size;
      var r = (4.5 + Math.random() * 5.5) * size * (1 - Math.abs(px) / (40 * size));
      mesh.position.set(px, py, pz); mesh.scale.set(r * 1.25, r * (low ? .62 : .9), r);
      mesh.userData.b = { x: px, y: py, z: pz, r: r, low: low, ph: Math.random() * 6.28, sp: .25 + Math.random() * .35 };
      mesh.castShadow = false; mesh.receiveShadow = false;
      g.add(mesh);
    }
    var span = B.x1 - B.x0;
    g.position.set(B.x0 + span * ((i + Math.random() * .7) / n), B.y + Math.random() * 12 + (m.dark > .4 ? -3 : 4), B.z0 + Math.random() * (B.z1 - B.z0));
    g.userData = { v: (1.6 + Math.random() * 1.6) * (m.rain ? 1.8 : 1), size: size, bob: Math.random() * 6.28 };
    return g;
  }
  function buildClouds(m) {
    clouds.forEach(function (c) { root.remove(c); }); clouds = [];
    cloudMats(m.dark);
    var n = mobile ? Math.ceil(m.n * .7) : m.n;
    for (var i = 0; i < n; i++) { var c = makeCloud(i, n, m); clouds.push(c); root.add(c); }
  }

  // ---------- chuva: linhas que nascem na base das nuvens e caem até o chão ----------
  function buildRain(m) {
    if (rain) { root.remove(rain.obj); rain = null; }
    if (!m.rain) return;
    var n = Math.round((mobile ? 1400 : 3600) * m.rain), pos = new Float32Array(n * 6), g = new T.BG();
    g.setAttribute('position', new T.Attr(pos, 3));
    var mat = new T.LM({ color: 0xdde9f5, transparent: true, opacity: .7 });
    var obj = new T.LS(g, mat); obj.frustumCulled = false; obj.renderOrder = 2;
    var d = []; for (var i = 0; i < n; i++) d.push(spawnDrop({}, true));
    rain = { obj: obj, pos: pos, d: d, n: n }; root.add(obj);
  }
  function spawnDrop(o, anyY) {
    var c = clouds[Math.floor(Math.random() * clouds.length)];
    if (!c) { o.x = 0; o.y = -99; o.z = 0; o.v = 30; return o; }
    var s = c.userData.size;
    o.x = c.position.x + (Math.random() - .5) * 30 * s; o.z = c.position.z + (Math.random() - .5) * 14 * s;
    o.top = c.position.y - 2; o.y = anyY ? -6 + Math.random() * (o.top + 6) : o.top; o.v = 34 + Math.random() * 14; o.l = 2.6 + Math.random() * 1.8;
    return o;
  }
  function stepRain(dt) {
    if (!rain) return;
    var p = rain.pos, wind = (wx && wx.wind ? Math.min(14, wx.wind) : 5) * .25;
    for (var i = 0; i < rain.n; i++) {
      var o = rain.d[i]; o.y -= o.v * dt; o.x += wind * dt;
      if (o.y < -6.5) spawnDrop(o, false);
      var j = i * 6; p[j] = o.x; p[j + 1] = o.y; p[j + 2] = o.z; p[j + 3] = o.x - wind * .04; p[j + 4] = o.y + o.l; p[j + 5] = o.z;
    }
    rain.obj.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- raios: descarga ramificada saindo de dentro de uma nuvem ----------
  function strike() {
    var c = clouds[Math.floor(Math.random() * clouds.length)]; if (!c) return;
    var segs = [], x = c.position.x + (Math.random() - .5) * 10, z = c.position.z + (Math.random() - .5) * 6, y = c.position.y - 1, ground = -6;
    function branch(x, y, z, len, depth) {
      var steps = Math.max(3, Math.round(len / 4));
      for (var s = 0; s < steps && y > ground; s++) {
        var nx = x + (Math.random() - .5) * 5, ny = y - (2.5 + Math.random() * 4), nz = z + (Math.random() - .5) * 3;
        segs.push(x, y, z, nx, ny, nz);
        if (depth < 2 && Math.random() < .18) branch(nx, ny, nz, len * .35, depth + 1);
        x = nx; y = ny; z = nz;
      }
    }
    branch(x, y, z, y - ground, 0);
    var g = new T.BG(); g.setAttribute('position', new T.Attr(new Float32Array(segs), 3));
    var mat = new T.LM({ color: 0xf4f7ff, transparent: true, opacity: 1 }); mat.toneMapped = false;
    if (bolt) root.remove(bolt.obj);
    bolt = { obj: new T.LS(g, mat), t: 0, cloud: c }; bolt.obj.frustumCulled = false; root.add(bolt.obj);
    flashT = .45;
  }
  var lightBase = null;
  function stepBolt(dt) {
    if (bolt) {
      bolt.t += dt; var a = bolt.t < .07 ? 1 : bolt.t < .14 ? .25 : bolt.t < .22 ? .95 : Math.max(0, 1 - (bolt.t - .22) / .28);
      bolt.obj.material.opacity = a;
      if (bolt.t > .55) { root.remove(bolt.obj); bolt = null; }
    }
    if (flashT > 0) {
      if (!lightBase) lightBase = lights.map(function (l) { return l.intensity; });
      var k = flashT > .3 ? 2.6 : 1 + flashT * 3;
      lights.forEach(function (l, i) { if (l.isHemisphereLight) l.intensity = lightBase[i] * k; });
      flashT = Math.max(0, flashT - dt);
      if (!flashT) { lights.forEach(function (l, i) { if (l.isHemisphereLight) l.intensity = lightBase[i]; }); lightBase = null; }
    }
  }

  // ---------- sol no céu (direção da luz principal) ----------
  function buildSun() {
    if (sun) return;
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

  // ---------- aplicar modo ----------
  var dimmed = null;
  function apply(m) {
    var M = MODES[m] || MODES.sol; mode = m;
    try { var w = window.__v52weather; if (w) { if (w.sunny !== M.sunny) w.set(M.sunny); w.noBolt(); } } catch (e) {}
    hide2D();
    // nublado sem chuva: reduz a luz do sol
    if (dimmed) { dimmed.forEach(function (x) { x[0].intensity = x[1]; }); dimmed = null; }
    if (M.dim) { dimmed = lights.filter(function (l) { return l.isDirectionalLight; }).map(function (l) { var v = [l, l.intensity]; l.intensity *= M.dim; return v; }); }
    buildClouds(M); buildRain(M);
    if (bolt) { root.remove(bolt.obj); bolt = null; }
    nextBolt = performance.now() + 2500;
    buildSun(); sun.visible = M.sun && (!wx || wx.isDay !== 0);
    chip();
  }
  function hide2D() { ['wx52-fx', 'wx52-flash'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = 'none'; }); }

  // ---------- animação ----------
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
    var dt = Math.min(.05, (t - (last || t)) / 1000); last = t; var s = t / 1000, span = B.x1 - B.x0;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i], u = c.userData; c.position.x += u.v * dt;
      if (c.position.x > B.x1 + 20) { c.position.x = B.x0 - 20; c.position.z = B.z0 + Math.random() * (B.z1 - B.z0); }
      c.position.y += Math.sin(s * .35 + u.bob) * .012;
      var kids = c.children;
      for (var k = 0; k < kids.length; k++) {
        var b = kids[k].userData.b, w = Math.sin(s * b.sp + b.ph);
        kids[k].position.set(b.x + Math.sin(s * b.sp * .7 + b.ph) * .9, b.y + w * .6, b.z + Math.cos(s * b.sp * .6 + b.ph) * .6);
        var r = b.r * (1 + w * .06); kids[k].scale.set(r * 1.25, r * (b.low ? .62 : .9), r);
      }
    }
    stepRain(dt);
    if (MODES[mode].bolts && t > nextBolt) { strike(); nextBolt = t + 3500 + Math.random() * 7000; }
    stepBolt(dt);
    if (sun && sun.visible) sun.children[0].rotation.y += dt * .05;
    void span;
  }

  // ---------- tempo real de Joinville ----------
  function fromCode(c, p, cover) {
    if (c >= 95) return 'tempestade';
    if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || p > 0.1) return 'chuva';
    if (c === 3 || c === 45 || c === 48 || (c >= 71 && c <= 77) || cover >= 88) return 'nublado';
    if (c === 2 || (c === 1 && cover >= 35)) return 'parcial';
    return 'sol';
  }
  function load() {
    fetch('/api/clima', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.current) return; var c = j.current;
      wx = { code: c.weather_code, temp: c.temperature_2m, cover: c.cloud_cover, prec: (c.precipitation || 0), wind: c.wind_speed_10m, isDay: c.is_day, time: c.time };
      wx.mode = fromCode(+c.weather_code, +(c.precipitation || 0), +(c.cloud_cover || 0));
      if (live && ready && wx.mode !== mode) apply(wx.mode); else chip();
    }).catch(function () {});
  }

  // ---------- selo "Ao vivo" ao lado do botão de clima ----------
  var chipEl = null;
  function chip() {
    if (!chipEl) {
      var css = document.createElement('style');
      css.textContent = '#wx53{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;margin:0 4px;border-radius:999px;border:1px solid #ffffff2e;background:#11151bcc;color:#eef1f5;font:600 11.5px/1 var(--f34,system-ui);cursor:pointer;white-space:nowrap;align-self:center;backdrop-filter:blur(6px)}#wx53 i{width:7px;height:7px;border-radius:50%;background:#6b7280}#wx53.on i{background:#3fb37f;box-shadow:0 0 0 3px #3fb37f33}#wx53:hover{border-color:#FDB900}@media(max-width:760px){#wx53 .t{display:none}}';
      document.head.append(css);
      chipEl = document.createElement('button'); chipEl.type = 'button'; chipEl.id = 'wx53';
      chipEl.onclick = function () { live = true; try { localStorage.setItem(LIVE_KEY, '1'); } catch (e) {} if (wx) apply(wx.mode); load(); chip(); };
    }
    var lab = document.querySelector('.wx52');
    if (lab && chipEl.parentElement !== lab.parentElement) lab.after(chipEl);
    chipEl.classList.toggle('on', live);
    var ic = { sol: '☀', parcial: '⛅', nublado: '☁', chuva: '🌧', tempestade: '⛈' }[live && wx ? wx.mode : mode] || '';
    var txt = live ? (wx ? 'Ao vivo ' + Math.round(wx.temp) + '° ' + ic : 'Ao vivo…') : 'Manual ' + ic;
    chipEl.innerHTML = '<i></i><span class="t">' + txt + '</span>';
    chipEl.title = (wx ? 'Joinville agora: ' + MODES[wx.mode].label + ', ' + Math.round(wx.temp) + '°C, nuvens ' + wx.cover + '%, chuva ' + wx.prec + ' mm, vento ' + Math.round(wx.wind) + ' km/h (Open-Meteo)' : 'Tempo de Joinville (Open-Meteo)') + (live ? '' : ' · toque para voltar ao tempo real');
  }

  // ---------- início ----------
  function init(n) {
    var scene = window.__v40 && window.__v40.scene;
    if (!scene || !window.__v52weather || !document.querySelector('.wx52')) { if (n < 60) setTimeout(function () { init(n + 1); }, 700); return; }
    T = grab(scene); if (!T) { console.warn('clima 3D: classes do three.js não encontradas'); return; }
    T.Color = new T.Std().color.constructor;
    if (T.Ico) geoPuff = new T.Ico(1, 2); else { geoPuff = new T.BG(); }
    bounds();
    root = new T.Group(); root.name = 'Clima 3D (V1.53)'; scene.add(root);
    // botão sol/chuva da V1.52 passa a ser o controle manual
    var inp = document.querySelector('.wx52 input');
    if (inp) inp.addEventListener('change', function () { live = false; try { localStorage.setItem(LIVE_KEY, '0'); } catch (e) {} setTimeout(function () { apply(inp.checked ? 'sol' : 'chuva'); }, 0); });
    ready = true;
    var w = window.__v52weather;
    apply(live && wx ? wx.mode : (w && w.sunny === false ? 'chuva' : 'sol'));
    load(); setInterval(load, 10 * 60 * 1000);
    requestAnimationFrame(tick);
  }
  window.__clima53 = { apply: function (m) { live = false; apply(m); }, live: function () { live = true; load(); }, get state() { return { mode: mode, live: live, wx: wx, clouds: clouds.length, rain: rain && rain.n }; } };
  load();
  setTimeout(function () { init(0); }, 1500);
})();
