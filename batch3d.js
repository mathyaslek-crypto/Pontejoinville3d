/* Ponte Joinville — desenho mais leve do 3D (V1.58)
   O entorno ilustrativo, a treliça lançadeira e o pátio de fabricação têm mais de mil peças pequenas, e cada uma
   era um pedido de desenho separado à placa de vídeo, a cada quadro. Aqui as peças que ficam paradas são juntadas
   em poucos lotes por material (mesma aparência, mesmo lugar), o que corta a maior parte desses pedidos.
   As peças originais continuam no 3D (só ficam ocultas). Um vigia confere a cada segundo: se o 3D mexer, esconder
   ou trocar alguma peça de um lote (simulação da treliça, botão de entorno etc.), o lote é desfeito na hora e as
   originais voltam; depois que tudo para de novo, o lote é refeito. */
(function () {
  'use strict';
  var TARGETS = ['Entorno ilustrativo', 'Treliça lançadeira · Adhemar', 'Pátio de fabricação · R. Alwino Hansen'];
  var SKIP = /^Terreno|^Rio |Entorno distante|água|agua|water/i, SETTLE = 3000;
  var MOVING = /Trabalhador|Barco|Bote|Pessoa|Caminh|Carro|Gancho|Fischietti|Carrinho/i;   // coisas que andam: nunca entram em lote
  var C = null, conts = {}, stats = { batches: 0, originals: 0, dissolved: 0, why: {}, cand: {} };

  function ctors(scene) {
    if (C) return C;
    var c = {};
    scene.traverse(function (o) {
      if (!c.Mesh && o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) { c.Mesh = o.constructor; c.Attr = o.geometry.attributes.position.constructor;
        for (var p = Object.getPrototypeOf(o.geometry); p && !c.BG; p = Object.getPrototypeOf(p)) { if (Object.prototype.hasOwnProperty.call(p, 'constructor')) { try { if (new p.constructor().type === 'BufferGeometry') c.BG = p.constructor; } catch (x) {} } } }
    });
    c.M4 = scene.matrix.constructor;
    if (!c.Mesh || !c.BG || !c.Attr) return null;
    // índice precisa de atributo inteiro: a classe-base do atributo (a de posição converte tudo para Float32)
    for (var q = c.Attr; q && !c.BA; q = Object.getPrototypeOf(q)) { try { var tst = new q(new Uint32Array(3), 1); if (tst.array instanceof Uint32Array) c.BA = q; } catch (x) {} }
    return (C = c);
  }
  // material: mesma aparência → mesmo lote (material com programa próprio só junta com ele mesmo)
  function matKey(m) {
    if (Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile') || m.isShaderMaterial) return 'u:' + m.uuid;
    var h = function (c) { return c ? c.getHexString() : '-'; }, t = function (x) { return x ? x.uuid : '-'; };
    return [m.type, h(m.color), h(m.emissive), m.emissiveIntensity, t(m.map), t(m.normalMap), t(m.emissiveMap), t(m.alphaMap), t(m.aoMap), t(m.envMap), m.roughness, m.metalness, m.side, m.vertexColors, m.flatShading, m.alphaTest, m.depthWrite, m.depthTest, m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.toneMapped, m.fog, m.wireframe, m.opacity, m.transparent].join('|');
  }
  function eligible(o, cont) {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.batch58 || !o.visible) return false;
    var m = o.material, g = o.geometry;
    if (!m || Array.isArray(m) || m.transparent || !g || !g.attributes || !g.attributes.position || !g.attributes.normal || o.morphTargetInfluences) return false;   // grupos da geometria não importam com material único
    if (SKIP.test(o.name || '')) return false;
    if (MOVING.test(o.name || '')) return false;
    for (var p = o.parent; p && p !== cont; p = p.parent) {          // dentro de um conjunto animado (barco, carro, gancho…) fica fora
      if (!p.visible || SKIP.test(p.name || '') || MOVING.test(p.name || '')) return false;
      for (var k in p.userData) return false;
    }
    return true;
  }
  function rel(o, inv) { return new C.M4().multiplyMatrices(inv, o.matrixWorld); }
  function sigOf(m) { var e = m.elements, s = ''; for (var i = 0; i < 16; i++) s += (Math.round(e[i] * 1000) / 1000) + ','; return s; }

  function build(cont, list) {
    cont.updateMatrixWorld(true);
    var inv = new C.M4().copy(cont.matrixWorld).invert(), groups = {};
    list.forEach(function (o) {
      var g = o.geometry, key = matKey(o.material) + '#' + (g.attributes.uv ? 'uv' : '') + (g.attributes.color ? 'c' : '') + '#' + o.renderOrder;
      (groups[key] = groups[key] || []).push(o);
    });
    var made = [];
    Object.keys(groups).forEach(function (key) {
      var L = groups[key]; if (L.length < 2) return;            // peça sozinha não ganha nada
      var nv = 0, ni = 0, hasUV = !!L[0].geometry.attributes.uv, hasC = !!L[0].geometry.attributes.color;
      L.forEach(function (o) { var g = o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
      var P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = hasUV ? new Float32Array(nv * 2) : null, CO = hasC ? new Float32Array(nv * 3) : null, I = new Uint32Array(ni), vo = 0, io = 0, origs = [];
      L.forEach(function (o) {
        var g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, col = g.attributes.color, ix = g.index, n = pos.count;
        var m = rel(o, inv), e = m.elements;
        // matriz das normais (inversa transposta do 3×3)
        var a = e[0], b = e[4], c = e[8], d = e[1], f = e[5], h = e[9], k = e[2], l = e[6], q = e[10];
        var A = f * q - h * l, B = -(d * q - h * k), Cc = d * l - f * k, det = a * A + b * B + c * Cc || 1;
        var n00 = A / det, n01 = B / det, n02 = Cc / det, n10 = -(b * q - c * l) / det, n11 = (a * q - c * k) / det, n12 = -(a * l - b * k) / det, n20 = (b * h - c * f) / det, n21 = -(a * h - c * d) / det, n22 = (a * f - b * d) / det;
        for (var i = 0; i < n; i++) {
          var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), j = (vo + i) * 3;
          P[j] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          var nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i), X = n00 * nx + n01 * ny + n02 * nz, Y = n10 * nx + n11 * ny + n12 * nz, Z = n20 * nx + n21 * ny + n22 * nz, len = Math.hypot(X, Y, Z) || 1;
          N[j] = X / len; N[j + 1] = Y / len; N[j + 2] = Z / len;
          if (U) { U[(vo + i) * 2] = uv.getX(i); U[(vo + i) * 2 + 1] = uv.getY(i); }
          if (CO) { CO[j] = col.getX(i); CO[j + 1] = col.getY(i); CO[j + 2] = col.getZ(i); }
        }
        if (det < 0) { for (var t = 0; t < (ix ? ix.count : n); t += 3) { var i0 = ix ? ix.getX(t) : t, i1 = ix ? ix.getX(t + 1) : t + 1, i2 = ix ? ix.getX(t + 2) : t + 2; I[io + t] = vo + i0; I[io + t + 1] = vo + i2; I[io + t + 2] = vo + i1; } }   // espelhada: mantém a frente do triângulo
        else for (var t2 = 0; t2 < (ix ? ix.count : n); t2++) I[io + t2] = vo + (ix ? ix.getX(t2) : t2);
        io += ix ? ix.count : n; vo += n;
        origs.push({ o: o, sig: sigOf(m) });
      });
      var geo = new C.BG(); geo.setAttribute('position', new C.Attr(P, 3)); geo.setAttribute('normal', new C.Attr(N, 3));
      if (U) geo.setAttribute('uv', new C.Attr(U, 2)); if (CO) geo.setAttribute('color', new C.Attr(CO, 3));
      geo.setIndex(C.BA ? new C.BA(I, 1) : Array.from(I)); geo.computeBoundingSphere(); geo.computeBoundingBox();
      var mesh = new C.Mesh(geo, L[0].material); mesh.name = 'Lote estático (V1.58)'; mesh.userData.batch58 = true; mesh.userData.origs58 = L; mesh.renderOrder = L[0].renderOrder;
      mesh.castShadow = L[0].castShadow; mesh.receiveShadow = L[0].receiveShadow;
      cont.add(mesh); origs.forEach(function (r) { r.o.visible = false; });
      made.push({ mesh: mesh, origs: origs });
    });
    return made;
  }
  function dissolve(st, b, culprit) {
    if (b.mesh.parent) b.mesh.parent.remove(b.mesh); b.mesh.geometry.dispose();
    b.origs.forEach(function (r) { if (!r.o.visible && r.o.parent) r.o.visible = true; });
    st.batches.splice(st.batches.indexOf(b), 1); stats.dissolved++;
    if (culprit) st.ban[culprit.uuid] = Infinity;       // peça que se mexe fica fora dos lotes de vez
  }
  // vigia: algo mudou numa peça do lote? desfaz o lote
  function watch(cont, st) {
    if (!st.batches.length) return;
    cont.updateMatrixWorld(true);
    var inv = new C.M4().copy(cont.matrixWorld).invert();
    st.batches.slice().forEach(function (b) {
      for (var i = 0; i < b.origs.length; i++) {
        var r = b.origs[i], o = r.o, p = o.parent, ok = !o.visible, why = ok ? '' : 'visivel';
        while (ok && p && p !== cont) { if (!p.visible) { ok = false; why = 'pai oculto'; } p = p.parent; }
        if (ok && p !== cont) { ok = false; why = 'saiu'; }                          // saiu do conjunto
        if (ok && sigOf(rel(o, inv)) !== r.sig) { ok = false; why = 'mexeu'; }       // mexeu
        if (!ok) { stats.why[why] = (stats.why[why] || 0) + 1; stats.last = (o.name || o.parent && o.parent.name || '?') + ' (' + why + ')'; dissolve(st, b, o); return; }
      }
    });
  }
  // cada peça precisa ficar parada alguns segundos antes de entrar num lote
  function scan(cont, st) {
    var now = performance.now(), inv, track = st.track, seen = {}, ready = [];
    cont.updateMatrixWorld(true); inv = new C.M4().copy(cont.matrixWorld).invert();
    cont.traverse(function (o) {
      if (o === cont || !eligible(o, cont) || (st.ban[o.uuid] || 0) > now) return;
      var sg = sigOf(rel(o, inv)), t = track[o.uuid]; seen[o.uuid] = 1;
      if (!t || t.sig !== sg) { track[o.uuid] = { sig: sg, since: now }; return; }
      if (now - t.since >= SETTLE) ready.push(o);
    });
    for (var k in track) if (!seen[k]) delete track[k];
    stats.cand[cont.name] = Object.keys(seen).length + ' candidatas, ' + ready.length + ' prontas';
    if (ready.length < 4 || now - (st.lastBuild || 0) < 4000) return;
    st.lastBuild = now;
    var made = build(cont, ready); st.batches = st.batches.concat(made);
    made.forEach(function (b) { b.origs.forEach(function (r) { delete track[r.o.uuid]; }); });
  }

  function tick() {
    var scene = window.__v40 && window.__v40.scene; if (!scene || !ctors(scene)) return;
    var t0 = performance.now();
    scene.children.forEach(function (cont) {
      if (TARGETS.indexOf(cont.name) < 0) return;
      var st = conts[cont.uuid] || (conts[cont.uuid] = { batches: [], track: {}, ban: {} });
      watch(cont, st);
      if (cont.visible) scan(cont, st);
    });
    // a cena principal também guarda o entorno dentro do grupo do modelo: procura um nível abaixo
    scene.children.forEach(function (g) {
      if (!g.isGroup || TARGETS.indexOf(g.name) >= 0) return;
      g.children.forEach(function (cont) {
        if (TARGETS.indexOf(cont.name) < 0) return;
        var st = conts[cont.uuid] || (conts[cont.uuid] = { batches: [], track: {}, ban: {} });
        watch(cont, st); if (cont.visible) scan(cont, st);
      });
    });
    stats.batches = 0; stats.originals = 0;
    for (var k in conts) conts[k].batches.forEach(function (b) { stats.batches++; stats.originals += b.origs.length; });
    stats.ms = Math.round(performance.now() - t0);
  }
  setInterval(tick, 1000);
  window.__batch58 = { get stats() { return stats; }, off: function () { for (var k in conts) { var st = conts[k]; st.batches.slice().forEach(function (b) { dissolve(st, b); }); } } };
})();
