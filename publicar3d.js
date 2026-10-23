/* Ponte Joinville — "Publicar dashboard" com a previsão em uso (V1.58)
   O botão do 3D gera um HTML de consulta, mas esse arquivo levava só o 3D original: a previsão, a pintura feita à mão,
   a cor escolhida, as peças ocultas e as opções do painel ficavam de fora (os ajustes do site são arquivos à parte).
   Aqui o arquivo gerado é interceptado antes de baixar: os scripts do site entram dentro dele e o cenário atual
   (pintura, cores, previsão ligada/desligada, peças ocultas, vigas/aduelas/pré-lajes, barco e colaboradores) fica
   gravado junto. Assim cada publicação é um cenário fixo, que abre em qualquer computador sem internet nem login. */
(function () {
  'use strict';
  if (window.__pub58) return;   // dentro de um arquivo já publicado não há o que fazer
  var SKIP = /^(publicar3d)$/;
  var origClick = HTMLAnchorElement.prototype.click;
  // a página não pode ler endereços blob: (regra de segurança do site): guarda o arquivo quando o 3D cria o link
  var blobs = new Map(), origURL = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    var u = origURL.apply(URL, arguments);
    try { if (obj && obj.type && /text\/html/.test(obj.type)) { blobs.set(u, obj); setTimeout(function () { blobs.delete(u); }, 120000); } } catch (e) {}
    return u;
  };

  function scenario() {
    var paint = { items: {}, custom: null }, prev = { on: true, style: null }, oc = { hidden: [], beamsOff: false, adOff: false, plOff: false }, cena = {}, cen = null;
    try { var C = window.__cen59; if (C) cen = C.info(); } catch (e) {}
    try { var pt = window.__pt55; if (pt) { var it = pt.items || {}; for (var k in it) if (it[k] && it[k].c) paint.items[k] = { c: it[k].c, t: it[k].t || 0 }; paint.custom = pt.custom || null; } } catch (e) {}
    try { var pv = window.__prev53; if (pv) { prev.on = pv.on !== false; prev.style = pv.style; } } catch (e) {}
    try { var o = window.__oc54; if (o) { oc.hidden = o.list || []; oc.beamsOff = !!o.beamsOff; oc.adOff = !!o.adOff; oc.plOff = !!o.prelajeOff; } } catch (e) {}
    try { var c = window.__cena58; if (c) { cena['ponte-bonecos-v58'] = !!c.workers; cena['ponte-barco-v58'] = !!c.boat; } } catch (e) {}
    return { at: new Date().toISOString(), paint: paint, prev: prev, oc: oc, cena: cena, cen: cen };
  }
  function safe(js) { return String(js).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'); }

  function build(html) {
    var tags = [], re = /<script\b[^>]*\bsrc="\/([a-z0-9]+)\.js(\?v=[0-9]+)?"[^>]*><\/script>/g, m;
    while ((m = re.exec(html))) tags.push({ full: m[0], name: m[1], url: '/' + m[1] + '.js' + (m[2] || '') });
    return Promise.all(tags.map(function (t) {
      if (SKIP.test(t.name)) return Promise.resolve('');
      return fetch(t.url, { cache: 'force-cache' }).then(function (r) { if (!r.ok) throw Error(t.name + ': ' + r.status); return r.text(); })
        .then(function (code) { return '<script>/* ' + t.name + '.js */document.addEventListener("DOMContentLoaded",function(){' + safe(code) + '\n});<\/script>'; });
    })).then(function (codes) {
      tags.forEach(function (t, i) { html = html.split(t.full).join(codes[i]); });
      var sc = scenario(), when = new Date(sc.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      var head = '<script>window.__pub58=' + safe(JSON.stringify(sc)) + ';<\/script>' +
        '<script>document.addEventListener("DOMContentLoaded",function(){setInterval(function(){var l=document.getElementById("pv53-leg");if(l&&!l.querySelector(".pub58")){var d=document.createElement("small");d.className="pub58";d.style.cssText="display:block;margin-top:6px;color:#FDB900";d.textContent=' + JSON.stringify('Publicado em ' + when) + ';l.appendChild(d);}},1000);});<\/script>';
      var i = html.indexOf('<head>');
      return i >= 0 ? html.slice(0, i + 6) + head + html.slice(i + 6) : head + html;
    });
  }
  function note(t) { try { var el = document.getElementById('av-message'); if (el) el.textContent = t; } catch (e) {} }

  HTMLAnchorElement.prototype.click = function () {
    var a = this;
    if (a.download && /^Dashboard_/i.test(a.download) && blobs.has(a.href) && !a.dataset.pub58) {
      var name = a.download.replace(/\.html?$/i, '') + '_cenario.html';
      note('Montando o dashboard com a previsão atual…');
      blobs.get(a.href).text().then(build).then(function (html) {
        var url = origURL.call(URL, new Blob([html], { type: 'text/html;charset=utf-8' })), b = document.createElement('a');
        b.href = url; b.download = name; b.dataset.pub58 = '1'; document.body.appendChild(b); origClick.call(b); b.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
        note('Dashboard gerado com a previsão e a pintura atuais (' + name + '). Envie o HTML baixado para as pessoas abrirem no navegador.');
      }).catch(function (e) {
        console.warn('publicar', e); note('Não deu para incluir a previsão (' + e.message + '); baixando o dashboard sem ela.');
        a.dataset.pub58 = '1'; origClick.call(a);
      });
      return;
    }
    return origClick.apply(this, arguments);
  };
  window.__publicar58 = { scenario: scenario, build: build };
})();
