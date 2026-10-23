/* Ponte Joinville — cenários da previsão do 3D (V1.59)
   Um cenário = um cronograma-base (as planilhas, em cronogramas3d.js) + a pintura feita à mão naquele cenário.
   · Cenários-base: cada cronograma enviado vira um (o mais novo é o padrão). Os anteriores ficam guardados.
   · Cenários criados no site: "Novo cenário" copia o cenário aberto (mesmo cronograma e mesma pintura) com outro nome;
     dá para renomear e excluir. Ficam na nuvem, iguais no computador e no celular.
   O botão "Cenário" na barra do 3D abre a lista; a escolha fica salva neste aparelho. */
(function () {
  'use strict';
  var PUB = window.__pub58 || null, KEY = 'ponte-cenario-v59';
  var src = window.__cronData59 || { padrao: 'original', bases: [] };
  var user = {}, fns = [], act = null;
  try { act = PUB && PUB.cen ? PUB.cen.id : localStorage.getItem(KEY); } catch (e) {}
  if (PUB && PUB.cen && PUB.cen.user) user[PUB.cen.id] = { nome: PUB.cen.nome, base: PUB.cen.base };
  function baseById(id) { for (var i = 0; i < src.bases.length; i++) if (src.bases[i].id === id) return src.bases[i]; return null; }
  if (!act || (!baseById(act) && !/^u/.test(act))) act = src.padrao;
  function active() { return act; }
  function baseOf(id) { if (baseById(id)) return id; var u = user[id]; return u && baseById(u.base) ? u.base : src.padrao; }
  function name(id) { var b = baseById(id); if (b) return b.nome; var u = user[id]; return u ? u.nome : (PUB && PUB.cen ? PUB.cen.nome : 'Cenário'); }
  function emit() { fns.forEach(function (f) { try { f(act); } catch (e) {} }); ui(); }
  function setActive(id) {
    if (id === act) return; act = id;
    if (!PUB) { try { localStorage.setItem(KEY, id); } catch (e) {} }
    emit();
  }
  function setUser(map) {
    var before = JSON.stringify(user); user = map || {};
    if (!PUB && /^u/.test(act) && !user[act] && window.__pt55 && window.__pt55.synced) { setActive(src.padrao); return; }   // cenário excluído em outro aparelho
    if (JSON.stringify(user) !== before) emit();
  }

  // ---------- botão e painel ----------
  var btn = null, pan = null, edit = null, confirmDel = null;
  function css() {
    if (document.getElementById('cn59-css')) return;
    var s = document.createElement('style'); s.id = 'cn59-css';
    s.textContent = '#pv53-leg .cn59{display:block;margin:-2px 0 6px;color:#FDB900;font-size:11.5px;font-weight:600}' +
      '#cn59-pan{position:fixed;z-index:9999;width:min(360px,calc(100vw - 20px));max-height:min(70vh,560px);overflow:auto;padding:12px 12px 10px;border-radius:12px;background:#11151bf2;border:1px solid #ffffff2a;color:#eef1f5;font:12.5px var(--f34,system-ui);box-shadow:0 14px 40px #000a;backdrop-filter:blur(10px)}#cn59-pan[hidden]{display:none}' +
      '#cn59-pan h4{margin:0 0 2px;font-size:13.5px}#cn59-pan p{margin:0 0 10px;color:#aab3bd;font-size:11.5px;line-height:1.4}#cn59-pan .gr{margin:10px 0 4px;color:#8f99a4;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}' +
      '#cn59-pan .it{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:9px;border:1px solid transparent;cursor:pointer}#cn59-pan .it:hover{background:#ffffff0d}#cn59-pan .it.on{border-color:#FDB900;background:#FDB90014}' +
      '#cn59-pan .it i{flex:none;width:14px;height:14px;border-radius:50%;border:2px solid #8f99a4}#cn59-pan .it.on i{border-color:#FDB900;background:radial-gradient(#FDB900 45%,transparent 50%)}' +
      '#cn59-pan .it span{flex:1;min-width:0}#cn59-pan .it b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#cn59-pan .it small{display:block;color:#9aa4ae;font-size:11px;margin-top:1px}' +
      '#cn59-pan .it button,#cn59-pan .ft button{font:inherit;font-size:11.5px;border:1px solid #ffffff2e;background:#ffffff10;color:#eef1f5;border-radius:7px;padding:4px 8px;cursor:pointer;white-space:nowrap}#cn59-pan button:hover{border-color:#FDB900}#cn59-pan button.dg{border-color:#ef535088;color:#ffb4b0}' +
      '#cn59-pan .ft{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #ffffff1a;align-items:center}#cn59-pan .ft button.ok{background:#FDB900;border-color:#FDB900;color:#151515;font-weight:650}' +
      '#cn59-pan input[type=text]{flex:1;min-width:120px;font:inherit;padding:5px 8px;border-radius:7px;border:1px solid #ffffff33;background:#0b0e12;color:#fff}#cn59-pan select{font:inherit;font-size:11.5px;padding:4px 6px;border-radius:7px;border:1px solid #ffffff33;background:#0b0e12;color:#fff;max-width:170px}' +
      '#cn59-btn b{font-weight:650;color:#FDB900}';
    document.head.append(s);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function br(d) { return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : ''; }
  function pt() { return window.__pt55 || null; }
  function cnt(id) { try { return pt() ? pt().countFor(id) : 0; } catch (e) { return 0; } }
  function pint(n) { return n + (n === 1 ? ' pintada' : ' pintadas'); }
  function mount() {
    var f = document.getElementById('v23-focus'); if (!f || !src.bases.length) return;
    css();
    if (!btn || !btn.isConnected) {
      btn = document.createElement('button'); btn.type = 'button'; btn.id = 'cn59-btn'; btn.className = f.className;
      btn.title = 'Escolher o cenário da previsão (cronograma e pintura)'; btn.setAttribute('aria-haspopup', 'dialog');
      btn.onclick = function (e) { e.stopPropagation(); toggle(); };
      var after = document.getElementById('pc54-btn') || document.getElementById('pv53-btn'); if (!after) return;
      after.after(btn); ui();
    }
  }
  function toggle(v) {
    if (!pan) { pan = document.createElement('div'); pan.id = 'cn59-pan'; pan.hidden = true; pan.setAttribute('role', 'dialog'); pan.setAttribute('aria-label', 'Cenários da previsão'); document.body.append(pan); pan.addEventListener('click', function (e) { e.stopPropagation(); }); }
    pan.hidden = v == null ? !pan.hidden : !v; edit = null; confirmDel = null;
    if (!pan.hidden) { place(); ui(); }
    if (btn) btn.setAttribute('aria-expanded', String(!pan.hidden));
  }
  function place() {
    if (!btn || !pan) return; var r = btn.getBoundingClientRect(), w = Math.min(360, innerWidth - 20);
    pan.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.right - w)) + 'px'; pan.style.top = Math.min(innerHeight - 120, r.bottom + 6) + 'px';
  }
  document.addEventListener('click', function () { if (pan && !pan.hidden) toggle(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pan && !pan.hidden) toggle(false); });
  addEventListener('resize', function () { if (pan && !pan.hidden) place(); });

  function row(id, title, sub) {
    var on = id === act, own = /^u/.test(id) && !PUB;
    var ed = edit === id ? '<input type="text" data-r="' + id + '" value="' + esc(title) + '" maxlength="60" aria-label="Nome do cenário"><button type="button" data-ok="' + id + '">Salvar</button>' :
      '<span><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span>' + (own ? '<button type="button" data-ed="' + id + '" title="Renomear">Renomear</button><button type="button" class="dg" data-del="' + id + '" title="Excluir este cenário">' + (confirmDel === id ? 'Confirmar' : 'Excluir') + '</button>' : '');
    return '<div class="it' + (on ? ' on' : '') + '" data-id="' + id + '" role="radio" aria-checked="' + on + '" tabindex="0"><i></i>' + ed + '</div>';
  }
  function ui() {
    if (btn) { var nm = name(act); btn.innerHTML = (innerWidth < 760 ? 'Cenário' : 'Cenário: <b>' + esc(nm.length > 26 ? nm.slice(0, 25) + '…' : nm) + '</b>'); btn.title = 'Cenário da previsão: ' + nm; }
    if (!pan || pan.hidden) return;
    if (PUB) {
      pan.innerHTML = '<h4>Cenário publicado</h4><p>Este arquivo mostra o cenário "' + esc(name(act)) + '" como estava ao publicar.</p>'; return;
    }
    var h = '<h4>Cenários da previsão</h4><p>Cada cenário usa um cronograma e guarda a sua própria pintura. A escolha fica salva neste aparelho.</p><div class="gr">Cronogramas</div>';
    src.bases.forEach(function (b, i) { var n = cnt(b.id); h += row(b.id, b.nome, (i === 0 ? 'Mais recente · ' : '') + (b.data ? 'recebido em ' + br(b.data) : 'versão anterior') + (n ? ' · ' + pint(n) : '')); });
    var ids = Object.keys(user).sort(function (a, b) { return (user[a].t || 0) - (user[b].t || 0); });
    if (ids.length) { h += '<div class="gr">Criados por você</div>'; ids.forEach(function (id) { var u = user[id], b = baseById(u.base), n = cnt(id); h += row(id, u.nome, 'Cronograma: ' + (b ? b.nome : '—') + (n ? ' · ' + pint(n) : ' · sem pintura')); }); }
    var others = src.bases.map(function (b) { return b.id; }).concat(ids).filter(function (id) { return id !== act && cnt(id) > 0; });
    h += '<div class="ft">' + (edit === '@new' ? '<input type="text" data-new value="' + esc(name(act) + ' · cópia') + '" maxlength="60" aria-label="Nome do novo cenário"><button type="button" class="ok" data-create>Criar</button>' :
      '<button type="button" data-newb title="Novo cenário com o mesmo cronograma e a mesma pintura do cenário aberto">Novo cenário a partir deste</button>') +
      (others.length ? '<small style="flex-basis:100%;color:#9aa4ae;margin-top:4px">Trazer a pintura de outro cenário para este:</small><select data-from aria-label="Cenário de onde trazer a pintura">' + others.map(function (id) { return '<option value="' + id + '">' + esc(name(id)) + ' (' + cnt(id) + ')</option>'; }).join('') + '</select><button type="button" data-copy title="Copia a pintura do cenário escolhido para o cenário aberto">Trazer a pintura</button>' : '') + '</div>';
    pan.innerHTML = h;
    pan.querySelectorAll('.it').forEach(function (el) {
      el.onclick = function (e) { if (e.target.closest('button,input')) return; setActive(el.dataset.id); };
      el.onkeydown = function (e) { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('input')) { e.preventDefault(); setActive(el.dataset.id); } };
    });
    pan.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { edit = b.dataset.ed; confirmDel = null; ui(); var i = pan.querySelector('input[data-r]'); if (i) { i.focus(); i.select(); } }; });
    pan.querySelectorAll('[data-ok]').forEach(function (b) { b.onclick = function () { var i = pan.querySelector('input[data-r]'); if (i && i.value.trim() && pt()) pt().rename(b.dataset.ok, i.value.trim()); edit = null; ui(); }; });
    pan.querySelectorAll('input[data-r]').forEach(function (i) { i.onkeydown = function (e) { if (e.key === 'Enter') pan.querySelector('[data-ok]').click(); if (e.key === 'Escape') { e.stopPropagation(); edit = null; ui(); } }; });
    pan.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () {
      var id = b.dataset.del; if (confirmDel !== id) { confirmDel = id; ui(); return; }
      confirmDel = null; if (pt()) pt().remove(id); if (act === id) setActive(src.padrao); else ui(); }; });
    var nb = pan.querySelector('[data-newb]'); if (nb) nb.onclick = function () { edit = '@new'; ui(); var i = pan.querySelector('input[data-new]'); if (i) { i.focus(); i.select(); } };
    var cr = pan.querySelector('[data-create]'), ni = pan.querySelector('input[data-new]');
    if (cr) cr.onclick = function () { var nm = (ni.value || '').trim(); if (!nm || !pt()) return; var id = pt().create(nm, act, baseOf(act)); edit = null; setActive(id); };
    if (ni) ni.onkeydown = function (e) { if (e.key === 'Enter') cr.click(); if (e.key === 'Escape') { e.stopPropagation(); edit = null; ui(); } };
    var cp = pan.querySelector('[data-copy]'); if (cp) cp.onclick = function () { var from = pan.querySelector('select[data-from]').value; if (pt()) { pt().copyFrom(from); ui(); } };
  }
  setInterval(function () { if (window.__v40 && window.__v40.scene) mount(); }, 600);

  window.__cen59 = {
    active: active, baseOf: baseOf, name: name, setActive: setActive, setUser: setUser,
    on: function (f) { fns.push(f); }, get bases() { return src.bases.map(function (b) { return { id: b.id, nome: b.nome, data: b.data, arquivo: b.arquivo }; }); },
    get user() { return JSON.parse(JSON.stringify(user)); }, get padrao() { return src.padrao; },
    info: function () { var u = user[act]; return { id: act, nome: name(act), base: baseOf(act), user: !!u }; }
  };
})();
