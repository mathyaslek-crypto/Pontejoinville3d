/* Ponte Joinville — Pasta do RDO do site no 3D (V1.60)
   Os apontadores enviam o RDO finalizado direto para a "Pasta do RDO" do site. Aqui o 3D lê os pacotes novos dessa
   pasta sozinho (como fazia com a pasta do OneDrive): os apontamentos entram no histórico das peças e as mudanças de
   data aparecem na revisão do RDO para aplicar. Um aviso "Pasta do RDO: N novos · revisar" aparece na barra do topo. */
(function () {
  'use strict';
  if (window.__pub58 || location.protocol === 'file:') return;     // painel publicado: sem pasta
  var KEY = 'ponte-rdo-site-v60', seen = {}, busy = false;
  try { seen = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch (e) {} }
  function chip(n) {
    var c = document.getElementById('p60-chip');
    if (!c) {
      var top = document.getElementById('more34'); if (!top) return;
      c = document.createElement('button'); c.type = 'button'; c.id = 'p60-chip'; c.className = top.className;
      c.style.cssText = 'border-color:#FDB900;color:#FDB900';
      top.before(c);
      c.onclick = function () {
        var m = document.getElementById('more34'); if (m) m.click();
        setTimeout(function () { var r = document.getElementById('r35-review'); var t = r && !r.hidden ? r : document.getElementById('r35-status'); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 280);
        c.remove();
      };
    }
    c.textContent = 'Pasta do RDO: ' + n + (n > 1 ? ' novos' : ' novo') + ' · revisar';
  }
  async function scan() {
    var input = document.getElementById('r35-file'); if (busy || !input) return;
    busy = true;
    try {
      var r = await fetch('/api/rdo/lista', { cache: 'no-store' });
      if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) return;
      var L = ((await r.json()).itens || []).slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); }), files = [];
      for (var i = 0; i < L.length; i++) {
        var e = L[i], A = e.arquivos || [];
        for (var j = 0; j < A.length; j++) {
          var f = A[j], k = e.id + ':' + f.n; if (f.kind !== 'pacote' || seen[k]) continue;
          try {
            var q = await fetch('/api/rdo/arquivo/' + encodeURIComponent(e.id) + '/' + f.n, { cache: 'no-store' });
            if (!q.ok) continue;
            files.push(new File([await q.text()], f.nome || (e.id + '.txt'), { type: 'text/plain' }));
          } catch (x) { continue; }
          seen[k] = Date.now();
        }
      }
      save();
      if (!files.length) return;
      var dt = new DataTransfer(); files.forEach(function (f) { dt.items.add(f); });
      input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
      // aviso na barra só quando há algo para revisar e aplicar (o resto já entrou no histórico das peças)
      setTimeout(function () { var rv = document.getElementById('r35-review'); if (rv && !rv.hidden) chip(files.length); }, 900);
    } catch (e) { console.warn('pasta do RDO', e); }
    finally { busy = false; }
  }
  (function start(n) { if (document.getElementById('r35-file')) { setTimeout(scan, 1500); return; } if (n < 80) setTimeout(function () { start(n + 1); }, 700); })(0);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') scan(); });
  setInterval(function () { if (document.visibilityState === 'visible') scan(); }, 5 * 60e3);
  window.__rdopasta60 = { scan: scan, get seen() { return Object.keys(seen).length; } };
})();
