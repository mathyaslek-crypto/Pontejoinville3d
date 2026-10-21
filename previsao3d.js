/* Ponte Joinville — previsão das aduelas no 3D (cronograma de tendência, planilha Cronograma_Ponte_joinville.xlsx, 21/10/2026)
   As datas realizadas continuam como estão: etapas concretadas seguem em cinza sólido e fôrmas em andamento como já aparecem.
   Só as etapas ainda não executadas ganham a cor da previsão de término da aduela:
     azul-claro → previsão até 31/12/2026      amarelo → previsão de 01/01/2027 a 30/03/2027
   Aduelas previstas depois de 30/03/2027 ficam como hoje (transparentes). Cada aduela do cronograma vale para os dois lados (A e B). */
(function () {
  'use strict';
  var PREV = {"9.1":{"ARR":["2026-06-01","2026-09-03"],"A1":["2026-09-10","2026-09-30"],"B1":["2026-09-10","2026-09-30"],"A2":["2026-10-01","2026-11-18"],"B2":["2026-10-01","2026-11-18"],"A3":["2026-11-19","2026-11-27"],"B3":["2026-11-19","2026-11-27"],"A4":["2026-11-30","2026-12-08"],"B4":["2026-11-30","2026-12-08"],"A5":["2026-12-09","2026-12-18"],"B5":["2026-12-09","2026-12-18"],"A6":["2026-12-18","2026-12-28"],"B6":["2026-12-18","2026-12-28"],"A7":["2026-12-29","2027-01-06"],"B7":["2026-12-29","2027-01-06"],"A8":["2027-01-07","2027-01-18"],"B8":["2027-01-07","2027-01-18"],"A9":["2027-01-18","2027-01-26"],"B9":["2027-01-18","2027-01-26"],"A10":["2027-01-27","2027-02-04"],"B10":["2027-01-27","2027-02-04"],"A11":["2027-02-05","2027-02-16"],"B11":["2027-02-05","2027-02-16"],"A12":["2027-02-17","2027-02-25"],"B12":["2027-02-17","2027-02-25"],"A13":["2027-02-26","2027-03-08"],"B13":["2027-02-26","2027-03-08"],"A14":["2027-03-09","2027-03-18"],"B14":["2027-03-09","2027-03-18"],"A15":["2027-03-19","2027-03-29"],"B15":["2027-03-19","2027-03-29"],"A16":["2027-03-30","2027-04-07"],"B16":["2027-03-30","2027-04-07"],"A17":["2027-04-08","2027-04-19"],"B17":["2027-04-08","2027-04-19"],"A18":["2027-04-20","2027-04-28"],"B18":["2027-04-20","2027-04-28"],"A19":["2027-04-29","2027-05-07"],"B19":["2027-04-29","2027-05-07"],"A20":["2027-05-10","2027-05-19"],"B20":["2027-05-10","2027-05-19"]},"9.2":{"ARR":["2026-06-01","2026-09-17"],"A1":["2026-09-21","2026-11-03"],"B1":["2026-09-21","2026-11-03"],"A2":["2026-11-03","2026-11-30"],"B2":["2026-11-03","2026-11-30"],"A3":["2026-12-01","2026-12-09"],"B3":["2026-12-01","2026-12-09"],"A4":["2026-12-10","2026-12-18"],"B4":["2026-12-10","2026-12-18"],"A5":["2026-12-21","2026-12-30"],"B5":["2026-12-21","2026-12-30"],"A6":["2026-12-30","2027-01-07"],"B6":["2026-12-30","2027-01-07"],"A7":["2027-01-08","2027-01-18"],"B7":["2027-01-08","2027-01-18"],"A8":["2027-01-19","2027-01-28"],"B8":["2027-01-19","2027-01-28"],"A9":["2027-01-28","2027-02-05"],"B9":["2027-01-28","2027-02-05"],"A10":["2027-02-08","2027-02-16"],"B10":["2027-02-08","2027-02-16"],"A11":["2027-02-17","2027-02-26"],"B11":["2027-02-17","2027-02-26"],"A12":["2027-03-01","2027-03-09"],"B12":["2027-03-01","2027-03-09"],"A13":["2027-03-10","2027-03-18"],"B13":["2027-03-10","2027-03-18"],"A14":["2027-03-19","2027-03-30"],"B14":["2027-03-19","2027-03-30"],"A15":["2027-03-31","2027-04-08"],"B15":["2027-03-31","2027-04-08"],"A16":["2027-04-09","2027-04-19"],"B16":["2027-04-09","2027-04-19"],"A17":["2027-04-20","2027-04-29"],"B17":["2027-04-20","2027-04-29"],"A18":["2027-04-30","2027-05-10"],"B18":["2027-04-30","2027-05-10"],"A19":["2027-05-11","2027-05-19"],"B19":["2027-05-11","2027-05-19"],"A20":["2027-05-20","2027-05-31"],"B20":["2027-05-20","2027-05-31"]},"10.1":{"ARR":["2026-11-12","2027-02-09"],"A1":["2027-02-16","2027-02-25"],"B1":["2027-02-16","2027-02-25"],"A2":["2027-02-26","2027-03-25"],"B2":["2027-02-26","2027-03-25"],"A3":["2027-03-25","2027-04-05"],"B3":["2027-03-25","2027-04-05"],"A4":["2027-04-05","2027-04-14"],"B4":["2027-04-05","2027-04-14"],"A5":["2027-04-14","2027-04-26"],"B5":["2027-04-14","2027-04-26"],"A6":["2027-04-23","2027-05-04"],"B6":["2027-04-23","2027-05-04"],"A7":["2027-05-04","2027-05-13"],"B7":["2027-05-04","2027-05-13"],"A8":["2027-05-13","2027-05-25"],"B8":["2027-05-13","2027-05-25"],"A9":["2027-05-24","2027-06-02"],"B9":["2027-05-24","2027-06-02"],"A10":["2027-06-02","2027-06-11"],"B10":["2027-06-02","2027-06-11"],"A11":["2027-06-11","2027-06-23"],"B11":["2027-06-11","2027-06-23"],"A12":["2027-06-23","2027-07-02"],"B12":["2027-06-23","2027-07-02"],"A13":["2027-07-02","2027-07-13"],"B13":["2027-07-02","2027-07-13"],"A14":["2027-07-13","2027-07-23"],"B14":["2027-07-13","2027-07-23"],"A15":["2027-07-23","2027-08-03"],"B15":["2027-07-23","2027-08-03"],"A16":["2027-08-03","2027-08-12"],"B16":["2027-08-03","2027-08-12"],"A17":["2027-08-12","2027-08-24"],"B17":["2027-08-12","2027-08-24"],"A18":["2027-08-24","2027-09-02"],"B18":["2027-08-24","2027-09-02"],"A19":["2027-09-02","2027-09-13"],"B19":["2027-09-02","2027-09-13"],"A20":["2027-09-13","2027-09-23"],"B20":["2027-09-13","2027-09-23"]},"10.2":{"ARR":["2026-11-12","2027-02-09"],"A1":["2027-02-16","2027-02-25"],"B1":["2027-02-16","2027-02-25"],"A2":["2027-02-26","2027-03-25"],"B2":["2027-02-26","2027-03-25"],"A3":["2027-03-25","2027-04-05"],"B3":["2027-03-25","2027-04-05"],"A4":["2027-04-05","2027-04-14"],"B4":["2027-04-05","2027-04-14"],"A5":["2027-04-14","2027-04-26"],"B5":["2027-04-14","2027-04-26"],"A6":["2027-04-23","2027-05-04"],"B6":["2027-04-23","2027-05-04"],"A7":["2027-05-04","2027-05-13"],"B7":["2027-05-04","2027-05-13"],"A8":["2027-05-13","2027-05-25"],"B8":["2027-05-13","2027-05-25"],"A9":["2027-05-24","2027-06-02"],"B9":["2027-05-24","2027-06-02"],"A10":["2027-06-02","2027-06-11"],"B10":["2027-06-02","2027-06-11"],"A11":["2027-06-11","2027-06-23"],"B11":["2027-06-11","2027-06-23"],"A12":["2027-06-23","2027-07-02"],"B12":["2027-06-23","2027-07-02"],"A13":["2027-07-02","2027-07-13"],"B13":["2027-07-02","2027-07-13"],"A14":["2027-07-13","2027-07-23"],"B14":["2027-07-13","2027-07-23"],"A15":["2027-07-23","2027-08-03"],"B15":["2027-07-23","2027-08-03"],"A16":["2027-08-03","2027-08-12"],"B16":["2027-08-03","2027-08-12"],"A17":["2027-08-12","2027-08-24"],"B17":["2027-08-12","2027-08-24"],"A18":["2027-08-24","2027-09-02"],"B18":["2027-08-24","2027-09-02"],"A19":["2027-09-02","2027-09-13"],"B19":["2027-09-02","2027-09-13"],"A20":["2027-09-13","2027-09-23"],"B20":["2027-09-13","2027-09-23"]}};
  var CUT1 = '2026-12-31', CUT2 = '2027-03-30';
  var COLORS = { c1: 0x8fd3ff, c2: 0xf6d34a };
  var KEY = 'ponte-previsao-v53';
  var on = true; try { on = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  var root = null, lastProxies = null, mats = null, Mesh = null, Group = null, btn = null, leg = null, counts = { c1: 0, c2: 0 };

  function band(b, s) {
    var p = PREV[b] && PREV[b][s]; if (!p) return null;
    var end = p[1]; return end <= CUT1 ? 'c1' : end <= CUT2 ? 'c2' : null;
  }
  function findProxies(scene) { var px = null; scene.traverse(function (o) { if (!px && o.name === 'Peças para seleção') px = o; }); return px; }
  function prazoOn() { var b = document.getElementById('pl50-btn'); return !!(b && b.getAttribute('aria-pressed') === 'true'); }

  function rebuild(scene, px) {
    if (root) { while (root.children.length) root.remove(root.children[0]); }
    counts = { c1: 0, c2: 0 };
    var seen = {};
    px.children.forEach(function (c) {
      var u = c.userData || {}; if (!u.b || !u.s || !c.isMesh) return;
      var k = band(u.b, u.s); if (!k) return;
      var m = c.material; if (!m || !(m.transparent && m.opacity < .5)) return;   // só etapas ainda não executadas (fantasma)
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
      var bb = c.geometry.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, cz = (bb.min.z + bb.max.z) / 2, s = 1.006;
      var o = new Mesh(c.geometry, mats[k]);
      o.matrixAutoUpdate = false;
      o.matrix.copy(c.matrixWorld);
      o.matrix.elements[0] *= s; o.matrix.elements[5] *= s; o.matrix.elements[10] *= s;   // as malhas já vêm em coordenadas do mundo
      o.matrix.elements[12] += cx * (1 - s); o.matrix.elements[13] += cy * (1 - s); o.matrix.elements[14] += cz * (1 - s);
      o.userData.prev53 = u.b + '-' + u.s; o.renderOrder = 1;
      root.add(o);
      var key = u.b + '-' + u.s; if (!seen[key]) { seen[key] = 1; counts[k]++; }
    });
    if (root.parent !== scene) scene.add(root);
    legend();
  }

  function legend() {
    if (!leg) {
      var css = document.createElement('style');
      css.textContent = '#pv53-leg{position:absolute;left:12px;top:56px;z-index:5;max-width:min(300px,calc(100% - 24px));padding:9px 11px;border-radius:10px;background:#11151bdd;border:1px solid #ffffff22;color:#eef1f5;font:12px var(--f34,system-ui);box-shadow:0 6px 24px #0006;pointer-events:none}#pv53-leg b{display:block;font-size:12.5px;margin-bottom:5px}#pv53-leg div{display:flex;align-items:center;gap:7px;margin:2px 0}#pv53-leg i{width:11px;height:11px;border-radius:3px;flex:0 0 auto}#pv53-leg span{flex:1}#pv53-leg em{font-style:normal;font-weight:700}@media(max-width:760px){#pv53-leg{top:auto;bottom:118px;font-size:11px;padding:7px 9px}}#pv53-btn[aria-pressed=true]{background:#8fd3ff!important;color:#0d2233!important;border-color:#8fd3ff!important}';
      document.head.append(css);
      leg = document.createElement('div'); leg.id = 'pv53-leg';
    }
    var pad = document.getElementById('pad50'), host = pad ? pad.parentElement : null;
    if (!on || prazoOn() || !host) { if (leg.isConnected) leg.remove(); return; }
    if (leg.parentElement !== host) host.append(leg);
    leg.innerHTML = '<b>Previsão das aduelas</b><div><i style="background:#8fd3ff"></i><span>Até 31/12/2026</span><em>' + counts.c1 + '</em></div><div><i style="background:#f6d34a"></i><span>01/01 a 30/03/2027</span><em>' + counts.c2 + '</em></div><div><i style="background:#969ba0"></i><span>Concluída (realizado)</span></div>';
  }

  function mountBtn() {
    var f = document.getElementById('v23-focus'); if (!f) return false;
    if (btn && btn.isConnected) return true;
    btn = document.createElement('button'); btn.type = 'button'; btn.id = 'pv53-btn'; btn.className = f.className; btn.title = 'Mostrar a previsão das aduelas (cronograma de tendência)';
    btn.onclick = function () { on = !on; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} state(); };
    var after = document.getElementById('pl50-btn') || f; after.after(btn); state(); return true;
  }
  function state() {
    if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.textContent = innerWidth < 760 ? 'Previsão' : (on ? 'Previsão: ligada' : 'Previsão: desligada'); }
    if (root) root.visible = on && !prazoOn();
    legend();
  }

  function tick() {
    var scene = window.__v40 && window.__v40.scene; if (!scene) return;
    if (!Mesh) {
      scene.traverse(function (o) { if (!Mesh && o.isMesh && !o.isInstancedMesh && o.material && o.material.isMeshStandardMaterial) { Mesh = o.constructor; mats = { c1: o.material.clone(), c2: o.material.clone() }; } if (!Group && o.isGroup) Group = o.constructor; });
      if (!Mesh || !Group) return;
      ['c1', 'c2'].forEach(function (k) { var m = mats[k]; m.color.setHex(COLORS[k]); m.transparent = true; m.opacity = .9; m.depthWrite = true; m.roughness = .55; m.metalness = 0; if (m.emissive) m.emissive.setHex(k === 'c1' ? 0x0b2a3a : 0x3a2c00); m.map = null; m.needsUpdate = true; });
      root = new Group(); root.name = 'Previsão das aduelas (V1.53)';
    }
    mountBtn();
    var px = findProxies(scene);
    if (px && px !== lastProxies) { lastProxies = px; rebuild(scene, px); }
    if (root && root.parent !== scene) scene.add(root);
    if (root) root.visible = on && !prazoOn();
    if (leg && ((on && !prazoOn()) !== leg.isConnected)) legend();
  }
  setInterval(tick, 800);
  window.__prev53 = { data: PREV, band: band, get counts() { return counts; }, toggle: function (v) { on = v == null ? !on : !!v; state(); } };
})();
