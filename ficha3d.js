/* Ponte Joinville — ficha completa também para aduelas, arranques e fechamentos (V1.53); previsão do cronograma em todas as fichas
   A ficha da peça (#fc50) do 3D só abre para peças do modelo de vigas/blocos; as aduelas do balanço sucessivo ficavam sem ela.
   Este complemento preenche a mesma caixa (mesmo visual) quando a peça selecionada é uma aduela: etapas, concreto, aço e mão de obra do RDO. */
(function () {
  'use strict';
  var closed = null, shown = null;
  var SERV = function (s) {
    var M = { ESCAVACAO: 'Escavação', MAGRO: 'Concreto magro', ARMACAO: 'Armação', FORMA: 'Fôrma', CONCRETAGEM: 'Concretagem', DESFORMA: 'Desforma', ESCORAMENTO: 'Escoramento', BAINHA: 'Bainha', CORDOALHA: 'Cordoalha', ANCORAGEM: 'Ancoragem', LANCAMENTO: 'Lançamento', '1a PROTENSAO': '1ª protensão', '2a PROTENSAO': '2ª protensão' };
    if (M[s]) return M[s];
    var m = /^(ARMACAO|FORMA|CONCRETAGEM|DESFORMA) (\d)A$/.exec(s);
    return m ? M[m[1]] + ' · etapa ' + m[2] : s;
  };
  var FN = [{ k: 'Encarregado', c: '#3987e5', re: /encarreg|lider|mestre|feitor/ }, { k: 'Carpinteiro', c: '#d95926', re: /carpint/ }, { k: 'Pedreiro', c: '#199e70', re: /pedreir/ }, { k: 'Ajudante', c: '#c98500', re: /ajudant|servent/ }, { k: 'Armador', c: '#d55181', re: /armador|ferreir/ }, { k: 'Outras funções', c: '#9085e9', re: /./ }];
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var fnOf = function (r) { var n = norm(r); for (var i = 0; i < FN.length; i++) if (FN[i].re.test(n)) return FN[i].k; return 'Outras funções'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var brs = function (d) { return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4) : '—'; };
  var fmt = function (n, d) { return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: d == null ? 0 : d }); };
  var na = function (v) { return /^n\.?a/i.test(String(v || '')); };
  function today() { var i = document.querySelector('#top34 input[type=date]'); return (i && i.value) || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); }
  function entities(b, id) { try { return (window.__v39.src() || []).filter(function (e) { return (e.targets || []).some(function (t) { return t.b === b && t.id === id; }); }); } catch (e) { return []; } }
  function events(uids) { var d = window.__v35 && window.__v35.data; return d ? Object.values(d.events || {}).filter(function (e) { return !e.deleted && e.date && uids[e.uid]; }) : []; }

  function render(card, key) {
    var i = key.indexOf('-'), b = key.slice(0, i), id = key.slice(i + 1), es = entities(b, id), D = today();
    var row = (window.__v22.rows || []).filter(function (r) { return r.key === key; })[0] || {};
    var e = es[0], h = '<button type="button" class="x" aria-label="Fechar ficha">✕</button><h3>' + esc(row.name || id) + '</h3>';
    if (!e) { h += '<p class="pl">Peça do modelo sem cadastro na planilha da obra.</p>'; return h; }
    h += '<p class="pl">' + esc([row.category, e.apoio, e.side === 'AG' ? 'lado Adhemar' : 'lado Boa Vista', e.ramo ? 'ramo ' + e.ramo : ''].filter(Boolean).join(' · ')) + '</p>';
    // situação: concluída quando todas as concretagens terminaram
    var conc = Object.keys(e.dates || {}).filter(function (k) { return /^CONCRETAGEM/.test(k); }), last = '', allDone = conc.length > 0, started = false;
    conc.forEach(function (k) { var d = e.dates[k] || {}; if (na(d.start) && na(d.end)) return; if (d.end && d.end <= D) { if (d.end > last) last = d.end; } else allDone = false; });
    for (var k in e.dates) { var d0 = e.dates[k]; if (d0 && d0.start && !na(d0.start) && d0.start <= D) started = true; }
    h += '<span class="st" style="background:' + (allDone ? '#2FB38033' : started ? '#F2C23033' : '#ffffff14') + ';color:' + (allDone ? '#7fe0b5' : started ? '#f6d978' : '#c9d0d8') + '">' + (allDone ? 'Concluída em ' + brs(last) : started ? 'Em execução' : 'Não iniciada') + '</span>';
    // previsão do cronograma de tendência (as datas realizadas abaixo não mudam)
    try { var pv = window.__prev53 && window.__prev53.get(b, id);
      if (pv && !allDone) h += chip(b, id, pv).outerHTML; } catch (x) {}
    // etapas
    var keys = Object.keys(e.dates || {});
    if (keys.length) {
      h += '<h4>Etapas</h4><table><thead><tr><th>Serviço</th><th>Início</th><th>Fim</th></tr></thead><tbody>';
      keys.forEach(function (k) { var d = e.dates[k] || {}; if (na(d.start) && na(d.end)) return; var cl = d.end && d.end <= D ? 'done' : d.start && d.start <= D ? 'prog' : 'none';
        h += '<tr class="' + cl + '"><td>' + esc(SERV(k)) + '</td><td>' + (d.start && d.start <= D ? brs(d.start) : '—') + '</td><td>' + (d.end && d.end <= D ? brs(d.end) : '—') + '</td></tr>'; });
      h += '</tbody></table>';
    }
    // quantidades: previsto (planilha ou modelo 3D) e executado
    var q = e.qty || {}, volM = row.volume, steelM = row.steel != null ? row.steel * 1000 : null;
    var cp = q.cp != null ? q.cp : volM, ap = q.ap != null ? q.ap : steelM;
    h += '<h4>Quantidades</h4><table><tbody><tr><td>Concreto</td><td class="n">prev. ' + (cp == null ? '—' : fmt(cp, 1)) + ' m³</td><td class="n">exec. ' + (q.ce == null ? '—' : fmt(q.ce, 1)) + ' m³</td></tr><tr><td>Aço</td><td class="n">prev. ' + (ap == null ? '—' : fmt(ap, 0)) + ' kg</td><td class="n">exec. ' + (q.ae == null ? '—' : fmt(q.ae, 0)) + ' kg</td></tr></tbody></table>';
    if (q.cp == null && volM != null) h += '<p class="muted" style="margin:4px 0 0">Previsto calculado pelo modelo 3D' + (row.volumes && row.volumes.length > 1 ? ' (' + row.volumes.map(function (v) { return fmt(v, 1); }).join(' + ') + ' m³ por etapa)' : '') + '.</p>';
    // mão de obra do RDO
    var uids = {}; es.forEach(function (x) { uids[x.uid] = 1; });
    var evs = events(uids).filter(function (x) { return x.date <= D; });
    h += '<h4>Mão de obra (RDO)</h4>';
    if (!evs.length) h += '<p class="muted">Nenhum apontamento do RDO para esta peça até a data.</p>';
    else {
      var seen = {}, nSeen = 0, fn = {}, days = {}, hh = 0;
      evs.forEach(function (x) { days[x.date] = 1; (x.workers || []).forEach(function (w) { if (typeof w === 'string') w = { name: w, role: '', hours: 0 }; if (!w || !w.name) return; hh += +w.hours || 0; var kk = x.date + '|' + (x.shift || '') + '|' + norm(w.name); if (seen[kk]) return; seen[kk] = 1; nSeen++; var f = fnOf(w.role); fn[f] = (fn[f] || 0) + 1; }); });
      var ds = Object.keys(days).sort();
      h += '<div class="kp"><div><b>' + nSeen + '</b><span>diárias</span></div><div><b>' + fmt(hh) + '</b><span>horas-homem</span></div><div><b>' + ds.length + '</b><span>dias com equipe</span></div></div><p class="muted" style="margin:6px 0 0">De ' + brs(ds[0]) + ' a ' + brs(ds[ds.length - 1]) + '</p><div class="chips">' +
        FN.filter(function (f) { return fn[f.k]; }).map(function (f) { return '<span class="chip"><i style="background:' + f.c + '"></i><b>' + fn[f.k] + '</b> ' + f.k.toLowerCase() + '</span>'; }).join('') + '</div>';
      var lastEv = evs.slice().sort(function (a, c) { return c.date.localeCompare(a.date); }).slice(0, 6);
      h += '<table style="margin-top:8px"><thead><tr><th>Data</th><th>Serviço</th><th class="n">Pessoas</th></tr></thead><tbody>' + lastEv.map(function (x) { return '<tr><td>' + brs(x.date) + (x.shift === 'noite' ? ' ☾' : '') + '</td><td>' + esc(SERV(x.service)) + '</td><td class="n">' + (x.workers || []).length + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    return h;
  }

  // selo da previsão do cronograma (mesmo visual dos selos de situação)
  function chip(b, id, pv) {
    var bd = window.__prev53.band(b, id), sp = document.createElement('span');
    sp.className = 'st pv53'; sp.title = 'Cronograma: ' + pv[2];
    sp.style.cssText = 'background:' + (bd === 'c1' ? '#8fd3ff33' : bd === 'c2' ? '#f6d34a33' : '#ffffff14') + ';color:' + (bd === 'c1' ? '#bfe6ff' : bd === 'c2' ? '#f8e08a' : '#c9d0d8');
    sp.textContent = 'Previsão: ' + brs(pv[0]) + ' a ' + brs(pv[1]);
    return sp;
  }
  // na ficha original (blocos, pilares, travessas, estacas...) acrescenta a previsão logo depois da situação
  function nativeChip(card, b, id) {
    if (card.hidden || card.querySelector('.pv53') || !window.__prev53) return;
    var pv = window.__prev53.get(b, id); if (!pv) return;
    var st = card.querySelector('span.st'); if (!st || /^Conclu/.test(st.textContent)) return;
    var last = st; while (last.nextElementSibling && last.nextElementSibling.matches('span.st')) last = last.nextElementSibling;
    last.after(chip(b, id, pv));
  }

  function check() {
    var v = window.__v22, card = document.getElementById('fc50');
    if (!v || !card) return;
    var sel = v.selected || [];
    if (sel.length !== 1) { if (shown) { shown = null; card.hidden = true; } closed = null; return; }
    var key = sel[0], i = key.indexOf('-'), b = key.slice(0, i), id = key.slice(i + 1);
    if (closed && closed !== key) closed = null;
    var native = false; try { native = !!window.__v40.Ze(b, id); } catch (e) {}
    if (native) { shown = null; nativeChip(card, b, id); return; }            // a ficha original cuida das outras peças
    if (key === closed) { card.hidden = true; return; }
    if (shown === key && !card.hidden && card.dataset.ext === key) return;
    card.innerHTML = render(card, key); card.dataset.ext = key; card.hidden = false; card.scrollTop = 0; shown = key;
    var x = card.querySelector('.x'); if (x) x.onclick = function () { closed = key; shown = null; card.hidden = true; };
  }
  setInterval(check, 350);
  window.__ficha53 = { check: check };
})();
