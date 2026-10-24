/* Ponte Joinville — Cantitravel no 3D (V1.62)
   Dois cantitravels, com a frente virada para o Rio Cachoeira no centro da obra:
     Adhemar Garcia: começa no meio entre os blocos 15 e 14 e vai até o bloco 10 (hoje está no bloco 10)
     Boa Vista:      começa no meio entre os blocos 1 e 2 e vai até o bloco 9    (hoje está entre o apoio 8 e o 7)
   Cada um é uma plataforma com o piso na cota 8,70 (topo das travessas) do início ao fim, andando sobre duas vigas trilho
   apoiadas em estacas provisórias Ø800, com o guindaste BSM de 170 t no centro. Fica no eixo da ponte: o centro passa
   entre os blocos .2 e .3. As estacas provisórias são colocadas sem bater nos blocos da ponte.
   Avançar: aparece a próxima fila de estacas com o trecho de viga trilho e a plataforma anda até ela.
   Recuar: a plataforma volta e a fila da frente some junto com o trecho de viga trilho (camisas sacadas e trilho desmontado).
   Onde o cantitravel passa ele vale mais que o desenho da ponte: as peças que ficam dentro dele somem enquanto ele está ligado.
   Painel "Cantitravel · ajustes" logo abaixo do 3D: liga/desliga cada um, avança/recua, vai até um apoio, guindaste e as
   medidas (provisórias, para ajustar na tela). Tudo fica salvo na nuvem e aparece igual em todos os computadores;
   no dashboard publicado fica travado na posição do momento da publicação. */
