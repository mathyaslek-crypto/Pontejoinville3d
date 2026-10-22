/* Ponte Joinville — ajustes de geometria do modelo 3D (V1.55)
   Apoio 04 (ramo 1000): os blocos 04.1 e 04.2 sobem para a mesma altura do bloco 05.1; os pilares 4.1 e 4.2
   encurtam por baixo (o topo continua no mesmo lugar, então a travessa não muda de altura) e as estacas
   acompanham o bloco. Os dados do modelo são ajustados na memória ao abrir o 3D e o desenho é refeito uma vez. */
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
  window.__aj55 = { adjust: adjust };
})();
