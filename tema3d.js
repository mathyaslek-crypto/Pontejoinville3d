/* Ponte Joinville — temas do 3D (V1.82; desenho dos modelos na V1.83): Liquid Glass escuro e Liquid Glass claro, com botão de sol/lua na barra
   de cima (igual ao RDO). O 3d.html não é editado: este módulo lê a cor que cada elemento já tem e, uma vez,
   anota nele o que trocar (atributo data-tg + variáveis --tg-*). As regras abaixo só valem com a classe do tema no
   <html>, então trocar de tema é só trocar a classe. Elementos novos (painéis redesenhados, menus, janelas)
   são anotados quando aparecem. O canvas do 3D e o direcional (#pad50) ficam como estão.
   Escolha guardada no aparelho: localStorage 'ponte-tema-3d' = 'escuro' | 'claro'. */
(function () {
  'use strict';
  var KEY = 'ponte-tema-3d';
  var tema = 'escuro';
  try { var t = localStorage.getItem(KEY); if (t === 'claro' || t === 'escuro') tema = t; } catch (e) {}
  var H = document.documentElement;
  function aplica() { H.classList.add('tg-on'); H.classList.toggle('tg-claro', tema === 'claro'); H.classList.toggle('tg-escuro', tema === 'escuro'); syncBtn(); }
  aplica();

  // ---------- cores ----------
  function parse(c) {
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(c || '');
    if (!m) return null;
    var a = m[4] == null ? 1 : (m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : +m[4]);
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: a };
  }
  function hsl(c) {
    var mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b), l = (mx + mn) / 2, s = 0, h = 0, d = mx - mn;
    if (d) { s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === c.r ? (c.g - c.b) / d + (c.g < c.b ? 6 : 0) : mx === c.g ? (c.b - c.r) / d + 2 : (c.r - c.g) / d + 4; h *= 60; }
    return { h: h, s: s, l: l };
  }
  function css(h, s, l, a) { return 'hsla(' + Math.round(h) + ',' + Math.round(s * 100) + '%,' + Math.round(l * 100) + '%,' + (+a.toFixed(3)) + ')'; }
  // cor de texto/ícone pensada para fundo escuro → versão legível em fundo claro
  function txtClaro(c) {
    var x = hsl(c);
    if (x.s < .22) { var l = x.l > .8 ? .13 : x.l > .6 ? .3 : x.l > .4 ? .38 : x.l; return css(220, .2, Math.min(l, .4), 1); }
    return css(x.h, Math.min(1, x.s), Math.min(.36, Math.max(.2, 1 - x.l - .1)), 1);
  }
  // fundo pequeno (botão, campo, etiqueta) escuro → claro
  function bgClaro(c) {
    var x = hsl(c);
    if (x.s < .22) return 'rgba(255,255,255,' + Math.min(.85, .45 + c.a * .3).toFixed(2) + ')';
    return css(x.h, Math.min(.9, x.s), Math.max(.86, 1 - x.l * .5), Math.max(.6, c.a));
  }
  var dark = function (c) { return c && c.a > .3 && hsl(c).l < .26; };
  function gradDark(img) {
    if (!img || img === 'none' || img.indexOf('gradient') < 0 || img.indexOf('url(') >= 0) return false;
    var cs = img.match(/rgba?\([^)]+\)/g) || [], n = 0;
    for (var i = 0; i < cs.length; i++) { var c = parse(cs[i]); if (!c) continue; if (c.a < .3) continue; if (hsl(c).l >= .3) return false; n++; }
    return n > 0;
  }

  // ---------- anotação ----------
  var SKIP = 'canvas,#av-scene,#pad50,video,img,iframe,script,style,link,meta,noscript,template';
  function anota(el) {
    if (el.hasAttribute('data-tg')) return;
    if (el.closest(SKIP)) { el.setAttribute('data-tg', ''); return; }
    var svg = el instanceof SVGElement;
    var r = el.getBoundingClientRect();
    if (!svg && !r.width && !r.height) return;          // escondido: anota quando aparecer
    var s = getComputedStyle(el), tk = [];
    var col = parse(s.color);
    if (svg) {
      var isText = el.tagName === 'text' || el.tagName === 'tspan';
      var f = parse(s.fill), st = parse(s.stroke);
      if (f && f.a > .05) { var hf = hsl(f);
        if (isText || hf.s < .22) { el.style.setProperty('--tg-f', isText ? txtClaro(f) : (hf.l < .4 ? 'rgba(27,34,50,' + Math.min(.12, f.a * .2).toFixed(3) + ')' : txtClaro(f))); tk.push('f'); } }
      if (st && st.a > .05 && s.stroke !== 'none') { var hs = hsl(st);
        if (hs.s < .22) { el.style.setProperty('--tg-s', hs.l < .4 ? 'rgba(27,34,50,.12)' : 'rgba(27,34,50,' + Math.max(.2, Math.min(.5, st.a * .6)).toFixed(2) + ')'); tk.push('s'); } }
      el.setAttribute('data-tg', tk.join(' '));
      return;
    }
    // fundo
    var bg = parse(s.backgroundColor), big = r.width >= 110 && r.height >= 44, page = r.width >= innerWidth * .9 && r.height >= 380;
    var darkBg = dark(bg) || gradDark(s.backgroundImage);
    if (el.id === 'top34') tk.push('bar');
    else if (darkBg && (page || el.id === 'alya-dashboard')) tk.push('page');
    else if (darkBg && big && !/^(BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|LABEL)$/.test(el.tagName)) {
      tk.push('card');
      var b = getComputedStyle(el, '::before'), a = getComputedStyle(el, '::after');
      if ((b.content === '""' || b.content === "''") && b.backgroundImage === 'none') tk.push('nob');
      if ((a.content === '""' || a.content === "''") && a.backgroundImage === 'none') tk.push('noa');
    } else if (bg && bg.a > .3 && hsl(bg).l < .3) { el.style.setProperty('--tg-bg', bgClaro(bg)); tk.push('ctl'); }
    else if (gradDark(s.backgroundImage)) { tk.push('ctlg'); }
    else if (bg && bg.a > .3 && hsl(bg).s >= .22 && hsl(bg).l < .4) { el.style.setProperty('--tg-bg', bgClaro(bg)); tk.push('ctl'); }
    // texto
    if (col && col.a > .3) { var hc = hsl(col);
      if (hc.l > .45 || (hc.s >= .22 && hc.l > .35)) { el.style.setProperty('--tg-c', txtClaro(col)); tk.push('c'); } }
    // borda
    var bc = parse(s.borderTopColor), bw = parseFloat(s.borderTopWidth) || parseFloat(s.borderBottomWidth) || parseFloat(s.borderLeftWidth);
    if (bw && bc && bc.a > .05) { var hb = hsl(bc); if (hb.s < .22) tk.push('bd'); }
    // marcador de texto de campo
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') tk.push('in');
    el.setAttribute('data-tg', tk.join(' '));
  }
  var pend = false;
  function varre() {
    pend = false;
    var L = document.body ? document.body.querySelectorAll('*:not([data-tg])') : [];
    for (var i = 0; i < L.length; i++) { try { anota(L[i]); } catch (e) {} }
  }
  function agenda() { if (pend) return; pend = true; setTimeout(function () { (window.requestIdleCallback || requestAnimationFrame)(varre); }, 180); }

  // ---------- regras (o :not(#_) dá peso de id, para valer por cima das regras do 3D) ----------
  var X = ':not(#_tg):not(#_tg):not(#_tg)';
  var C = 'html.tg-claro body', E = 'html.tg-escuro body', B = 'html.tg-on body';
  var glassD = 'background:rgba(255,255,255,.055)!important;background-image:none!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:22px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(255,255,255,.03),0 14px 34px rgba(0,0,0,.42)!important;';
  var glassL = 'background:rgba(255,255,255,.58)!important;background-image:none!important;border:1px solid rgba(255,255,255,.9)!important;border-radius:22px!important;box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 rgba(255,255,255,.45),0 10px 28px rgba(40,60,110,.12)!important;';
  var blur = '-webkit-backdrop-filter:blur(22px) saturate(170%);backdrop-filter:blur(22px) saturate(170%);';
  var R = [
    // fontes do próprio site (pasta fontes/, licença OFL): o 3D só aceita fontes do mesmo endereço
    '@font-face{font-family:"Inter Tight";src:url(/fontes/inter-tight.woff) format("woff");font-weight:100 900;font-display:swap}',
    '@font-face{font-family:Manrope;src:url(/fontes/manrope.woff) format("woff");font-weight:200 800;font-display:swap}',
    // fundo da página: liso, sem luzes
    E + '{background:#07090d!important}', C + '{background:#eef2f7!important}',
    E + ' [data-tg~=page]' + X + '{background:#07090d!important;background-image:none!important}',
    C + ' [data-tg~=page]' + X + '{background:linear-gradient(160deg,#f5f7fb 0%,#e9eef5 100%)!important}',
    B + ' [data-tg~=page]' + X + '::after,' + B + ' [data-tg~=page]' + X + '::before{background:none!important;background-image:none!important}',
    // barra de cima
    E + ' [data-tg~=bar]' + X + '{background:rgba(12,15,21,.72)!important;border-bottom:1px solid rgba(255,255,255,.1)!important;box-shadow:0 10px 30px rgba(0,0,0,.35)!important;' + blur + '}',
    C + ' [data-tg~=bar]' + X + '{background:rgba(255,255,255,.66)!important;border-bottom:1px solid rgba(255,255,255,.95)!important;box-shadow:0 8px 24px rgba(40,60,110,.1)!important;' + blur + '}',
    // cartões de vidro
    E + ' [data-tg~=card]' + X + '{' + glassD + '}', C + ' [data-tg~=card]' + X + '{' + glassL + '}',
    B + ' [data-tg~=nob]' + X + '::before,' + B + ' [data-tg~=noa]' + X + '::after{display:none!important}',
    // botões, campos e etiquetas escuros
    E + ' [data-tg~=ctl]' + X + ',' + E + ' [data-tg~=ctlg]' + X + '{background:rgba(255,255,255,.07)!important;background-image:none!important}',
    C + ' [data-tg~=ctl]' + X + '{background:var(--tg-bg)!important;background-image:none!important}',
    C + ' [data-tg~=ctlg]' + X + '{background:rgba(255,255,255,.7)!important;background-image:none!important}',
    E + ' [data-tg~=bd]' + X + '{border-color:rgba(255,255,255,.13)!important}',
    C + ' [data-tg~=bd]' + X + '{border-color:rgba(27,34,50,.13)!important}',
    // texto e gráficos no claro
    C + ' [data-tg~=c]' + X + '{color:var(--tg-c)!important;text-shadow:none!important}',
    C + ' [data-tg~=f]' + X + '{fill:var(--tg-f)!important}',
    C + ' [data-tg~=s]' + X + '{stroke:var(--tg-s)!important}',
    C + ' [data-tg~=in]' + X + '::placeholder{color:#6a7486!important}',
    'html.tg-claro{color-scheme:light}',
    // o 3D continua com fundo escuro dentro do cartão claro
    C + ' #av-scene' + X + '{background:#0e131b!important;border-radius:14px}',
    // botão do tema
    '#tg-btn{width:34px;height:34px;flex:none;display:grid;place-items:center;border-radius:999px;cursor:pointer;padding:0;margin:0 2px}',
    E + ' #tg-btn' + X + '{background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.16)!important;color:#ffd166!important}',
    C + ' #tg-btn' + X + '{background:rgba(255,255,255,.8)!important;border:1px solid rgba(27,34,50,.14)!important;color:#1b2232!important}',
    '#tg-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}'
  ];
  // ---------- desenho dos modelos (V1.83): letras, anéis, barras e botões como nas imagens escolhidas ----------
  var D = 'html.tg-on body #alya-dashboard' + X, Dc = 'html.tg-claro body #alya-dashboard' + X, De = 'html.tg-escuro body #alya-dashboard' + X;
  var T = 'html.tg-on body #top34' + X, Tc = 'html.tg-claro body #top34' + X, Te = 'html.tg-escuro body #top34' + X;
  R.push(
    // fontes: Inter Tight no claro, Manrope no escuro (só textos; o 3D não muda)
    'html.tg-claro body #aduela-v1 *:not(#av-scene *):not(svg):not(svg *),html.tg-claro body #pl48 *{font-family:"Inter Tight",system-ui,-apple-system,"Segoe UI",sans-serif!important}',
    'html.tg-escuro body #aduela-v1 *:not(#av-scene *):not(svg):not(svg *),html.tg-escuro body #pl48 *{font-family:Manrope,system-ui,-apple-system,"Segoe UI",sans-serif!important}',
    'html.tg-claro body #aduela-v1 svg text{font-family:"Inter Tight",system-ui,sans-serif!important}',
    'html.tg-escuro body #aduela-v1 svg text{font-family:Manrope,system-ui,sans-serif!important}',
    // cartões: cantos de 22px e sem efeito de inclinação 3D
    'html.tg-on body #alya-dashboard [data-tg~=card]' + X + ',html.tg-on body #aduela-v1 > .av-body > section[data-tg~=card]' + X + '{border-radius:22px!important;transform:none!important}',
    D + ' .a28-panel-head h2::before,' + D + ' .a29-counter h2::before{display:none!important}',
    D + ' h2{font-weight:600!important;letter-spacing:0!important}',
    // contadores: anel à esquerda, nome e números à direita
    D + ' .a29-counter{display:grid!important;grid-template-columns:64px minmax(0,1fr)!important;grid-template-rows:auto auto!important;column-gap:12px!important;row-gap:4px!important;align-items:center!important;align-content:center!important;text-align:left!important;padding:14px!important;min-height:112px;box-sizing:border-box}',
    D + ' .a29-counter h2{grid-column:2!important;grid-row:1!important;font-size:13px!important;min-height:0!important;margin:0!important;align-self:end}',
    D + ' .a29-orbit{grid-column:1!important;grid-row:1 / span 2!important;width:64px!important;margin:0!important;transform:none!important}',
    D + ' .a29-orbit svg circle[stroke-width="1"]{display:none!important}',
    D + ' svg g.tk37{display:none!important}',
    D + ' .a29-orbit svg circle[stroke-dasharray],' + D + ' .a28-donut svg circle[stroke-dasharray]{filter:none!important}',
    De + ' .a29-orbit svg circle[stroke-dasharray],' + De + ' .a28-donut svg circle[stroke-dasharray]{filter:drop-shadow(0 0 5px rgba(255,194,61,.45))!important}',
    D + ' .a29-orbit strong{font-size:12px!important;font-weight:700!important;letter-spacing:0!important;text-shadow:none!important}',
    D + ' .a29-orbit span,' + D + ' .a28-donut span{display:none!important}',
    D + ' .a29-counts{grid-column:2!important;grid-row:2!important;display:flex!important;flex-direction:column!important;gap:1px!important;border:0!important;padding:0!important;margin:0!important;max-width:none!important;width:auto!important;background:none!important;align-self:start}',
    D + ' .a29-counts span{display:block!important;font-size:12px!important;border:0!important;text-transform:lowercase}',
    D + ' .a29-counts b{display:inline!important;font-size:15px!important;margin-right:4px;text-shadow:none!important}',
    De + ' .a29-counts b{color:#fff!important}', Dc + ' .a29-counts b{color:#1b2232!important}',
    De + ' .a29-counts span{color:#a3adbd!important}', Dc + ' .a29-counts span{color:#556074!important}',
    D + ' .a29-total,' + D + ' .a29-note:not(:has(a,button)){display:none!important}',
    D + ' .a29-note{grid-column:2!important;margin:2px 0 0!important;font-size:11.5px!important}',
    // avanço total
    D + ' #a28-ring{display:flex!important;align-items:center!important;gap:18px!important}',
    D + ' .a28-donut{width:104px!important;margin:0!important;flex:none!important;transform:none!important}',
    D + ' .a28-donut strong{font-size:22px!important;font-weight:700!important;letter-spacing:-.01em!important;text-shadow:none!important}',
    // concreto, armação e vigas lançadas
    D + ' .a28-icon{display:none!important}',
    D + ' .a28-kpi h2{font-size:13px!important}',
    D + ' .a28-value{font-size:30px!important;font-weight:700!important;letter-spacing:-.01em!important;text-shadow:none!important}',
    De + ' .a28-percent{color:#ffc23d!important}', Dc + ' .a28-percent{color:#8a5c00!important}',
    D + ' .a28-percent{font-weight:700!important}',
    D + ' .a28-meter{height:8px!important;border-radius:99px!important}',
    De + ' .a28-meter{background:rgba(255,255,255,.08)!important}', Dc + ' .a28-meter{background:rgba(27,34,50,.08)!important}',
    D + ' .a28-meter i{border-radius:99px!important}',
    De + ' .a28-meter i{background:linear-gradient(90deg,#ffb000,#ffd76e)!important;box-shadow:0 0 12px rgba(255,194,61,.55)}',
    Dc + ' .a28-meter i{background:#f2a900!important}',
    D + ' .a28-tag{border-radius:999px!important;padding:3px 9px!important;font-size:9.5px!important;letter-spacing:.06em!important}',
    De + ' .a28-tag{border-color:rgba(255,255,255,.16)!important;color:#a3adbd!important}', Dc + ' .a28-tag{border-color:rgba(27,34,50,.14)!important;color:#556074!important}',
    // gráfico: valor grande e botões Concreto/Armação em pílula
    D + ' .a28-chart-total strong{font-size:24px!important;font-weight:700!important;text-shadow:none!important}',
    D + ' .a28-toggle{gap:4px!important;padding:3px!important;border-radius:999px!important}',
    De + ' .a28-toggle{background:rgba(255,255,255,.05)!important;border:1px solid rgba(255,255,255,.12)!important}',
    Dc + ' .a28-toggle{background:rgba(255,255,255,.55)!important;border:1px solid rgba(255,255,255,.9)!important}',
    D + ' .a28-toggle button{border-radius:999px!important;border:0!important;min-height:26px!important;padding:0 12px!important;font-size:12px!important;box-shadow:none!important}',
    De + ' .a28-toggle button{background:transparent!important;color:#c5ccd8!important}', De + ' .a28-toggle button[aria-pressed=true]{background:rgba(255,255,255,.16)!important;color:#fff!important;font-weight:700!important}',
    Dc + ' .a28-toggle button{background:transparent!important;color:#3b4558!important}', Dc + ' .a28-toggle button[aria-pressed=true]{background:#fff!important;color:#1b2232!important;font-weight:600!important;box-shadow:0 2px 6px rgba(30,40,80,.14)!important}',
    // avanço por frente: barras lisas e arredondadas no lugar das barras 3D
    D + ' .ghost37{display:none!important}',
    D + ' .stage37{width:78%!important;margin-right:0!important}',
    D + ' .bar37{border-radius:12px 12px 6px 6px!important;transform:none!important;border:0!important}',
    D + ' .bar37::before,' + D + ' .bar37::after{display:none!important}',
    De + ' .bar37{background:linear-gradient(180deg,rgba(255,215,110,.97),rgba(255,176,0,.8))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 0 18px rgba(255,176,0,.33)!important}',
    Dc + ' .bar37{background:linear-gradient(180deg,#ffc94a,#f2a900)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 6px 14px rgba(242,169,0,.3)!important}',
    D + ' .pct37{text-shadow:none!important;font-weight:700!important}',
    De + ' .pct37{color:#fff!important}', Dc + ' .pct37{color:#1b2232!important}',
    D + ' .col37 b{font-weight:500!important}',
    // barra de cima: busca, filtros e botões em pílula
    T + ' #q34{border-radius:999px!important}',
    Te + ' #q34{background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.14)!important}',
    Tc + ' #q34{background:rgba(255,255,255,.6)!important;border:1px solid rgba(255,255,255,.95)!important;box-shadow:inset 0 1px 2px rgba(30,40,70,.08)!important}',
    T + ' kbd{border-radius:999px!important}',
    T + ' .a28-scopes{border-radius:999px!important;padding:3px!important;gap:3px!important;overflow:visible!important}',
    Te + ' .a28-scopes{background:rgba(255,255,255,.05)!important;border:1px solid rgba(255,255,255,.12)!important}',
    Tc + ' .a28-scopes{background:rgba(255,255,255,.45)!important;border:1px solid rgba(255,255,255,.9)!important}',
    T + ' .a28-scopes button{border-radius:999px!important;border:0!important;height:30px!important;min-height:30px!important}',
    Te + ' .a28-scopes button{background:transparent!important;color:#c5ccd8!important}',
    Te + ' .a28-scopes button[aria-pressed=true],' + Te + ' .a28-scopes button.on,' + Te + ' .a28-scopes button.active{background:#ffc23d!important;color:#1a1405!important;font-weight:700!important;box-shadow:0 4px 16px rgba(255,194,61,.35),inset 0 1px 0 rgba(255,255,255,.6)!important}',
    Tc + ' .a28-scopes button{background:transparent!important;color:#3b4558!important}',
    Tc + ' .a28-scopes button[aria-pressed=true],' + Tc + ' .a28-scopes button.on,' + Tc + ' .a28-scopes button.active{background:#fff!important;color:#1b2232!important;font-weight:600!important;box-shadow:0 2px 8px rgba(30,40,80,.15),inset 0 1px 0 #fff!important}',
    T + ' input#a28-date,' + T + ' #a28-today,' + T + ' .t34-ghost{border-radius:999px!important}',
    Tc + ' #go3d34{background:#1b2232!important;color:#fff!important;border-color:#1b2232!important;font-weight:600!important}',
    Te + ' #go3d34{background:rgba(255,255,255,.1)!important;border-color:rgba(255,255,255,.2)!important;color:#fff!important;font-weight:600!important}'
  );
  // o vidro desfocado pesa no celular: lá fica só a transparência
  R.push('@media (min-width:760px) and (hover:hover){' + B + ' [data-tg~=card]' + X + '{' + blur + '}}');
  R.push('@media (max-width:759px),(hover:none){' + E + ' [data-tg~=card]' + X + '{background:rgba(22,26,34,.92)!important}' + C + ' [data-tg~=card]' + X + '{background:rgba(255,255,255,.86)!important}}');
  var st = document.createElement('style'); st.id = 'tg-css'; st.textContent = R.join('\n');
  (document.head || H).appendChild(st);

  // ---------- botão ----------
  var SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  var btn = null;
  function syncBtn() { if (!btn) return; btn.innerHTML = tema === 'claro' ? MOON : SUN; btn.setAttribute('aria-label', tema === 'claro' ? 'Usar tema escuro' : 'Usar tema claro'); btn.title = tema === 'claro' ? 'Tema escuro' : 'Tema claro'; }
  function poeBotao() {
    if (btn && btn.isConnected) return true;
    var top = document.getElementById('top34'); if (!top) return false;
    btn = document.createElement('button'); btn.type = 'button'; btn.id = 'tg-btn'; btn.setAttribute('data-tg', '');
    btn.onclick = function () { tema = tema === 'claro' ? 'escuro' : 'claro'; try { localStorage.setItem(KEY, tema); } catch (e) {} aplica(); };
    var more = document.getElementById('more34');
    if (more && more.parentNode === top) top.insertBefore(btn, more); else top.appendChild(btn);
    syncBtn(); return true;
  }

  function inicia() {
    poeBotao(); varre();
    // elementos novos são anotados na hora (antes de a tela ser pintada), para não piscar o visual antigo
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) { var r = recs[i];
        if (r.type !== 'childList') continue;
        for (var j = 0; j < r.addedNodes.length; j++) { var n = r.addedNodes[j]; if (n.nodeType !== 1) continue;
          try { anota(n); var L = n.querySelectorAll('*:not([data-tg])'); for (var k = 0; k < L.length; k++) anota(L[k]); } catch (e) {} } }
      agenda(); if (!btn || !btn.isConnected) poeBotao(); })
      .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
    addEventListener('resize', agenda);
    document.addEventListener('click', function () { setTimeout(agenda, 60); }, true);
    // o 3D monta os painéis aos poucos: algumas varreduras extras no começo
    [600, 1500, 3000, 6000].forEach(function (ms) { setTimeout(agenda, ms); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicia); else inicia();
  window.__tema3d = { get tema() { return tema; }, set: function (t) { if (t === 'claro' || t === 'escuro') { tema = t; try { localStorage.setItem(KEY, t); } catch (e) {} aplica(); } }, varre: varre };
})();