(function () {
  'use strict';
  var PUB = window.__pub58 || null, KEY = 'ponte-cantitravel-v62', API = '/api/state', GROUND = -6.5;

  // ======================= geometria (triângulos com cor por vértice) =======================
  var add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
  var sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
  var mul = function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; };
  var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
  var cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
  var len = function (a) { return Math.hypot(a[0], a[1], a[2]); };
  var norm = function (a) { var l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  function lin(hex) { var f = function (c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return [f(hex >> 16 & 255), f(hex >> 8 & 255), f(hex & 255)]; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var COL = {
    deck: 0x8a4f2f, frame: 0x9b4f26, frame2: 0xa85a2c, truss: 0xb4602d, rail: 0x7d4428, railDark: 0x5e3420,
    yellow: 0xd9a21b, steel: 0x6f7378, stop: 0xe0b31e, cap: 0x6e3d24, capDark: 0x4f2b19, pile: 0x7a4026,
    pileHead: 0x4a2a1a, guard: 0xd9782e, grate: 0x8f6a4c, bogie: 0x3f4448, wheel: 0x24282b,
    crane: 0xf2b705, craneDk: 0xd29b00, dark: 0x2e3236, track: 0x33363a, trackDk: 0x232527, roller: 0x1d1f21,
    glass: 0x1d2a33, cw: 0x868b91, cwDk: 0x5d6166, red: 0xc8202a, white: 0xeeeeee, hook: 0xe2a400
  };
  var C = {}; Object.keys(COL).forEach(function (k) { C[k] = lin(COL[k]); });

  function Geo(seed) { this.p = []; this.c = []; this.r = rng(seed || 7); }
  Geo.prototype.jit = function (col, a) { var k = 1 + (this.r() * 2 - 1) * a; return [col[0] * k, col[1] * k, col[2] * k]; };
  Geo.prototype.tri = function (a, b, c, col) { this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); for (var i = 0; i < 3; i++) this.c.push(col[0], col[1], col[2]); };
  Geo.prototype.quad = function (a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); };
  Geo.prototype.quadN = function (a, b, c, d, n, col) { if (dot(cross(sub(b, a), sub(c, a)), n) < 0) this.quad(a, d, c, b, col); else this.quad(a, b, c, d, col); };
  Geo.prototype.boxAx = function (o, ex, ey, ez, col) {
    var v = function (i, j, k) { return [o[0] + (i - .5) * ex[0] + (j - .5) * ey[0] + (k - .5) * ez[0], o[1] + (i - .5) * ex[1] + (j - .5) * ey[1] + (k - .5) * ez[1], o[2] + (i - .5) * ex[2] + (j - .5) * ey[2] + (k - .5) * ez[2]]; };
    var self = this, q = function (a, b, c, d) { self.quad(v.apply(null, a), v.apply(null, b), v.apply(null, c), v.apply(null, d), col); };
    q([1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]); q([0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]); q([0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]);
    q([0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]); q([0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]); q([0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]);
  };
  Geo.prototype.box = function (x0, y0, z0, x1, y1, z1, col) { this.boxAx([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, 0, 0], [0, y1 - y0, 0], [0, 0, z1 - z0], col); };
  Geo.prototype.frame = function (p1, p2, up) {
    var d0 = sub(p2, p1), L = len(d0), d = mul(d0, 1 / L), u = up || [0, 1, 0];
    if (Math.abs(dot(d, norm(u))) > 0.98) u = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var s = norm(cross(d, u)); return { d: d, s: s, u: cross(s, d), L: L };
  };
  Geo.prototype.beam = function (p1, p2, w, h, col, up) { var f = this.frame(p1, p2, up); this.boxAx(mul(add(p1, p2), .5), mul(f.d, f.L), mul(f.u, h), mul(f.s, w), col); };
  Geo.prototype.tube = function (p1, p2, r, col, seg, caps) {
    seg = seg || 8; var f = this.frame(p1, p2), R = [], k;
    for (k = 0; k <= seg; k++) { var t = k / seg * Math.PI * 2; R.push(add(mul(f.s, Math.cos(t) * r), mul(f.u, Math.sin(t) * r))); }
    for (k = 0; k < seg; k++) this.quad(add(p1, R[k]), add(p2, R[k]), add(p2, R[k + 1]), add(p1, R[k + 1]), col);
    if (caps) for (k = 0; k < seg; k++) { this.tri(p2, add(p2, R[k + 1]), add(p2, R[k]), col); this.tri(p1, add(p1, R[k]), add(p1, R[k + 1]), col); }
  };
  Geo.prototype.prism = function (o, ea, eb, ec, pts, c0, c1, col) {
    var P = function (q, w) { return [o[0] + ea[0] * q[0] + eb[0] * q[1] + ec[0] * w, o[1] + ea[1] * q[0] + eb[1] * q[1] + ec[1] * w, o[2] + ea[2] * q[0] + eb[2] * q[1] + ec[2] * w]; };
    var n = pts.length, i;
    for (i = 1; i < n - 1; i++) { this.tri(P(pts[0], c1), P(pts[i], c1), P(pts[i + 1], c1), col); this.tri(P(pts[0], c0), P(pts[i + 1], c0), P(pts[i], c0), col); }
    for (i = 0; i < n; i++) { var a = pts[i], b = pts[(i + 1) % n]; this.quad(P(a, c0), P(b, c0), P(b, c1), P(a, c1), col); }
  };
  Geo.prototype.guard = function (A, B, col) {
    var L = len(sub(B, A)); if (L < 0.2) return;
    var n = Math.max(1, Math.ceil(L / 1.9)), up = function (p, h) { return [p[0], p[1] + h, p[2]]; };
    for (var i = 0; i <= n; i++) { var p = add(A, mul(sub(B, A), i / n)); this.beam(p, up(p, 1.1), 0.06, 0.06, col, [1, 0, 0]); }
    this.tube(up(A, 1.1), up(B, 1.1), 0.03, col, 6); this.tube(up(A, 0.55), up(B, 0.55), 0.022, col, 6);
    var f = this.frame(A, B); this.boxAx(add(mul(add(A, B), .5), [0, 0.08, 0]), mul(f.d, L), [0, 0.16, 0], mul(f.s, 0.02), col);
  };
  Geo.prototype.arrays = function () {
    var p = new Float32Array(this.p), n = new Float32Array(p.length);
    for (var i = 0; i < p.length; i += 9) {
      var ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      for (var k = 0; k < 9; k += 3) { n[i + k] = nx / l; n[i + k + 1] = ny / l; n[i + k + 2] = nz / l; }
    }
    return { p: p, n: n, c: new Float32Array(this.c) };
  };

  // níveis (y medido do terreno, que no modelo fica em -6,50)
  function levels(M) {
    var H = M.cota - GROUND, railTop = H - 2.5, rbTop = railTop - 0.17, rbBot = rbTop - 1.2, capBot = rbBot - 0.8;
    return { H: H, frameBot: H - 1.8, gal: H - 2.3, railTop: railTop, rbTop: rbTop, rbBot: rbBot, capBot: capBot, pileBot: -6 };
  }
  // via: só as filas já cravadas (0..k), vigas trilho de ponta a ponta delas; sem contraventamento
  function buildVia(M, L, rows, k) {
    var g = new Geo(11), G2 = M.G / 2, x, s, i;
    if (k < 0 || !rows.length) return g;
    var used = rows.slice(0, k + 1), xr0 = used[0] - 0.75, xr1 = used[used.length - 1] + 0.75;
    for (s = -1; s <= 1; s += 2) {
      var z0 = s * G2;
      [-0.3, 0.3].forEach(function (dz) {
        var zc = z0 + dz;
        g.box(xr0, L.rbTop - 0.035, zc - 0.175, xr1, L.rbTop, zc + 0.175, C.rail);
        g.box(xr0, L.rbBot + 0.035, zc - 0.012, xr1, L.rbTop - 0.035, zc + 0.012, C.rail);
        g.box(xr0, L.rbBot, zc - 0.175, xr1, L.rbBot + 0.035, zc + 0.175, C.rail);
      });
      g.box(xr0, L.rbTop, z0 - 0.48, xr1, L.rbTop + 0.03, z0 + 0.48, C.yellow);
      g.box(xr0, L.rbTop + 0.03, z0 - 0.06, xr1, L.railTop, z0 + 0.06, C.steel);
      for (x = xr0 + 1.5; x < xr1; x += 3) g.box(x - 0.012, L.rbBot + 0.05, z0 - 0.29, x + 0.012, L.rbTop - 0.05, z0 + 0.29, C.railDark);
      g.box(xr1 - 0.3, L.railTop, z0 - 0.36, xr1, L.railTop + 0.45, z0 + 0.36, C.stop);
      g.box(xr0, L.railTop, z0 - 0.36, xr0 + 0.3, L.railTop + 0.45, z0 + 0.36, C.stop);
    }
    for (x = xr0 + 1.5; x < xr1 - 0.5; x += 3) {           // amarrações curtas entre as duas vigas trilho
      if (used.some(function (b) { return Math.abs(b - x) < 0.8; })) continue;
      g.box(x - 0.12, L.rbBot + 0.25, -G2 + 0.48, x + 0.12, L.rbBot + 0.62, G2 - 0.48, C.railDark);
    }
    for (i = 0; i < used.length; i++) {
      x = used[i];
      g.box(x - 0.45, L.capBot, -G2 - 1.2, x + 0.45, L.rbBot, G2 + 1.2, C.cap);
      [-G2, G2].forEach(function (z) { [-0.5, 0.5].forEach(function (dz) { g.box(x - 0.46, L.capBot + 0.05, z + dz - 0.02, x + 0.46, L.rbBot - 0.05, z + dz + 0.02, C.capDark); }); });
      for (s = -1; s <= 1; s += 2) {
        var z = s * G2;
        g.tube([x, L.pileBot, z], [x, L.capBot, z], 0.4, g.jit(C.pile, 0.07), 18);
        g.tube([x, L.capBot - 0.8, z], [x, L.capBot, z], 0.45, C.pileHead, 18, true);
      }
    }
    return g;
  }
  function buildPlat(M, L) {
    var g = new Geo(23), H = L.H, hx = M.Lp / 2, hz = M.Wp / 2, G2 = M.G / 2, fb = L.frameBot, Hg = L.gal;
    var nb = Math.max(4, Math.round(M.Lp / 2.75)), bay = M.Lp / nb, i, j, x, z, s;
    var nz = Math.max(4, Math.round(M.Wp / 2)), pz = M.Wp / nz;
    for (i = 0; i < nb; i++) for (j = 0; j < nz; j++) g.box(-hx + i * bay + 0.015, H - 0.06, -hz + j * pz + 0.015, -hx + (i + 1) * bay - 0.015, H, -hz + (j + 1) * pz - 0.015, g.jit(C.deck, 0.08));
    for (s = -1; s <= 1; s += 2) g.box(-hx, fb, s * G2 - 0.45, hx, H - 0.06, s * G2 + 0.45, C.frame);
    for (s = -1; s <= 1; s += 2) if (Math.abs(2.75 - G2) > 1.2) g.box(-hx, H - 1.26, s * 2.75 - 0.3, hx, H - 0.06, s * 2.75 + 0.3, C.frame2);
    for (i = 0; i <= nb; i++) { x = -hx + i * bay; g.box(x - 0.15, H - 0.86, -hz, x + 0.15, H - 0.06, hz, C.frame2); }
    function truss(A, B, n) {
      var d = sub(B, A), k, at = function (t, y) { return [A[0] + d[0] * t, y, A[2] + d[2] * t]; };
      g.beam(at(0, H - 0.235), at(1, H - 0.235), 0.35, 0.35, C.truss);
      g.beam(at(0, fb + 0.15), at(1, fb + 0.15), 0.3, 0.3, C.truss);
      for (k = 0; k <= n; k++) g.beam(at(k / n, fb + 0.3), at(k / n, H - 0.41), 0.24, 0.24, C.truss, [1, 0, 0.001]);
      for (k = 0; k < n; k++) { var a = k % 2 ? at(k / n, fb + 0.3) : at(k / n, H - 0.41), b = k % 2 ? at((k + 1) / n, H - 0.41) : at((k + 1) / n, fb + 0.3); g.beam(a, b, 0.18, 0.18, C.truss); }
    }
    for (s = -1; s <= 1; s += 2) truss([-hx, 0, s * hz], [hx, 0, s * hz], nb);
    var nzT = Math.max(3, Math.round(M.Wp / 2.75));
    for (s = -1; s <= 1; s += 2) truss([s * hx, 0, -hz], [s * hx, 0, hz], nzT);
    var e = 0.12, stz0 = -hz + 0.5, stz1 = -hz + 1.5;
    g.guard([-hx + e, H, -hz + e], [hx - e, H, -hz + e], C.guard);
    g.guard([-hx + e, H, hz - e], [hx - e, H, hz - e], C.guard);
    g.guard([-hx + e, H, -hz + e], [-hx + e, H, hz - e], C.guard);
    g.guard([hx - e, H, stz1 + 0.05], [hx - e, H, hz - e], C.guard);
    for (var sx = -1; sx <= 1; sx += 2) for (s = -1; s <= 1; s += 2) {
      x = sx * (hx - 2.5); z = s * G2;
      g.box(x - 1.2, L.railTop + 0.62, z - 0.45, x + 1.2, fb, z + 0.45, C.bogie);
      g.box(x - 1.05, L.railTop + 0.05, z - 0.22, x + 1.05, L.railTop + 0.66, z - 0.16, C.bogie);
      g.box(x - 1.05, L.railTop + 0.05, z + 0.16, x + 1.05, L.railTop + 0.66, z + 0.22, C.bogie);
      [-0.68, 0.68].forEach(function (dx) { g.tube([x + dx, L.railTop + 0.3, z - 0.1], [x + dx, L.railTop + 0.3, z + 0.1], 0.3, C.wheel, 14, true); });
    }
    var Lg = Math.max(3.5, M.S - 1.8), gx0 = hx, gx1 = hx + Lg, gz = hz + 1.5, xg = hx + M.S - 3.25, o = 0.8;
    var floor = function (x0, x1, z0, z1) { if (x1 - x0 > 0.05 && z1 - z0 > 0.05) g.box(x0, Hg - 0.06, z0, x1, Hg, z1, g.jit(C.grate, 0.05)); };
    floor(gx0, xg - o, -gz, gz); floor(xg + o, gx1, -gz, gz);
    floor(xg - o, xg + o, -gz, -G2 - o); floor(xg - o, xg + o, -G2 + o, G2 - o); floor(xg - o, xg + o, G2 + o, gz);
    [-gz + 0.1, -G2 - o - 0.1, -G2 + o + 0.1, 0, G2 - o - 0.1, G2 + o + 0.1, gz - 0.1].forEach(function (fz) {
      g.box(gx0 - 0.2, Hg - 0.36, fz - 0.1, gx1, Hg - 0.06, fz + 0.1, C.frame);
      g.box(gx0 - 0.2, Hg - 0.36, fz - 0.12, gx0 + 0.05, fb + 0.05, fz + 0.12, C.frame);
    });
    g.box(gx1 - 0.2, Hg - 0.36, -gz, gx1, Hg - 0.06, gz, C.frame);
    [-gz + 0.1, 0, gz - 0.1].forEach(function (fz) { g.tube([gx0, H - 0.25, fz], [gx1 - 0.15, Hg + 0.02, fz], 0.07, C.truss, 8); });
    [-G2, G2].forEach(function (zc) {
      g.box(xg - o, Hg, zc - o, xg + o, Hg + 0.25, zc - o + 0.2, C.frame2); g.box(xg - o, Hg, zc + o - 0.2, xg + o, Hg + 0.25, zc + o, C.frame2);
      g.box(xg - o, Hg, zc - o, xg - o + 0.2, Hg + 0.25, zc + o, C.frame2); g.box(xg + o - 0.2, Hg, zc - o, xg + o, Hg + 0.25, zc + o, C.frame2);
      for (var k = 0; k < 14; k++) { var a0 = k / 14 * Math.PI * 2, a1 = (k + 1) / 14 * Math.PI * 2, r = 0.58; g.tube([xg + Math.cos(a0) * r, Hg + 0.32, zc + Math.sin(a0) * r], [xg + Math.cos(a1) * r, Hg + 0.32, zc + Math.sin(a1) * r], 0.06, C.dark, 6); }
    });
    g.guard([gx1 - e, Hg, -gz + e], [gx1 - e, Hg, gz - e], C.guard);
    for (s = -1; s <= 1; s += 2) {
      var zi = s * hz, zo = s * gz;
      g.box(0, Hg - 0.06, Math.min(zi, zo), gx0, Hg, Math.max(zi, zo), g.jit(C.grate, 0.05));
      for (x = 0; x <= hx + 0.01; x += bay) {
        g.box(x - 0.1, Hg - 0.36, Math.min(zi, zo), x + 0.1, Hg - 0.06, Math.max(zi, zo), C.frame);
        g.box(x - 0.1, Hg - 0.36, zi - 0.1, x + 0.1, fb + 0.05, zi + 0.1, C.frame);
        g.tube([x, H - 0.25, zi], [x, Hg + 0.02, zo - s * 0.1], 0.06, C.truss, 8);
      }
      g.guard([0, Hg, zo - s * e], [gx1 - e, Hg, zo - s * e], C.guard);
      g.guard([e, Hg, zi], [e, Hg, zo - s * e], C.guard);
    }
    var run = 2.3, nst = 9;
    [stz0, stz1].forEach(function (zz) {
      g.beam([hx, H, zz], [hx + run, Hg, zz], 0.06, 0.26, C.frame2, [0, 1, 0]);
      g.tube([hx, H + 0.95, zz], [hx + run, Hg + 0.95, zz], 0.025, C.guard, 6);
      g.beam([hx + run, Hg, zz], [hx + run, Hg + 0.95, zz], 0.05, 0.05, C.guard, [1, 0, 0]);
    });
    for (i = 1; i < nst; i++) { var t = i / nst, xs = hx + run * t, ys = H + (Hg - H) * t; g.box(xs - 0.12, ys - 0.04, stz0, xs + 0.12, ys, stz1, C.grate); }
    return { geo: g, Lg: Lg, galZ: gz };
  }
  var CR = { trackL: 8.6, trackH: 1.25, gauge: 5.5, shoe: 1.1, upY: 1.7, foot: [1.5, 1.5], apex: [-3.15, 6.9] };
  function buildCraneBase(g) {
    var r = CR.trackH / 2, cx = CR.trackL / 2 - r, prof = [], k, s, a;
    for (k = 0; k <= 8; k++) { a = -Math.PI / 2 + k / 8 * Math.PI; prof.push([cx + Math.cos(a) * r, r + Math.sin(a) * r]); }
    for (k = 0; k <= 8; k++) { a = Math.PI / 2 + k / 8 * Math.PI; prof.push([-cx + Math.cos(a) * r, r + Math.sin(a) * r]); }
    for (s = -1; s <= 1; s += 2) {
      var zc = s * CR.gauge / 2, z0 = zc - CR.shoe / 2, z1 = zc + CR.shoe / 2;
      g.prism([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], prof, z0, z1, C.track);
      for (var x = -cx; x <= cx + 1e-6; x += 0.32) g.box(x - 0.07, CR.trackH, z0, x + 0.07, CR.trackH + 0.05, z1, C.trackDk);
      [-1, 1].forEach(function (f) {
        var zf = zc + f * CR.shoe / 2;
        for (var xx = -cx + 0.55; xx <= cx - 0.55; xx += 0.8) g.tube([xx, 0.4, zf], [xx, 0.4, zf + f * 0.05], 0.25, C.roller, 12, true);
        [-cx, cx].forEach(function (xe) { g.tube([xe, r, zf], [xe, r, zf + f * 0.06], 0.5, C.roller, 16, true); });
        if (f === s) g.box(-cx + 0.4, 0.66, Math.min(zf, zf + f * 0.03), cx - 0.4, 1.02, Math.max(zf, zf + f * 0.03), C.dark);
      });
    }
    var ci = CR.gauge / 2 - CR.shoe / 2;
    g.box(-2.2, 0.5, -ci, 2.2, 1.3, ci, C.dark);
    g.tube([0, 1.3, 0], [0, CR.upY, 0], 1.55, C.dark, 28, true);
    g.tube([0, 1.42, 0], [0, 1.56, 0], 1.62, C.trackDk, 28, false);
  }
  function buildUpper(g) {
    var Y = C.crane, k, s, y;
    g.box(-4.3, 0, -1.75, 3.1, 0.5, 1.75, Y);
    g.box(-3.9, 0.5, -1.75, 0.7, 2.35, 0.72, Y);
    g.box(-3.9, 0.5, 0.72, 0.9, 1.85, 1.75, Y);
    g.box(-3.95, 2.35, -1.8, 0.75, 2.42, 0.77, C.craneDk);
    for (k = 0; k < 4; k++) g.box(-3.55 + k * 0.5, 1.15, -1.765, -3.25 + k * 0.5, 2.1, -1.75, C.dark);
    g.box(1.0, 0.5, 1.0, 3.0, 2.75, 1.9, Y);
    g.box(3.0, 1.3, 1.08, 3.03, 2.62, 1.82, C.glass);
    g.box(1.25, 1.35, 1.9, 2.9, 2.62, 1.93, C.glass);
    g.box(0.95, 2.75, 0.95, 3.08, 2.85, 1.95, C.dark);
    g.box(-5.5, 0.25, -1.85, -3.9, 2.7, 1.85, C.cw);
    for (y = 0.72; y < 2.6; y += 0.49) g.box(-5.52, y, -1.87, -3.9, y + 0.035, 1.87, C.cwDk);
    for (s = -1; s <= 1; s += 2) {
      var za = s * 1.85, zb = s * 1.28, i = 0;
      for (y = 0.3; y + 0.5 <= 2.68; y += 0.25, i++) g.quadN([-5.53, y, za], [-5.53, y + 0.22, zb], [-5.53, y + 0.47, zb], [-5.53, y + 0.25, za], [-1, 0, 0], i % 2 ? C.white : C.red);
    }
    [-0.85, 0.85].forEach(function (z) { g.box(0.8, 0.5, z - 0.13, 2.0, 1.75, z + 0.13, Y); });
    var ax = CR.apex[0], ay = CR.apex[1];
    for (s = -1; s <= 1; s += 2) { g.beam([-2.1, 2.42, s * 1.2], [ax, ay, s * 1.0], 0.24, 0.24, Y); g.beam([-4.45, 2.7, s * 1.2], [ax, ay, s * 1.0], 0.22, 0.22, Y); }
    g.tube([ax, ay, -1.15], [ax, ay, 1.15], 0.16, C.dark, 10, true);
    for (s = -1; s <= 1; s += 2) g.tube([ax, ay, s * 0.38 - 0.16], [ax, ay, s * 0.38 + 0.16], 0.42, C.dark, 16, true);
  }
  function buildBoom(g, Lb) {
    var Y = C.crane, n = Math.max(8, Math.round(Lb / 1.55)), i, a, b;
    var W = function (t) { return t < 6 ? lerp(1.7, 2.0, t / 6) : t > Lb - 6 ? lerp(2.0, 1.0, (t - Lb + 6) / 6) : 2.0; };
    var D = function (t) { return t < 6 ? lerp(0.5, 1.9, t / 6) : t > Lb - 6 ? lerp(1.9, 0.9, (t - Lb + 6) / 6) : 1.9; };
    var P = function (t, a, b) { return [t, a * D(t) / 2, b * W(t) / 2]; };
    var joint = Math.max(2, Math.round(n / Math.max(1, Math.round(Lb / 6))));
    for (i = 0; i < n; i++) {
      var t0 = i * Lb / n, t1 = (i + 1) * Lb / n, alt = i % 2 ? 1 : -1;
      for (a = -1; a <= 1; a += 2) for (b = -1; b <= 1; b += 2) g.tube(P(t0, a, b), P(t1, a, b), 0.085, Y, 6);
      for (a = -1; a <= 1; a += 2) g.tube(P(t0, a, -alt), P(t1, a, alt), 0.04, Y, 5);
      for (b = -1; b <= 1; b += 2) g.tube(P(t0, -alt, b), P(t1, alt, b), 0.04, Y, 5);
      if (i % joint === 0 && i > 0) { var q = [P(t0, -1, -1), P(t0, 1, -1), P(t0, 1, 1), P(t0, -1, 1)]; for (var k = 0; k < 4; k++) g.tube(q[k], q[(k + 1) % 4], 0.07, C.craneDk, 6); }
    }
    g.tube([0, 0, -0.98], [0, 0, 0.98], 0.13, C.dark, 10, true);
    g.box(Lb - 0.35, -0.45, -0.5, Lb + 0.45, 0.5, 0.5, Y);
    g.tube([Lb + 0.55, -0.15, -0.42], [Lb + 0.55, -0.15, 0.42], 0.5, C.dark, 16, true);
    g.tube([Lb - 0.15, 0.55, -0.3], [Lb - 0.15, 0.55, 0.3], 0.28, C.dark, 12, true);
  }
  function buildHook(g) {
    g.box(-0.36, -1.1, -0.3, 0.36, 0, 0.3, C.hook);
    g.box(-0.4, -0.95, -0.34, 0.4, -0.15, -0.3, C.dark); g.box(-0.4, -0.95, 0.3, 0.4, -0.15, 0.34, C.dark);
    g.tube([0, -1.1, 0], [0, -1.35, 0], 0.08, C.dark, 8);
    var pts = [[-0.27, -1.35, 0]], k; for (k = 0; k <= 9; k++) { var a = Math.PI * (0.95 + k / 9 * 1.35); pts.push([Math.cos(a) * 0.28, -1.62 + Math.sin(a) * 0.28, 0]); }
    for (k = 0; k < pts.length - 1; k++) g.tube(pts[k], pts[k + 1], 0.075, C.dark, 8);
  }
  function rig(Lb, alpha, hookH) {
    var ca = Math.cos(alpha), sa = Math.sin(alpha), F = CR.foot;
    var B = function (t, y) { return [F[0] + t * ca - y * sa, F[1] + t * sa + y * ca]; };
    var tip = B(Lb + 0.55, -0.15);
    return { tip: tip, top: B(Lb - 0.15, 0.55), hookY: Math.min(hookH - CR.upY + 1.85, tip[1] - 2.2), apex: CR.apex, drum: [1.2, 1.9] };
  }

  // ======================= os dois cantitravels =======================
  var DEFM = { cota: 8.70, Lp: 22, Wp: 16, G: 10, S: 6, Lb: 50 };
  var LIM = { cota: [0, 20], Lp: [12, 40], Wp: [10, 30], G: [4, 24], S: [3, 14], Lb: [20, 80] };
  var UNITS = [
    { id: 'ag', name: 'Adhemar Garcia', xs: -380.05, dir: 1, endBlock: '10.', endTxt: 'bloco 10', startTxt: 'entre os blocos 15 e 14',
      ap: [['Início', -380.05], ['Apoio 14', -359.9], ['Apoio 13', -319.7], ['Apoio 12', -279.4], ['Apoio 11', -239.2], ['Bloco 10', -160]] },
    { id: 'bv', name: 'Boa Vista', xs: 327.85, dir: -1, endBlock: '9.', endTxt: 'bloco 9', initX: 99.4, startTxt: 'entre os blocos 1 e 2',
      ap: [['Início', 327.85], ['Apoio 2', 308.1], ['Apoio 3', 268.1], ['Apoio 4', 223.0], ['Apoio 5', 200.0], ['Apoio 6', 159.8], ['Apoio 7', 119.5], ['Apoio 8', 79.2], ['Bloco 9', 0]] }
  ];
  function defUnit() { return { on: true, f: null, slew: 0, ang: 72, hook: 20, t: 0 }; }
  var S = { m: Object.assign({ t: 0 }, DEFM), ag: defUnit(), bv: defUnit() };
  try {
    var o0 = PUB ? PUB.ct : JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o0 && typeof o0 === 'object') ['m', 'ag', 'bv'].forEach(function (k) { if (o0[k] && typeof o0[k] === 'object') Object.assign(S[k], o0[k]); });
  } catch (e) {}

  var K = null, scene = null, blocks = null, R = {}, built = false, sigM = '';
  function ctors(sc) {
    if (K) return K;
    var c = {};
    sc.traverse(function (o) {
      if (!c.Mesh && o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position && o.material && o.material.isMeshStandardMaterial) {
        c.Mesh = o.constructor; c.Attr = o.geometry.attributes.position.constructor; c.Std = o.material.constructor;
        for (var p = Object.getPrototypeOf(o.geometry); p && !c.BG; p = Object.getPrototypeOf(p)) { if (Object.prototype.hasOwnProperty.call(p, 'constructor')) { try { if (new p.constructor().type === 'BufferGeometry') c.BG = p.constructor; } catch (x) {} } }
      }
      if (!c.Line && o.isLineSegments && o.material && o.material.isLineBasicMaterial) { c.Line = o.constructor; c.LineMat = o.material.constructor; }
      if (!c.Group && o.isGroup && o.constructor) c.Group = o.constructor;
    });
    return (K = c.Mesh && c.BG && c.Std && c.Group && c.Line ? c : null);
  }
  var mat = null, ropeMat = null;
  function meshOf(g) {
    var a = g.arrays(), geo = new K.BG();
    geo.setAttribute('position', new K.Attr(a.p, 3)); geo.setAttribute('normal', new K.Attr(a.n, 3)); geo.setAttribute('color', new K.Attr(a.c, 3));
    geo.computeBoundingSphere();
    var m = new K.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.ct62 = 1; return m;
  }
  function findPx() { var px = null; scene.traverse(function (o) { if (!px && o.name === 'Peças para seleção') px = o; }); return px; }

  // blocos da ponte (para as estacas provisórias não baterem neles)
  function readBlocks() {
    var px = findPx(); if (!px || !px.children.length) return null;
    var out = [];
    px.children.forEach(function (m) {
      var u = m.userData || {}, s = String(u.s || '');
      if (!/(^|_)EB\d*$/.test(s) && s !== 'MBL') return;
      m.geometry.computeBoundingBox(); var b = m.geometry.boundingBox;
      out.push({ b: String(u.b || ''), s: s, x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z });
    });
    return out.length ? out : null;
  }
  // filas de estacas (em metros a partir do início, crescendo para a frente)
  function rowsFor(U, M) {
    var r = 0.4, c = 0.6, G2 = M.G / 2, iv = [], uEnd = Infinity;
    blocks.forEach(function (b) {
      var hit = (b.z1 > G2 - r - c && b.z0 < G2 + r + c) || (b.z1 > -G2 - r - c && b.z0 < -G2 + r + c);
      if (!hit) return;
      var u0 = U.dir > 0 ? b.x0 - U.xs : U.xs - b.x1, u1 = U.dir > 0 ? b.x1 - U.xs : U.xs - b.x0;
      if (u1 < -2) return;
      iv.push([u0 - r - c, u1 + r + c]);
      if (b.s === 'MBL' && b.b.indexOf(U.endBlock) === 0) uEnd = Math.min(uEnd, u0 - r - c);
    });
    if (!isFinite(uEnd)) uEnd = U.dir > 0 ? (-163.75 - U.xs) - 1 : (U.xs - 3.75) - 1;
    iv.sort(function (a, b) { return a[0] - b[0]; });
    var inside = function (u) { for (var i = 0; i < iv.length; i++) if (u > iv[i][0] && u < iv[i][1]) return iv[i]; return null; };
    var rows = [], u = 0, b0 = inside(u); if (b0) u = b0[1];
    var guard = 0;
    while (u <= uEnd + 1e-6 && guard++ < 400) {
      rows.push(u);
      var nx = u + M.S, bk = inside(nx);
      if (bk) { var back = bk[0]; nx = back - u >= 2 ? back : bk[1]; }
      if (nx > uEnd + 1e-6) break;
      u = nx;
    }
    return { rows: rows, uEnd: uEnd };
  }
  function kMinOf(rows, M) { var need = 2 * (M.Lp / 2 - 2.5) - 1.5; for (var k = 0; k < rows.length; k++) if (rows[k] - rows[0] >= need) return k; return rows.length - 1; }
  function centerOf(rows, k, M) { return rows[k] + 0.75 - (M.Lp / 2 - 2.5); }
  function kForFront(r, f) { var best = r.kMin, bd = Infinity; for (var k = r.kMin; k < r.rows.length; k++) { var d = Math.abs(r.rows[k] - f); if (d < bd) { bd = d; best = k; } } return best; }
  function wx(U, u) { return U.xs + U.dir * u; }

  // o início mudou (V1.63: Adhemar no eixo 15; V1.64: Adhemar entre os blocos 15 e 14 e Boa Vista entre os blocos 1 e 2).
  // A posição salva é contada a partir do início: aqui ela é recalculada para o cantitravel ficar no mesmo lugar.
  var OLD_X0 = { ag: -359.9, bv: 308.1 };
  function fixStart(U) {
    var st = S[U.id], x0 = st.x0 == null ? OLD_X0[U.id] : st.x0;
    if (st.f != null && x0 !== U.xs) st.f = U.dir * (x0 + U.dir * st.f - U.xs);
    st.x0 = U.xs;
  }
  function buildUnit(U) {
    fixStart(U);
    var M = S.m, L = levels(M), st = S[U.id], r = R[U.id];
    if (r && r.root) { r.root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); }); if (r.root.parent) r.root.parent.remove(r.root); }
    var rr = rowsFor(U, M);
    r = R[U.id] = { U: U, L: L, rows: rr.rows, uEnd: rr.uEnd, kMin: kMinOf(rr.rows, M) };
    if (st.f == null) {
      if (U.initX != null) { var fu = U.dir > 0 ? U.initX - U.xs : U.xs - U.initX; st.f = fu - 0.75 - 2.5; }
      else st.f = rr.rows[rr.rows.length - 1];
    }
    r.k = kForFront(r, st.f);
    var root = new K.Group(); root.name = 'Cantitravel · ' + U.name + ' (V1.62)'; root.userData.ct62 = 1;
    root.position.set(U.xs, GROUND, 0); root.rotation.y = U.dir > 0 ? 0 : Math.PI;
    r.root = root;
    r.via = meshOf(buildVia(M, L, r.rows, r.k)); r.via.name = 'Vigas trilho e estacas'; root.add(r.via);
    var plat = new K.Group(); root.add(plat); r.plat = plat;
    var pg = buildPlat(M, L); r.Lg = pg.Lg; r.galZ = pg.galZ;
    var pm = meshOf(pg.geo); pm.name = 'Plataforma'; plat.add(pm);
    var crane = new K.Group(); crane.position.set(0, L.H, 0); plat.add(crane); r.crane = crane;
    var cb = new Geo(31); buildCraneBase(cb); crane.add(meshOf(cb));
    var up = new K.Group(); up.position.y = CR.upY; crane.add(up); r.upper = up;
    var ug = new Geo(41); buildUpper(ug); up.add(meshOf(ug));
    var boom = new K.Group(); boom.position.set(CR.foot[0], CR.foot[1], 0); up.add(boom); r.boom = boom;
    var bg = new Geo(53); buildBoom(bg, M.Lb); boom.add(meshOf(bg));
    var hg = new Geo(61); buildHook(hg); r.hook = meshOf(hg); up.add(r.hook);
    r.ropes = new K.Line(new K.BG(), ropeMat); r.ropes.frustumCulled = false; up.add(r.ropes);
    r.u = centerOf(r.rows, r.k, M); plat.position.x = r.u;
    root.visible = !!st.on;
    scene.add(root);
    pose(U);
    return r;
  }
  function pose(U) {
    var r = R[U.id], st = S[U.id]; if (!r || !r.upper) return;
    var a = Math.max(30, Math.min(82, +st.ang || 72)) * Math.PI / 180;
    r.upper.rotation.y = (+st.slew || 0) * Math.PI / 180;
    r.boom.rotation.z = a;
    var q = rig(S.m.Lb, a, +st.hook || 20), v = [];
    r.hook.position.set(q.tip[0], q.hookY, 0);
    [-0.38, 0.38].forEach(function (z) { v.push(q.apex[0], q.apex[1], z, q.top[0], q.top[1], z * 0.8); });
    v.push(q.drum[0], q.drum[1], 0, q.tip[0] - 0.2, q.tip[1] + 0.45, 0);
    [-0.18, 0.18].forEach(function (z) { v.push(q.tip[0], q.tip[1] - 0.45, z, q.tip[0], q.hookY, z); });
    var g = r.ropes.geometry; g.setAttribute('position', new K.Attr(new Float32Array(v), 3)); g.computeBoundingSphere();
  }
  function rebuildVia(U) {
    var r = R[U.id]; if (!r) return;
    var old = r.via; r.via = meshOf(buildVia(S.m, r.L, r.rows, r.k)); r.via.name = 'Vigas trilho e estacas';
    r.root.add(r.via); if (old) { r.root.remove(old); old.geometry.dispose(); }
  }

  // ---------- andar (botões e "ir até") ----------
  var anims = {};
  function goK(U, k, instant) {
    var r = R[U.id], st = S[U.id]; if (!r) return;
    k = Math.max(r.kMin, Math.min(r.rows.length - 1, k));
    if (k === r.k && !anims[U.id]) return;
    var fwd = k > r.k, to = centerOf(r.rows, k, S.m);
    st.f = r.rows[k]; touch(U.id);
    if (fwd) { r.k = k; rebuildVia(U); }                       // estacas e trilho aparecem antes de a plataforma andar
    var from = r.plat.position.x, dist = Math.abs(to - from);
    if (instant || dist < 0.01) { r.plat.position.x = r.u = to; if (!fwd) { r.k = k; rebuildVia(U); } after(); return; }
    anims[U.id] = { from: from, to: to, t0: performance.now(), d: Math.min(4500, 900 + dist * 70), k: k, fwd: fwd };
    loop();
    ui();
  }
  var looping = false;
  function loop() {
    if (looping) return; looping = true;
    (function f() {
      var now = performance.now(), any = false;
      UNITS.forEach(function (U) {
        var a = anims[U.id], r = R[U.id]; if (!a || !r) return;
        var t = Math.min(1, (now - a.t0) / a.d), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        r.plat.position.x = r.u = a.from + (a.to - a.from) * e;
        if (t >= 1) { delete anims[U.id]; if (!a.fwd) { r.k = a.k; rebuildVia(U); } after(); }
        else any = true;
      });
      if (any) requestAnimationFrame(f); else looping = false;
    })();
  }
  function after() { overlap(); ui(); }

  // ---------- onde ele passa, ele vale mais: peças da ponte dentro dele somem ----------
  function boxesOf(U) {
    var r = R[U.id], M = S.m, L = r.L, G2 = M.G / 2, hx = M.Lp / 2, out = [];
    if (!S[U.id].on || !r.rows.length) return out;
    var W = function (u0, u1, y0, y1, z0, z1, kind) {
      var a = wx(U, u0), b = wx(U, u1), za = U.dir > 0 ? z0 : -z1, zb = U.dir > 0 ? z1 : -z0;
      out.push({ x0: Math.min(a, b), x1: Math.max(a, b), y0: y0 + GROUND, y1: y1 + GROUND, z0: za, z1: zb, kind: kind });
    };
    var used = r.rows.slice(0, r.k + 1), a0 = used[0] - 0.75, a1 = used[used.length - 1] + 0.75;
    [-1, 1].forEach(function (s) { W(a0, a1, L.rbBot, L.railTop, s * G2 - 0.48, s * G2 + 0.48, 'via'); });
    used.forEach(function (u) { W(u - 0.45, u + 0.45, L.capBot, L.rbBot, -G2 - 1.2, G2 + 1.2, 'via'); [-1, 1].forEach(function (s) { W(u - 0.45, u + 0.45, L.pileBot, L.capBot, s * G2 - 0.45, s * G2 + 0.45, 'via'); }); });
    var c = r.u;
    W(c - hx - 0.2, c + hx + r.Lg, L.gal - 0.4, L.H + 1.15, -r.galZ, r.galZ, 'plat');
    W(c - 5.6, c + 5.6, L.H, L.H + 4.6, -5.6, 5.6, 'plat');      // guindaste (corpo, em qualquer giro)
    return out;
  }
  var pieceBox = null, pieceSig = '';
  function pieces() {
    var px = findPx(); if (!px) return null;
    var sig = px.uuid + ':' + px.children.length + ':' + (px.children[0] ? px.children[0].uuid : '');
    if (pieceBox && sig === pieceSig) return pieceBox;
    var m = {};
    px.children.forEach(function (o) {
      var u = o.userData || {}; if (!u.b || !u.s || !o.geometry) return;
      o.geometry.computeBoundingBox(); var b = o.geometry.boundingBox, k = u.b + '-' + u.s, e = m[k];
      if (!e) m[k] = { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z };
      else { e.x0 = Math.min(e.x0, b.min.x); e.x1 = Math.max(e.x1, b.max.x); e.y0 = Math.min(e.y0, b.min.y); e.y1 = Math.max(e.y1, b.max.y); e.z0 = Math.min(e.z0, b.min.z); e.z1 = Math.max(e.z1, b.max.z); }
    });
    pieceSig = sig; return (pieceBox = m);
  }
  var E = 0.05;
  function hit(a, b) { return a.x0 < b.x1 - E && a.x1 > b.x0 + E && a.y0 < b.y1 - E && a.y1 > b.y0 + E && a.z0 < b.z1 - E && a.z1 > b.z0 + E; }
  var lastHide = '';
  function overlap() {
    var boxes = []; UNITS.forEach(function (U) { if (R[U.id]) boxes = boxes.concat(boxesOf(U)); });
    var pb = pieces(); if (!pb) return;
    var keys = [];
    for (var k in pb) { var p = pb[k]; for (var i = 0; i < boxes.length; i++) if (hit(p, boxes[i])) { keys.push(k); break; } }
    var sig = keys.sort().join(',');
    if (sig !== lastHide) { lastHide = sig; try { window.__oc54 && window.__oc54.setExternal && window.__oc54.setExternal('ct62', keys); } catch (e) {} }
    prelajes(boxes.filter(function (b) { return b.kind === 'plat'; }));
    stats.hidden = keys.length;
  }
  // pré-lajes (desenhadas em grupos pelo 3D): some só a placa que fica dentro da plataforma
  var saved = typeof WeakMap === 'function' ? new WeakMap() : null;
  function prelajes(boxes) {
    var v = window.__v48; if (!v || !v.meshes || !saved) return;
    var n = 0;
    v.meshes.forEach(function (im) {
      if (!im || !im.isInstancedMesh || !im.instanceMatrix) return;
      var arr = im.instanceMatrix.array, sv = saved.get(im), ch = false;
      for (var i = 0; i < im.count; i++) {
        var o = i * 16, e = sv && sv[i] ? sv[i] : arr.subarray(o, o + 16);
        var cx = e[12], cy = e[13], cz = e[14], hx = (Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8])) / 2, hy = (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])) / 2, hz = (Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10])) / 2;
        var bb = { x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy, z0: cz - hz, z1: cz + hz }, inside = false;
        for (var j = 0; j < boxes.length; j++) if (hit(bb, boxes[j])) { inside = true; break; }
        if (inside && !(sv && sv[i])) { if (!sv) { sv = {}; saved.set(im, sv); } sv[i] = Array.prototype.slice.call(arr, o, o + 16); for (var q = 0; q < 16; q++) arr[o + q] = 0; ch = true; n++; }
        else if (!inside && sv && sv[i]) { var zero = true; for (q = 0; q < 16; q++) if (arr[o + q] !== 0) { zero = false; break; } if (zero) for (q = 0; q < 16; q++) arr[o + q] = sv[i][q]; delete sv[i]; ch = true; }
        else if (inside) n++;
      }
      if (ch) im.instanceMatrix.needsUpdate = true;
    });
    stats.prelajes = n;
  }

  // ---------- nuvem ----------
  var serverT = 0, pushing = false, again = false, pushT = null, synced = false, lastPush = 0;
  function saveLocal() { if (PUB) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function touch(part) { if (PUB) return; S[part].t = Date.now(); saveLocal(); clearTimeout(pushT); pushT = setTimeout(push, 1200); }
  function pull() {
    if (PUB) return Promise.resolve(false);
    return fetch(API + '?full=1&keys=' + KEY, { cache: 'no-store' }).then(function (r) { return r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null; })
      .then(function (j) {
        if (j) synced = true; var s = j && j[KEY]; if (!s || s.v == null) return false;
        serverT = Math.max(serverT, s.t || 0); var o = {}; try { o = JSON.parse(s.v) || {}; } catch (e) {}
        var ch = {};
        ['m', 'ag', 'bv'].forEach(function (k) { if (o[k] && typeof o[k].t === 'number' && o[k].t > (S[k].t || 0)) { Object.assign(S[k], o[k]); ch[k] = 1; } });
        if (Object.keys(ch).length) saveLocal();
        return Object.keys(ch).length ? ch : false;
      }).catch(function () { return false; });
  }
  function push() {
    if (PUB) return; if (pushing) { again = true; return; }
    pushing = true;
    pull().then(function (ch) {
      if (ch) applyRemote(ch);
      var t = Math.max(Date.now(), serverT + 1);
      return fetch(API + '/' + encodeURIComponent(KEY), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ v: JSON.stringify(S), t: t }) })
        .then(function (r) { if (r.ok) { serverT = t; lastPush = Date.now(); ui(); } else if (r.status === 409) again = true; });
    }).catch(function () { setTimeout(push, 30000); }).then(function () { pushing = false; if (again) { again = false; setTimeout(push, 400); } });
  }
  function applyRemote(ch) {
    if (!built) return;
    if (ch.m) { rebuildAll(); return; }
    UNITS.forEach(function (U) {
      if (!ch[U.id] || !R[U.id]) return;
      var r = R[U.id], st = S[U.id];
      fixStart(U); r.root.visible = !!st.on; pose(U);
      var k = kForFront(r, st.f); if (k !== r.k) goK(U, k); else after();
    });
    ui();
  }
  function rebuildAll() { UNITS.forEach(function (U) { delete anims[U.id]; buildUnit(U); }); after(); }

  // ---------- painel "Cantitravel · ajustes" (logo abaixo do 3D) ----------
  var box = null;
  function css() {
    if (document.getElementById('ct62-css')) return;
    var s = document.createElement('style'); s.id = 'ct62-css';
    s.textContent = '#ct62{margin:4px 8px 12px;padding:12px 14px;border:1px solid #fdb90038;border-radius:8px;background:linear-gradient(180deg,#151b24,#10151c);color:#e8e5de;font:13px var(--f34,system-ui)}' +
      '#ct62 header{background:none!important;padding:0!important;border:0!important;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;margin-bottom:6px}#ct62 header b{color:#FDB900;font-size:14px}#ct62 header span{color:#9aa3ab;font-size:12px}#ct62 header em{margin-left:auto;font-style:normal;font-size:11.5px;color:#8fd3a5}' +
      '#ct62 .u{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:9px 0;border-top:1px solid #ffffff12}#ct62 .u.off .ctl,#ct62 .u.off .cr{opacity:.4;pointer-events:none}' +
      '#ct62 .nm{display:flex;flex-direction:column;gap:2px;min-width:230px;flex:1}#ct62 .nm label{display:flex!important;flex-direction:row!important;align-items:center;gap:7px;font-weight:650;font-size:13.5px;cursor:pointer}#ct62 .nm input{accent-color:#FDB900;width:16px;height:16px;appearance:auto;-webkit-appearance:checkbox;margin:0}#ct62 .nm small{color:#a9b2ba;font-size:12px;padding-left:23px}' +
      '#ct62 .ctl{display:flex;flex-wrap:wrap;align-items:center;gap:6px}#ct62 button,#ct62 select{font:inherit;font-size:12px;padding:6px 11px;border-radius:5px;border:1px solid #ffffff30;background:#ffffff0d;color:#dfe5ea;cursor:pointer}#ct62 select{padding:5px 8px;background:#0e1319}#ct62 button.main{border-color:#FDB900;background:#FDB900;color:#151515;font-weight:600}#ct62 button:disabled,#ct62 select:disabled{opacity:.4;cursor:default}' +
      '#ct62 .cr{display:flex;flex-wrap:wrap;gap:6px 14px;width:100%;padding-left:23px}#ct62 .cr label{display:flex!important;flex-direction:row!important;align-items:center;gap:6px;font-size:12px;color:#a9b2ba}#ct62 .cr input{width:120px;accent-color:#FDB900}#ct62 .cr output{min-width:38px;color:#ffe08a;font-variant-numeric:tabular-nums}' +
      '#ct62 details{border-top:1px solid #ffffff12;padding-top:8px;margin-top:2px}#ct62 summary{cursor:pointer;color:#dfe5ea;font-weight:600;font-size:12.5px}#ct62 summary small{font-weight:400;color:#e8a14e;margin-left:6px}' +
      '#ct62 .md{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:8px 14px;margin-top:9px}#ct62 .md label{display:flex!important;flex-direction:row!important;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:#c3cad2}#ct62 .md input{width:74px;font:inherit;font-size:12.5px;text-align:right;padding:5px 7px;border-radius:5px;border:1px solid #ffffff30;background:#0e1319;color:#fff;font-variant-numeric:tabular-nums}#ct62 .md input:focus{outline:2px solid #FDB900;outline-offset:1px}' +
      '#ct62 .pub{font-size:12px;color:#ffe08a}#ct62 .md button{justify-self:start;align-self:center}' +
      '@media (max-width:700px){#ct62 .nm{min-width:0;flex-basis:100%}#ct62 .cr input{width:90px}}';
    document.head.append(s);
  }
  function fmt(v, d) { return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function where(U) {
    var r = R[U.id]; if (!r) return '';
    var front = wx(U, r.u + S.m.Lp / 2), ap = U.ap, i;
    for (i = 0; i < ap.length - 1; i++) {
      var a = ap[i][1], b = ap[i + 1][1], lo = Math.min(a, b), hi = Math.max(a, b);
      if (Math.abs(front - b) < 4) return 'Frente no ' + ap[i + 1][0].toLowerCase();
      if (front >= lo && front <= hi) return 'Frente entre o ' + ap[i][0].toLowerCase() + ' e o ' + ap[i + 1][0].toLowerCase();
    }
    if (Math.abs(front - ap[0][1]) < 4) return 'Frente no ' + ap[0][0].toLowerCase();
    return 'Frente no ' + ap[ap.length - 1][0].toLowerCase();
  }
  function mountPanel() {
    var sc = document.getElementById('av-scene'); if (!sc) return false;
    css();
    if (!box) {
      box = document.createElement('section'); box.id = 'ct62';
      var lock = PUB ? ' disabled' : '';
      box.innerHTML = '<header><b>Cantitravel · ajustes</b><span>Frentes de estaca · andam até os blocos 10 e 9, de frente para o Rio Cachoeira</span><em id="ct62-sync"></em></header>' +
        UNITS.map(function (U) {
          return '<div class="u" data-u="' + U.id + '"><div class="nm"><label><input type="checkbox" data-on="' + U.id + '"' + lock + '> Cantitravel ' + U.name + '</label><small data-st="' + U.id + '"></small></div>' +
            '<div class="ctl"><button type="button" data-a="back" title="Volta uma fila: a estaca da frente some com o trecho de viga trilho"' + lock + '>◀ Recuar</button>' +
            '<button type="button" class="main" data-a="fwd" title="Crava a próxima fila de estacas e anda até ela"' + lock + '>Avançar ▶</button>' +
            '<select data-a="go" aria-label="Ir até o apoio"' + lock + '><option value="">Ir até…</option>' + U.ap.map(function (a, i) { return '<option value="' + i + '">' + a[0] + (i ? '' : ' (' + U.startTxt + ')') + '</option>'; }).join('') + '</select>' +
            '<button type="button" data-a="see" title="Levar a câmera até ele">Ver</button></div>' +
            '<div class="cr"><label>Giro <input type="range" data-c="slew" min="-180" max="180" step="1"' + lock + '><output></output></label>' +
            '<label>Lança <input type="range" data-c="ang" min="30" max="82" step="1"' + lock + '><output></output></label>' +
            '<label>Gancho <input type="range" data-c="hook" min="2" max="45" step="0.5"' + lock + '><output></output></label></div></div>';
        }).join('') +
        (PUB ? '<p class="pub">Dashboard publicado: os cantitravels ficam na posição do momento da publicação.</p>' :
        '<details open><summary>Medidas do cantitravel <small>provisório: ajuste aqui, me mande um print e eu deixo fixo</small></summary><div class="md">' +
          [['cota', 'Cota do piso (topo da travessa)', 0.05], ['Lp', 'Comprimento da plataforma (m)', 0.5], ['Wp', 'Largura da plataforma (m)', 0.5], ['G', 'Vigas trilho, eixo a eixo (m)', 0.25], ['S', 'Espaçamento das estacas (m)', 0.25], ['Lb', 'Comprimento da lança (m)', 1]]
            .map(function (d) { return '<label>' + d[1] + '<input type="number" data-m="' + d[0] + '" step="' + d[2] + '" min="' + LIM[d[0]][0] + '" max="' + LIM[d[0]][1] + '"></label>'; }).join('') +
          '<button type="button" data-a="reset">Voltar ao padrão</button></div></details>');
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-a]'); if (!b) return;
        var u = b.closest('[data-u]'), U = u ? UNITS.filter(function (x) { return x.id === u.dataset.u; })[0] : null, a = b.dataset.a;
        if (a === 'reset') { S.m = Object.assign({ t: 0 }, DEFM); touch('m'); rebuildAll(); ui(); return; }
        if (!U || !R[U.id]) return;
        if (a === 'see') { see(U); return; }
        if (PUB) return;
        var r = R[U.id], target = anims[U.id] ? anims[U.id].k : r.k;
        if (a === 'fwd') goK(U, target + 1); else if (a === 'back') goK(U, target - 1);
      });
      box.addEventListener('change', function (e) {
        var t = e.target;
        if (PUB) return;
        if (t.dataset.on) { var U = UNITS.filter(function (x) { return x.id === t.dataset.on; })[0]; S[U.id].on = t.checked; touch(U.id); R[U.id].root.visible = t.checked; after(); return; }
        if (t.dataset.a === 'go' && t.value !== '') {
          var u = t.closest('[data-u]'), U2 = UNITS.filter(function (x) { return x.id === u.dataset.u; })[0], r = R[U2.id], ax = U2.ap[+t.value][1];
          var fu = U2.dir > 0 ? ax - U2.xs : U2.xs - ax, best = r.kMin, bd = Infinity;
          for (var k = r.kMin; k < r.rows.length; k++) { var d = Math.abs(r.rows[k] + 3.25 - fu); if (d < bd) { bd = d; best = k; } }
          goK(U2, best); t.value = ''; return;
        }
        if (t.dataset.m) {
          var key = t.dataset.m, v = Number(String(t.value).replace(',', '.'));
          if (!isFinite(v)) { ui(); return; }
          S.m[key] = Math.min(LIM[key][1], Math.max(LIM[key][0], v));
          S.m.G = Math.min(S.m.G, S.m.Wp - 2);
          touch('m'); rebuildAll(); ui();
        }
      });
      box.addEventListener('input', function (e) {
        var t = e.target; if (!t.dataset.c || PUB) return;
        var u = t.closest('[data-u]'), U = UNITS.filter(function (x) { return x.id === u.dataset.u; })[0];
        S[U.id][t.dataset.c] = Number(t.value); pose(U); outputs(); clearTimeout(cTimer); cTimer = setTimeout(function () { touch(U.id); }, 500);
      });
    }
    if (box.previousElementSibling !== sc) { sc.after(box); ui(); }   // logo abaixo do 3D, antes de "Carros de avanço"
    return true;
  }
  var cTimer = null;
  function outputs() {
    if (!box) return;
    UNITS.forEach(function (U) {
      var st = S[U.id], row = box.querySelector('[data-u="' + U.id + '"]'); if (!row) return;
      row.querySelectorAll('[data-c]').forEach(function (inp) { var k = inp.dataset.c; if (document.activeElement !== inp) inp.value = st[k]; inp.nextElementSibling.textContent = k === 'hook' ? fmt(st[k], st[k] % 1 ? 1 : 0) + ' m' : Math.round(st[k]) + '°'; });
    });
  }
  function ui() {
    if (!box) return;
    UNITS.forEach(function (U) {
      var r = R[U.id], st = S[U.id], row = box.querySelector('[data-u="' + U.id + '"]'); if (!row || !r) return;
      row.classList.toggle('off', !st.on);
      row.querySelector('[data-on]').checked = !!st.on;
      var k = anims[U.id] ? anims[U.id].k : r.k;
      row.querySelector('[data-st]').textContent = (st.on ? where(U) : 'Desligado') + ' · fila ' + (k + 1) + ' de ' + r.rows.length + ' · até o ' + U.endTxt;
      if (!PUB) { row.querySelector('[data-a="back"]').disabled = k <= r.kMin; row.querySelector('[data-a="fwd"]').disabled = k >= r.rows.length - 1; }
    });
    outputs();
    box.querySelectorAll('[data-m]').forEach(function (inp) { if (document.activeElement !== inp) inp.value = S.m[inp.dataset.m]; });
    var sy = document.getElementById('ct62-sync');
    if (sy) sy.textContent = PUB ? '' : lastPush && Date.now() - lastPush < 8000 ? '✓ Salvo na nuvem' : synced ? 'Igual em todos os computadores' : '';
  }
  function see(U) {
    var r = R[U.id], v = window.__v22; if (!r || !v || !v.camera || !v.controls) return;
    var cx = wx(U, r.u), y = S.m.cota;
    v.controls.target.set(cx, y, 0);
    v.camera.position.set(cx - U.dir * 46, y + 34, 52);
    try { v.controls.update(); } catch (e) {}
  }

  // ---------- partida ----------
  var stats = { hidden: 0, prelajes: 0 }, tickN = 0;
  function tick() {
    scene = window.__v40 && window.__v40.scene; if (!scene) return;
    if (!ctors(scene)) return;
    if (!mat) { mat = new K.Std({ vertexColors: true, roughness: 0.78, metalness: 0.12 }); mat.name = 'Cantitravel (cores por vértice)'; ropeMat = new K.LineMat({ color: 0x23262a }); }
    if (!blocks) { blocks = readBlocks(); if (!blocks) return; }
    if (!built) { UNITS.forEach(buildUnit); built = true; after(); }
    UNITS.forEach(function (U) { var r = R[U.id]; if (r && r.root && r.root.parent !== scene) scene.add(r.root); });
    mountPanel();
    var px = findPx(), sig = px ? px.uuid + ':' + px.children.length : '';
    if (sig && sig !== sigM) { sigM = sig; overlap(); }        // o 3D refez as malhas: refaz o que fica escondido
    if (++tickN % 10 === 0) prelajes(boxesPlat());
  }
  function boxesPlat() { var b = []; UNITS.forEach(function (U) { if (R[U.id]) b = b.concat(boxesOf(U).filter(function (x) { return x.kind === 'plat'; })); }); return b; }
  setInterval(tick, 400);
  if (!PUB) {
    pull().then(function (ch) { if (ch) applyRemote(ch); ui(); });
    setInterval(function () { if (document.visibilityState === 'visible' && !pushing) pull().then(function (ch) { if (ch) applyRemote(ch); ui(); }); }, 45000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !pushing) pull().then(function (ch) { if (ch) applyRemote(ch); ui(); }); });
  }
  window.__ct62 = {
    snapshot: function () { return JSON.parse(JSON.stringify(S)); },
    get state() { return S; }, get units() { return R; }, get stats() { return stats; },
    fwd: function (id) { var U = UNITS.filter(function (x) { return x.id === id; })[0]; if (U && R[id]) goK(U, (anims[id] ? anims[id].k : R[id].k) + 1); },
    back: function (id) { var U = UNITS.filter(function (x) { return x.id === id; })[0]; if (U && R[id]) goK(U, (anims[id] ? anims[id].k : R[id].k) - 1); },
    see: function (id) { var U = UNITS.filter(function (x) { return x.id === id; })[0]; if (U) see(U); },
    pull: pull, overlap: overlap
  };
})();
