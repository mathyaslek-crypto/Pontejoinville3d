import TERC_SEED from './terceiros-seed.json';   // (V1.86) cadastro inicial dos terceiros
// Ponte Joinville — Worker do site: entrega as páginas e guarda os dados compartilhados entre aparelhos.
// GET /api/state?keys=a,b  → {chave:{t,by,size}} (só metadados); com &full=1 inclui o valor (v)
// PUT /api/state/<chave>    → grava {v,t} se for mais novo que o que está salvo (último a gravar vence)
// O acesso ao site inteiro (inclusive /api) passa pelo login da Cloudflare Access.
// (V1.68) O endereço só do RDO com usuário e senha é outro Worker (rdo-worker.js); aqui fica só a tela que cria os usuários.
import { RDO_URL, USER_RE, SENHA_MIN, hashSenha, lerUsuario, gravarUsuario, apagarUsuario, listarUsuarios, publico, normUser } from './rdo-auth.js';
const KEYS = new Set([
  'ponte-obra-v26',        // 3D: planilha de executados importada
  'aduelas-registros-v2',  // 3D: datas lançadas à mão nas aduelas
  'ponte-rdo-v35',         // 3D: pacotes do RDO importados
  'ponte-prelaje-v48',     // 3D: marcação manual das pré-lajes
  'ponte-plano-v50',       // 3D: cronograma (datas previstas) para planejado × executado
  'ponte-pintura-v55',     // 3D: peças pintadas à mão como previsão (botão "Pintar peças")
  'ponte-cantitravel-v62', // 3D: posição, guindaste e medidas dos dois cantitravels
  'ponte-planejamento-v66', // Planejamento: cenários (data de corte, base, pintura, cantitravels, treliças e aparência)
  'alya-pluvio-v1',        // painel de pluviometria
  'alya-paral-v1',         // painel de paralisações
  'alya-terc-peso-v1'      // Terceiros: peso armado estimado por colaborador por dia (V1.87)
]);
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// tempo atual em Joinville (Open-Meteo, sem chave), guardado em cache por 10 minutos
async function clima() {
  const u = 'https://api.open-meteo.com/v1/forecast?latitude=-26.3045&longitude=-48.8487&current=temperature_2m,weather_code,cloud_cover,precipitation,rain,showers,is_day,wind_speed_10m&timezone=America%2FSao_Paulo';
  try {
    const r = await fetch(u, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!r.ok) return json({ error: 'clima indisponível' }, 502);
    const j = await r.json();
    return new Response(JSON.stringify({ fonte: 'Open-Meteo', local: 'Joinville/SC', current: j.current }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  } catch (e) { return json({ error: 'clima indisponível' }, 502); }
}

// ---------- pasta do RDO (V1.60): os apontadores enviam o RDO finalizado direto para o site ----------
// Cada envio = um item com os arquivos (PDF, pacote do 3D e fotos), guardados no KV:
//   rdo:f:<id>:<n>  arquivo (com nome, tipo e tamanho nos metadados)      rdo:m:<id>  ficha do envio
//   rdo:index       lista de todos os envios (lida pela pasta da página inicial, 3D, pluviometria e paralisações)
// Apontador e perfil completo enviam; perfil completo e equipe leem; só o perfil completo exclui.
const RDO_ID = /^[A-Za-z0-9_.-]{6,140}$/, RDO_MAX = 24 * 1024 * 1024, RDO_VER = '1.95';   // RDO_VER igual ao do rdo.html
const KINDS = new Set(['pdf', 'pacote', 'foto', 'pluvio', 'outro']);
async function rdoIndex(env) {
  let idx = await env.DADOS.get('rdo:index', 'json').catch(() => null);
  if (!idx || !Array.isArray(idx.itens)) idx = { itens: [], chk: 0 };
  // a lista é refeita a partir das fichas de vez em quando (cobre dois envios gravados ao mesmo tempo)
  if (Date.now() - (idx.chk || 0) > 15 * 60e3) {
    const ids = new Set(); let cur;
    do { const r = await env.DADOS.list({ prefix: 'rdo:m:', cursor: cur }); r.keys.forEach(k => ids.add(k.name.slice(6))); cur = r.list_complete ? null : r.cursor; } while (cur);
    const have = new Map(idx.itens.map(e => [e.id, e])), itens = [];
    for (const id of ids) { let e = have.get(id); if (!e) e = await env.DADOS.get('rdo:m:' + id, 'json').catch(() => null); if (e) itens.push(e); }
    itens.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    idx = { itens, chk: Date.now() };
    await env.DADOS.put('rdo:index', JSON.stringify(idx));
  }
  return idx;
}
async function rdoDelete(env, id, meta) {      // apaga os arquivos e a ficha de um envio
  const e = meta || await env.DADOS.get('rdo:m:' + id, 'json').catch(() => null);
  const ns = e && Array.isArray(e.arquivos) ? e.arquivos.map(f => f.n) : null;
  if (ns) { for (const n of ns) await env.DADOS.delete('rdo:f:' + id + ':' + n); }
  else { let cur; do { const r = await env.DADOS.list({ prefix: 'rdo:f:' + id + ':', cursor: cur }); for (const k of r.keys) await env.DADOS.delete(k.name); cur = r.list_complete ? null : r.cursor; } while (cur); }
  await env.DADOS.delete('rdo:m:' + id);
}
// (V1.94) um envio já gravado só pode ser completado/trocado por quem enviou (ou pelo perfil completo)
async function rdoDono(env, id, prof, email) {
  if (prof === 'completo') return true;
  const e = await env.DADOS.get('rdo:m:' + id, 'json').catch(() => null);
  return !e || e.por === email;
}
async function rdoApi(req, env, url, prof, email) {
  const parts = url.pathname.split('/').filter(Boolean);   // ['api','rdo',acao,id?,n?]
  const acao = parts[2], id = parts[3] ? decodeURIComponent(parts[3]) : '', n = parts[4];
  const canSend = prof === 'apontador' || prof === 'completo' || prof === 'equipe-rdo', canRead = prof === 'completo' || prof === 'equipe' || prof === 'equipe-rdo';
  // versão atual do app do RDO: os celulares que estão com a página antiga aberta se atualizam sozinhos
  if (acao === 'versao' && req.method === 'GET') return json({ rdo: RDO_VER });
  // (V1.76) cópia de segurança dos dados do celular (sem as fotos): rdo-bk:<aparelho>, resumo dos dias nos metadados.
  // Quem envia RDO grava e lê as próprias cópias; completo e equipe veem o resumo de todas (painel "Hoje" da Pasta do RDO).
  if (acao === 'backup') {
    const BK = /^[A-Za-z0-9_-]{6,64}$/;
    if (req.method === 'POST') {
      if (!canSend) return json({ error: 'sem acesso' }, 403);
      const txt = await req.text(); if (txt.length > 8e6) return json({ error: 'cópia grande demais' }, 413);
      let b; try { b = JSON.parse(txt); } catch (e) { return json({ error: 'corpo inválido' }, 400); }
      if (!b || !BK.test(String(b.device || '')) || !b.db || typeof b.db !== 'object') return json({ error: 'cópia inválida' }, 400);
      const dias = {}; for (const [d, v] of Object.entries(b.dias || {}).slice(0, 10)) if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dias[d] = { s: String(v && v.s || '').slice(0, 12), a: String(v && v.a || '').slice(0, 80), t: String(v && v.t || '').slice(0, 10), u: String(v && v.u || '').slice(0, 30) };
      const meta = { por: email, autor: String(b.profile || '').slice(0, 80), at: new Date().toISOString(), app: String(b.app || '').slice(0, 30), dias };
      await env.DADOS.put('rdo-bk:' + b.device, JSON.stringify({ meta, db: b.db }), { metadata: meta });
      return json({ ok: true, at: meta.at });
    }
    if (req.method === 'GET') {
      const id = url.searchParams.get('id');
      if (id) {
        if (!BK.test(id)) return json({ error: 'endereço inválido' }, 400);
        const v = await env.DADOS.get('rdo-bk:' + id, 'json').catch(() => null);
        if (!v) return json({ error: 'cópia não encontrada' }, 404);
        if (prof !== 'completo' && v.meta && v.meta.por !== email) return json({ error: 'sem acesso' }, 403);
        return json(v);
      }
      if (!canSend && !canRead) return json({ error: 'sem acesso' }, 403);
      const itens = []; let cur;
      do { const r = await env.DADOS.list({ prefix: 'rdo-bk:', cursor: cur }); r.keys.forEach(k => { const m = k.metadata || {}; if (canRead || m.por === email) itens.push({ id: k.name.slice(7), ...m, minha: m.por === email }); }); cur = r.list_complete ? null : r.cursor; } while (cur);
      itens.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      return json({ itens });
    }
    return json({ error: 'método não permitido' }, 405);
  }
  // (V1.76) pedido de correção de um RDO enviado (só o perfil completo pede); o app do RDO mostra o pedido no dia
  if (acao === 'correcao' && (req.method === 'POST' || req.method === 'DELETE')) {
    if (prof !== 'completo') return json({ error: 'só o perfil completo pede correção' }, 403);
    if (!RDO_ID.test(id)) return json({ error: 'endereço inválido' }, 400);
    const e = await env.DADOS.get('rdo:m:' + id, 'json').catch(() => null);
    if (!e) return json({ error: 'RDO não encontrado' }, 404);
    if (req.method === 'POST') {
      let b; try { b = await req.json(); } catch (x) { return json({ error: 'corpo inválido' }, 400); }
      const msg = String(b && b.msg || '').trim().slice(0, 500); if (!msg) return json({ error: 'escreva o que precisa corrigir' }, 400);
      e.correcao = { msg, at: new Date().toISOString(), por: email };
    } else delete e.correcao;
    await env.DADOS.put('rdo:m:' + id, JSON.stringify(e));
    const idx = await rdoIndex(env); idx.itens = idx.itens.map(x => x.id === id ? e : x); await env.DADOS.put('rdo:index', JSON.stringify(idx));
    return json({ ok: true, item: e });
  }
  if (acao === 'correcoes' && req.method === 'GET') {
    if (!canSend && !canRead) return json({ error: 'sem acesso' }, 403);
    const idx = await rdoIndex(env);
    return json({ itens: idx.itens.filter(x => x.correcao).map(x => ({ id: x.id, data: x.data, autor: x.autor, turno: x.turno, rev: x.rev, msg: x.correcao.msg, at: x.correcao.at })) });
  }
  // (V1.69) equipamentos e ativos cadastrados pelos apontadores no RDO (a lista da planilha fica no próprio rdo.html).
  // Um registro por ativo: rdo-at:<equipamento normalizado>|<ativo> (ativo vazio = equipamento sem ativo), dados nos metadados.
  if (acao === 'ativos') {
    const eqKey = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (req.method === 'GET') {
      if (!canSend && !canRead) return json({ error: 'sem acesso' }, 403);
      const itens = []; let cur;
      do { const r = await env.DADOS.list({ prefix: 'rdo-at:', cursor: cur }); r.keys.forEach(k => { const m = k.metadata || {}; if (m.e) itens.push({ e: m.e, a: m.a || '', por: m.por || '', at: m.at || '' }); }); cur = r.list_complete ? null : r.cursor; } while (cur);
      return json({ itens });
    }
    if (req.method !== 'POST' && req.method !== 'DELETE') return json({ error: 'método não permitido' }, 405);
    if (!canSend) return json({ error: 'sem acesso' }, 403);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'corpo inválido' }, 400); }
    const e = String(b && b.e || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60), ek = eqKey(e);
    const a = req.method === 'DELETE' && b.a === '*' ? '*' : String(b && b.a || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 30);
    if (!ek) return json({ error: 'equipamento inválido' }, 400);
    if (req.method === 'POST') {
      await env.DADOS.put('rdo-at:' + ek + '|' + a, '1', { metadata: { e, a, por: email, at: new Date().toISOString() } });
      return json({ ok: true });
    }
    if (a === '*') { let cur; do { const r = await env.DADOS.list({ prefix: 'rdo-at:' + ek + '|', cursor: cur }); for (const k of r.keys) await env.DADOS.delete(k.name); cur = r.list_complete ? null : r.cursor; } while (cur); }
    else await env.DADOS.delete('rdo-at:' + ek + '|' + a);
    return json({ ok: true });
  }
  // (V1.86) Terceiros: cadastro único de colaboradores das empresas terceiras, compartilhado por todos os apontadores.
  //   KV 'rdo-terc-v1' = { seq: { SPT: 12 }, p: { 'SPT-0001': { m, nome, funcao, emp, enc, turno, ativo, criado, alterado, por } } }
  //   A matrícula é criada aqui (sigla da empresa + número) e nunca muda. enc = matrícula do encarregado ('' = sem encarregado).
  if (acao === 'terceiros') {
    const EMPS = ['SPT', 'BML', 'BSM', 'BRG'];
    // começa com a equipe da S.Pontes da planilha de 04/11/2026 (terceiros-seed.json, fora dos arquivos públicos)
    // (04/11) planilhas novas entram no cadastro que já existe: quem ainda não está (pela empresa + nome) é acrescentado,
    // com a matrícula da planilha se estiver livre (senão a próxima da empresa); nada que já foi editado é mexido.
    const nk = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const ler = async () => {
      const db = (await env.DADOS.get('rdo-terc-v1', 'json').catch(() => null)) || { seq: {}, p: {} };
      const tem = new Set(Object.values(db.p).map(q => q.sid || (q.emp + '|' + nk(q.nome)))), mapa = {};
      let mudou = false;
      const seeds = Object.values(TERC_SEED.p).sort((a, b) => (a.funcao === 'ENCARREGADO' || a.lider ? 0 : 1) - (b.funcao === 'ENCARREGADO' || b.lider ? 0 : 1));
      for (const q of seeds) {
        const sid = q.sid || (q.emp + '|' + nk(q.nome));
        if (tem.has(sid)) { const ja = Object.values(db.p).find(x => (x.sid || (x.emp + '|' + nk(x.nome))) === sid); if (ja) mapa[q.m] = ja.m; continue; }
        let m = q.m;
        if (db.p[m]) { db.seq[q.emp] = Math.max(db.seq[q.emp] || 0, TERC_SEED.seq[q.emp] || 0) + 1; m = q.emp + '-' + String(db.seq[q.emp]).padStart(4, '0'); }
        db.p[m] = Object.assign({}, q, { m, sid, enc: q.enc ? (mapa[q.enc] || q.enc) : '' }); mapa[q.m] = m; tem.add(sid); mudou = true;
      }
      for (const [e, n] of Object.entries(TERC_SEED.seq)) if ((db.seq[e] || 0) < n) { db.seq[e] = n; mudou = true; }
      // correções únicas (guardadas em db.fix): 04/11 · Matheus Maciel Lourenço é o encarregado da BML (função caldeireiro jr II)
      db.fix = db.fix || {};
      if (!db.fix.bml1) {
        const mt = Object.values(db.p).find(x => x.emp === 'BML' && nk(x.nome) === 'matheus maciel lourenco');
        if (mt) { mt.lider = true; mt.enc = ''; for (const x of Object.values(db.p)) if (x.emp === 'BML' && x.m !== mt.m && !x.enc) x.enc = mt.m; }
        db.fix.bml1 = new Date().toISOString(); mudou = true;
      }
      if (mudou) await env.DADOS.put('rdo-terc-v1', JSON.stringify(db));
      return db;
    };
    if (req.method === 'GET') {
      if (!canSend && !canRead) return json({ error: 'sem acesso' }, 403);
      return json(Object.assign(await ler(), { pode: prof === 'completo' }));
    }
    if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);
    if (!canSend) return json({ error: 'sem acesso' }, 403);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'corpo inválido' }, 400); }
    const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
    const db = await ler(), now = new Date().toISOString();
    const limpa = (o, base) => {
      const r = Object.assign({}, base);
      if (o.nome != null) r.nome = txt(o.nome, 80);
      if (o.funcao != null) r.funcao = txt(o.funcao, 40).toUpperCase();
      if (o.enc != null) { const e = txt(o.enc, 20); r.enc = e && db.p[e] && db.p[e].emp === r.emp ? e : ''; }
      if (o.turno != null) r.turno = o.turno === 'noite' ? 'noite' : 'dia';
      if (o.ativo != null) r.ativo = !!o.ativo;
      if (o.lider != null) r.lider = !!o.lider;
      if (/ENCARREG/.test(r.funcao || '')) r.lider = true;
      return r;
    };
    const novo = o => {
      const emp = EMPS.includes(o.emp) ? o.emp : null; if (!emp) throw new Error('empresa inválida');
      const nome = txt(o.nome, 80); if (nome.length < 3) throw new Error('nome inválido');
      db.seq[emp] = (db.seq[emp] || 0) + 1;
      const m = emp + '-' + String(db.seq[emp]).padStart(4, '0');
      db.p[m] = limpa(o, { m, emp, nome, funcao: 'AJUDANTE', enc: '', turno: 'dia', ativo: true, criado: now, alterado: now, por: email });
      return m;
    };
    let mat = '';
    try {
      if (b.op === 'add') mat = novo(b);
      else if (b.op === 'upd') {
        const cur = db.p[txt(b.m, 20)]; if (!cur) return json({ error: 'colaborador não encontrado' }, 404);
        db.p[cur.m] = Object.assign(limpa(b, cur), { alterado: now, por: email }); mat = cur.m;
        if (db.p[mat].enc === mat) db.p[mat].enc = '';
      } else if (['del', 'unir', 'rest'].includes(b.op)) {
        // (V1.93) só o perfil completo, pelo painel de Terceiros: excluir (fica desligado, marcado como excluído),
        // unir um cadastro duplicado a outro (os dias do duplicado passam a contar no certo) e restaurar
        if (prof !== 'completo') return json({ error: 'só o perfil completo' }, 403);
        const cur = db.p[txt(b.m, 20)]; if (!cur) return json({ error: 'colaborador não encontrado' }, 404);
        if (b.op === 'del') Object.assign(cur, { ativo: false, excluido: now, alterado: now, por: email });
        else if (b.op === 'rest') { cur.ativo = true; delete cur.excluido; delete cur.uniu; Object.assign(cur, { alterado: now, por: email }); }
        else {
          const alvo = db.p[txt(b.para, 20)];
          if (!alvo || alvo.m === cur.m || alvo.emp !== cur.emp || alvo.uniu) return json({ error: 'escolha outro colaborador da mesma empresa' }, 400);
          Object.assign(cur, { ativo: false, uniu: alvo.m, alterado: now, por: email });
          for (const x of Object.values(db.p)) { if (x.uniu === cur.m) x.uniu = alvo.m; if (x.enc === cur.m) x.enc = alvo.m; }
        }
        mat = cur.m;
      } else if (b.op === 'import' && prof === 'completo' && Array.isArray(b.itens)) {
        // planilha: primeiro os encarregados (para ligar a equipe pelo nome), depois os demais
        const key = s => txt(s, 80).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const its = b.itens.slice(0, 2000), enc = {};
        for (const o of its.filter(o => /encarreg/i.test(o.funcao || ''))) { const m = novo(Object.assign({}, o, { enc: '' })); enc[o.emp + '|' + key(o.nome)] = m; }
        for (const o of its.filter(o => !/encarreg/i.test(o.funcao || ''))) novo(Object.assign({}, o, { enc: enc[o.emp + '|' + key(o.encNome)] || '' }));
      } else return json({ error: 'operação inválida' }, 400);
    } catch (e) { return json({ error: e.message || 'dados inválidos' }, 400); }
    await env.DADOS.put('rdo-terc-v1', JSON.stringify(db));
    return json(Object.assign({ ok: true, m: mat }, db));
  }
  if (acao === 'arquivo' && req.method === 'PUT') {
    if (!canSend) return json({ error: 'sem acesso' }, 403);
    if (!RDO_ID.test(id) || !/^\d{1,3}$/.test(n || '')) return json({ error: 'endereço inválido' }, 400);
    if (!(await rdoDono(env, id, prof, email))) return json({ error: 'este envio é de outra pessoa' }, 403);
    const body = await req.arrayBuffer();
    if (!body.byteLength || body.byteLength > RDO_MAX) return json({ error: 'arquivo vazio ou grande demais' }, 413);
    let nome = ''; try { nome = decodeURIComponent(req.headers.get('x-nome') || ''); } catch (e) {}
    nome = nome.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 160) || ('arquivo_' + n);
    const tipo = (req.headers.get('content-type') || 'application/octet-stream').split(';')[0].slice(0, 80);
    await env.DADOS.put('rdo:f:' + id + ':' + n, body, { metadata: { nome, tipo, tam: body.byteLength } });
    return json({ ok: true, tam: body.byteLength });
  }
  if (acao === 'fim' && req.method === 'POST') {
    if (!canSend) return json({ error: 'sem acesso' }, 403);
    if (!RDO_ID.test(id)) return json({ error: 'endereço inválido' }, 400);
    if (!(await rdoDono(env, id, prof, email))) return json({ error: 'este envio é de outra pessoa' }, 403);
    let b; try { b = await req.json(); } catch (e) { return json({ error: 'corpo inválido' }, 400); }
    const arquivos = [];
    for (const f of (Array.isArray(b.arquivos) ? b.arquivos : []).slice(0, 200)) {
      const k = 'rdo:f:' + id + ':' + (+f.n);
      const m = await env.DADOS.getWithMetadata(k, 'stream'); if (!m || m.value == null) return json({ error: 'arquivo ' + f.n + ' não chegou' }, 409);
      try { m.value.cancel(); } catch (e) {}
      arquivos.push({ n: +f.n, nome: (m.metadata && m.metadata.nome) || String(f.nome || ''), tipo: (m.metadata && m.metadata.tipo) || '', tam: (m.metadata && m.metadata.tam) || 0, kind: KINDS.has(f.kind) ? f.kind : 'outro' });
    }
    if (!arquivos.length) return json({ error: 'nenhum arquivo' }, 400);
    const s = v => String(v == null ? '' : v).slice(0, 120);
    const e = { id, data: /^\d{4}-\d{2}-\d{2}$/.test(b.data) ? b.data : '', autor: s(b.autor), turno: s(b.turno), rev: Number.isFinite(+b.rev) ? +b.rev : null, app: s(b.app), por: email, at: new Date().toISOString(), arquivos };
    await env.DADOS.put('rdo:m:' + id, JSON.stringify(e));
    const idx = await rdoIndex(env);
    // mesmo dia, apontador, turno e revisão enviados de novo: fica só o envio mais novo (não duplica a pasta)
    const dup = idx.itens.filter(x => x.id !== id && e.rev != null && x.rev === e.rev && x.data === e.data && x.turno === e.turno && x.autor === e.autor && (x.por === email || prof === 'completo'));   // (V1.94) só apaga envio da mesma pessoa
    for (const x of dup) await rdoDelete(env, x.id);
    const gone = new Set(dup.map(x => x.id));
    idx.itens = [e].concat(idx.itens.filter(x => x.id !== id && !gone.has(x.id)));
    await env.DADOS.put('rdo:index', JSON.stringify(idx));
    return json({ ok: true, item: e, substituidos: dup.length });
  }
  if (acao === 'lista' && req.method === 'GET') {
    if (!canRead) return json({ error: 'sem acesso' }, 403);
    const idx = await rdoIndex(env);
    return json({ itens: idx.itens, podeExcluir: prof === 'completo', voce: email });   // (V1.84) quem entrou, para a pasta avisar quando não é o perfil completo
  }
  if (acao === 'arquivo' && req.method === 'GET') {
    if (!canRead) return json({ error: 'sem acesso' }, 403);
    if (!RDO_ID.test(id) || !/^\d{1,3}$/.test(n || '')) return json({ error: 'endereço inválido' }, 400);
    const m = await env.DADOS.getWithMetadata('rdo:f:' + id + ':' + n, 'stream');
    if (!m || m.value == null) return json({ error: 'arquivo não encontrado' }, 404);
    const md = m.metadata || {}, nome = md.nome || 'arquivo';
    // só PDF, foto e texto abrem no navegador; qualquer outro tipo é baixado (nada enviado roda como página do site)
    const safe = /^(application\/pdf|image\/(jpeg|png|webp)|text\/plain)$/.test(md.tipo || ''), baixar = url.searchParams.get('baixar') === '1' || !safe;
    const tipo = safe ? (md.tipo === 'text/plain' ? 'text/plain; charset=utf-8' : md.tipo) : 'application/octet-stream';
    return new Response(m.value, { headers: { 'content-type': tipo, 'content-disposition': (baixar ? 'attachment' : 'inline') + "; filename*=UTF-8''" + encodeURIComponent(nome), 'cache-control': 'private, max-age=86400', 'x-content-type-options': 'nosniff' } });
  }
  if (acao === 'item' && req.method === 'DELETE') {
    if (prof !== 'completo') return json({ error: 'só o perfil completo pode excluir' }, 403);
    if (!RDO_ID.test(id)) return json({ error: 'endereço inválido' }, 400);
    const e = await env.DADOS.get('rdo:m:' + id, 'json').catch(() => null);
    await rdoDelete(env, id, e);
    const idx = await rdoIndex(env); idx.itens = idx.itens.filter(x => x.id !== id); await env.DADOS.put('rdo:index', JSON.stringify(idx));
    return json({ ok: true, removido: !!e });
  }
  return json({ error: 'rota desconhecida' }, 404);
}

// ---------- usuários do RDO com senha (V1.68): só o perfil completo cria, troca senha, bloqueia e exclui ----------
async function usuariosApi(req, env, url) {
  if (!env.DADOS) return json({ error: 'armazenamento não configurado' }, 503);
  const o = req.headers.get('origin');
  if (o && o !== url.origin) return json({ error: 'origem não permitida' }, 403);
  const parts = url.pathname.split('/').filter(Boolean);   // ['api','rdo-usuarios',usuario?]
  const nome = parts[2] ? normUser(decodeURIComponent(parts[2])) : '', m = req.method, agora = new Date().toISOString();
  const corpo = async () => { if (!/json/.test(req.headers.get('content-type') || '')) return null; try { return await req.json(); } catch (e) { return null; } };
  const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const okEmail = e => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  if (m === 'GET' && !nome) return json({ endereco: RDO_URL, usuarios: (await listarUsuarios(env)).map(([n, u]) => publico(n, u)) });
  if (m === 'POST' && !nome) {
    const b = await corpo(); if (!b) return json({ error: 'corpo inválido' }, 400);
    const n = normUser(b.usuario), senha = String(b.senha || ''), email = txt(b.email, 120).toLowerCase();
    if (!USER_RE.test(n)) return json({ error: 'Usuário: 3 a 32 letras minúsculas, números, ponto, traço ou sublinhado, sem espaço nem acento' }, 400);
    if (senha.length < SENHA_MIN || senha.length > 200) return json({ error: 'A senha precisa ter pelo menos ' + SENHA_MIN + ' caracteres' }, 400);
    if (!okEmail(email)) return json({ error: 'E-mail inválido' }, 400);
    if (await lerUsuario(env, n)) return json({ error: 'Já existe um usuário "' + n + '"' }, 409);
    const u = { nome: txt(b.nome, 80), email, ...(await hashSenha(senha)), ativo: true, v: 0, criado: agora, alterado: agora, ultimo: '', falhas: 0, bloq: 0 };
    await gravarUsuario(env, n, u);
    return json({ ok: true, usuario: publico(n, u) });
  }
  if (!nome || !USER_RE.test(nome)) return json({ error: 'usuário inválido' }, 400);
  const u = await lerUsuario(env, nome);
  if (!u) return json({ error: 'usuário não encontrado' }, 404);
  if (m === 'PATCH') {
    const b = await corpo(); if (!b) return json({ error: 'corpo inválido' }, 400);
    if (b.nome != null) u.nome = txt(b.nome, 80);
    if (b.email != null) { const e = txt(b.email, 120).toLowerCase(); if (!okEmail(e)) return json({ error: 'E-mail inválido' }, 400); u.email = e; }
    if (b.senha != null) {
      const s = String(b.senha);
      if (s.length < SENHA_MIN || s.length > 200) return json({ error: 'A senha precisa ter pelo menos ' + SENHA_MIN + ' caracteres' }, 400);
      Object.assign(u, await hashSenha(s)); u.v = (u.v || 0) + 1; u.falhas = 0; u.bloq = 0;        // senha nova derruba as sessões abertas
    }
    if (b.ativo != null) { const at = !!b.ativo; if (!at && u.ativo !== false) u.v = (u.v || 0) + 1; u.ativo = at; if (at) { u.falhas = 0; u.bloq = 0; } }
    if (b.desbloquear) { u.falhas = 0; u.bloq = 0; }
    u.alterado = agora;
    await gravarUsuario(env, nome, u);
    return json({ ok: true, usuario: publico(nome, u) });
  }
  if (m === 'DELETE') { await apagarUsuario(env, nome); return json({ ok: true }); }
  return json({ error: 'método não permitido' }, 405);
}

async function api(req, env, url, prof, email) {
  if (!env.DADOS) return json({ error: 'armazenamento não configurado' }, 503);
  const parts = url.pathname.split('/').filter(Boolean); // ['api','state',key?]
  if (parts[1] === 'clima' && req.method === 'GET') return clima();
  if (parts[1] === 'pav') return pavApi(req, env, prof, email);
  if (parts[1] !== 'state') return json({ error: 'rota desconhecida' }, 404);
  if (req.method === 'GET' && parts.length === 2) {
    const keys = (url.searchParams.get('keys') || '').split(',').filter(k => KEYS.has(k));
    const full = url.searchParams.get('full') === '1', out = {};
    await Promise.all(keys.map(async k => {
      const m = await env.DADOS.get('meta:' + k, 'json');
      if (!m) return;
      out[k] = m;
      if (full) { const v = await env.DADOS.get('state:' + k, 'text'); if (v != null) out[k].v = v; }
    }));
    return json(out);
  }
  if (req.method === 'PUT' && parts.length === 3) {
    const key = decodeURIComponent(parts[2]);
    if (!KEYS.has(key)) return json({ error: 'chave não permitida' }, 400);
    let body; try { body = await req.json(); } catch (e) { return json({ error: 'corpo inválido' }, 400); }
    if (typeof body.v !== 'string' || typeof body.t !== 'number') return json({ error: 'corpo inválido' }, 400);
    if (body.v.length > 20e6) return json({ error: 'dados grandes demais' }, 413);
    const cur = await env.DADOS.get('meta:' + key, 'json').catch(() => null);
    if (cur && cur.t > body.t) return json({ ok: false, newer: cur }, 409);
    const meta = { t: body.t, by: email || '', size: body.v.length };
    await env.DADOS.put('state:' + key, body.v);
    await env.DADOS.put('meta:' + key, JSON.stringify(meta));
    return json({ ok: true, meta });
  }
  return json({ error: 'método não permitido' }, 405);
}

// ---------- pavimentação do Boa Vista (V1.91) ----------
// Lançamentos de avanço por camada: {id,rua,cam,ini,fim,lado:'E'|'D'|'A',data,obs,by,at} guardados em pav-v1.
// Todos com acesso ao 3D leem; só o perfil completo lança, altera e exclui.
const PAV_RUAS = new Set(['sb', 'sl', 'to', 'co', 'in', 'bw', 'pa', 'df', 'r1']), PAV_CAM = new Set(['leito', 'sub', 'base', 'cbuqb', 'cbuqc']);
function pavItem(o) {
  const ini = +o.ini, fim = +o.fim;
  if (!PAV_RUAS.has(o.rua) || !PAV_CAM.has(o.cam) || !['E', 'D', 'A'].includes(o.lado)) return null;
  if (!isFinite(ini) || !isFinite(fim) || ini < 0 || fim > 5000 || fim - ini < 0.5) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(o.data || ''))) return null;
  return { rua: o.rua, cam: o.cam, ini: Math.round(ini * 100) / 100, fim: Math.round(fim * 100) / 100, lado: o.lado, data: o.data, obs: String(o.obs || '').slice(0, 300) };
}
async function pavApi(req, env, prof, email) {
  const cur = (await env.DADOS.get('pav-v1', 'json').catch(() => null)) || { seq: 0, itens: [] };
  if (req.method === 'GET') return json({ itens: cur.itens, pode: prof === 'completo' });
  if (req.method !== 'POST') return json({ error: 'método' }, 405);
  if (prof !== 'completo') return json({ error: 'só o perfil completo lança a pavimentação' }, 403);
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'corpo inválido' }, 400); }
  const now = new Date().toISOString();
  if (b.op === 'add' || b.op === 'upd') {
    const it = pavItem(b.it || {}); if (!it) return json({ error: 'lançamento inválido' }, 400);
    if (b.op === 'add') cur.itens.push({ id: 'p' + (++cur.seq), ...it, by: email, at: now });
    else { const i = cur.itens.findIndex(x => x.id === b.id); if (i < 0) return json({ error: 'não encontrado' }, 404); cur.itens[i] = { ...cur.itens[i], ...it, by: email, at: now }; }
  } else if (b.op === 'del') {
    const n = cur.itens.length; cur.itens = cur.itens.filter(x => x.id !== b.id); if (cur.itens.length === n) return json({ error: 'não encontrado' }, 404);
  } else return json({ error: 'operação desconhecida' }, 400);
  await env.DADOS.put('pav-v1', JSON.stringify(cur));
  return json({ ok: true, itens: cur.itens, pode: true });
}

// ---------- quem pode ver o quê ----------
// Login continua na Cloudflare Access (código no e-mail). Aqui o Worker lê o e-mail do token assinado pela Access
// e libera as páginas por perfil:
//   completo  → tudo (início, 3D, pluviometria, paralisações, mão de obra, pavimentação e RDO); só ele lança a pavimentação
//   apontador → só o RDO (qualquer outro endereço volta para o RDO)
//   equipe    → início, 3D, pluviometria, paralisações, mão de obra e pavimentação só para ver (sem o RDO)
//   equipe-rdo → o mesmo da equipe e também o RDO (abre e envia; não exclui nada da pasta)
const FULL = new Set(['mathyaslek@gmail.com']);
const RDO_ONLY = new Set(['kailane.costa@alyaconstrutora.com', 'joao.psimoes@alyaconstrutora.com', 'anderson.silva@alyaconstrutora.com',
  'kailanesilva.c@outlook.com', 'testealya@gmail.com', 'joao0306091@outlook.com']);   // 28/10: e-mails pessoais, só o RDO
// equipe + RDO (31/10): vê o mesmo que a equipe e também abre e envia o RDO (não exclui nada da pasta)
const EQUIPE_RDO = new Set(['mathias.oliveira@alyaconstrutora.com']);
const isRdo = p => p === '/rdo' || p === '/rdo.html' || p === '/rdo/';

const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let certCache = { iss: '', at: 0, keys: [] };
// (V1.94) segurança: o token precisa ter validade (exp) e ser do MESMO time da Cloudflare Access do site. O time fica fixo
// em ACCESS_ISS (variável do Worker, se configurada) ou é gravado no KV no primeiro login válido depois desta versão
// ('access-iss-v1'); tokens de qualquer outro time *.cloudflareaccess.com são recusados.
let issPin = null;
async function issOk(env, iss) {
  if (env && env.ACCESS_ISS) return iss === String(env.ACCESS_ISS).replace(/\/+$/, '');
  if (!env || !env.DADOS) return false;
  if (!issPin) issPin = await env.DADOS.get('access-iss-v1').catch(() => null);
  if (!issPin) { issPin = iss; await env.DADOS.put('access-iss-v1', iss); return true; }
  return iss === issPin;
}
async function verifiedEmail(req, env) {
  const jwt = req.headers.get('cf-access-jwt-assertion');
  if (!jwt) return null;
  const [h, p, sig] = jwt.split('.');
  if (!sig) return null;
  let head, pay;
  try { head = JSON.parse(new TextDecoder().decode(b64u(h))); pay = JSON.parse(new TextDecoder().decode(b64u(p))); } catch (e) { return null; }
  const iss = String(pay.iss || '');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(iss)) return null;
  if (!pay.exp || pay.exp * 1000 < Date.now() - 60e3) return null;
  if (pay.nbf && pay.nbf * 1000 > Date.now() + 60e3) return null;
  if (head.alg !== 'RS256') return null;
  if (certCache.iss !== iss || Date.now() - certCache.at > 3600e3) {
    const r = await fetch(iss + '/cdn-cgi/access/certs');
    if (!r.ok) return null;
    certCache = { iss, at: Date.now(), keys: (await r.json()).keys || [] };
  }
  const jwk = certCache.keys.find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(sig), new TextEncoder().encode(h + '.' + p));
  if (!ok || !(await issOk(env, iss))) return null;
  return String(pay.email || '').toLowerCase() || null;
}
function profileOf(email) { return FULL.has(email) ? 'completo' : RDO_ONLY.has(email) ? 'apontador' : EQUIPE_RDO.has(email) ? 'equipe-rdo' : 'equipe'; }
function blocked(msg, link, label) {
  return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso restrito · Ponte Joinville</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111215;color:#eceae5;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px}main{max-width:420px;padding:28px;border:1px solid #c7c4bc22;border-radius:12px;background:#17181c}h1{margin:0 0 8px;font-size:19px;color:#fff}p{margin:0 0 18px;color:#b9b6ae}a{display:inline-block;padding:10px 16px;border-radius:8px;background:#FDB900;color:#151515;font-weight:600;text-decoration:none}</style></head><body><main><h1>Acesso restrito</h1><p>${msg}</p>${link ? `<a href="${link}">${label}</a>` : ''}</main></body></html>`, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

// ---------- tela de carregamento (loader da Uiverse, by dexter-st) ----------
// Entra logo depois do <title> de toda página HTML, antes dos scripts grandes: o navegador já pinta a tela de carregamento
// em vez de continuar mostrando a página anterior; some quando a página termina de carregar.
const LOADER_HTML = `<style id="ldr-css">#ldr{position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;background:#0b0d10;transition:opacity .45s ease}#ldr.out{opacity:0;pointer-events:none}#ldr p{margin:0;font:500 12px/1 system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#8e8b84}
.loader-wrapper{position:relative;display:flex;align-items:center;justify-content:center;width:180px;height:180px;font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:1.2em;font-weight:300;color:white;border-radius:50%;background-color:transparent;user-select:none}
.loader{position:absolute;top:0;left:0;width:100%;aspect-ratio:1/1;border-radius:50%;background-color:transparent;animation:loader-rotate 2s linear infinite;z-index:0}
@keyframes loader-rotate{0%{transform:rotate(90deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 30px 0 #FFD45C inset,0 60px 60px 0 #C98500 inset}50%{transform:rotate(270deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 10px 0 #FDB900 inset,0 40px 60px 0 #6B4A00 inset}100%{transform:rotate(450deg);box-shadow:0 10px 20px 0 #fff inset,0 20px 30px 0 #FFD45C inset,0 60px 60px 0 #C98500 inset}}
.loader-letter{display:inline-block;opacity:.4;transform:translateY(0);animation:loader-letter-anim 2s infinite;z-index:1;border-radius:50ch;border:none}
.loader-letter:nth-child(1){animation-delay:0s}.loader-letter:nth-child(2){animation-delay:.1s}.loader-letter:nth-child(3){animation-delay:.2s}.loader-letter:nth-child(4){animation-delay:.3s}.loader-letter:nth-child(5){animation-delay:.4s}.loader-letter:nth-child(6){animation-delay:.5s}.loader-letter:nth-child(7){animation-delay:.6s}.loader-letter:nth-child(8){animation-delay:.7s}.loader-letter:nth-child(9){animation-delay:.8s}.loader-letter:nth-child(10){animation-delay:.9s}
@keyframes loader-letter-anim{0%,100%{opacity:.4;transform:translateY(0)}20%{opacity:1;transform:scale(1.15)}40%{opacity:.7;transform:translateY(0)}}</style><div id="ldr" role="status" aria-label="Carregando"><div class="loader-wrapper">${[...'Carregando'].map(c => `<span class="loader-letter">${c}</span>`).join('')}<div class="loader"></div></div><p>Ponte Joinville</p></div><script>(function(){var d=document.getElementById('ldr'),t0=Date.now(),done=0;function hide(){if(done)return;done=1;setTimeout(function(){d.classList.add('out');setTimeout(function(){d.remove();var c=document.getElementById('ldr-css');c&&c.remove();},500);},Math.max(0,500-(Date.now()-t0)));}if(document.readyState==='complete')hide();else addEventListener('load',hide);setTimeout(hide,40000);})();</script>`;
// ---------- controle de setas do 3D no estilo "liquid glass" (inspirado no botão da Uiverse, by shokat_2650) ----------
// Só muda a aparência do #pad50 (criado pelo 3D); seletores com "html body" vencem o estilo original sem tocar no 3d.html.
const PAD_CSS = `<style id="pad-glass">
/* caixa que aparecia ao passar o mouse sobre a peça: substituída pela ficha completa ao clicar */
#av-tip{display:none!important}
@property --pg-a1{syntax:"<angle>";inherits:false;initial-value:-75deg}
@property --pg-a2{syntax:"<angle>";inherits:false;initial-value:-45deg}
html body #pad50#pad50{gap:10px;filter:drop-shadow(0 10px 18px rgba(0,0,0,.35))}
html body #pad50#pad50 .dp,html body #pad50#pad50 .side{gap:6px;padding:8px;border-radius:26px;background:linear-gradient(-75deg,rgba(20,24,30,.28),rgba(255,255,255,.12),rgba(20,24,30,.28));border:0;box-shadow:inset 0 .125em .125em rgba(0,0,0,.08),inset 0 -.125em .125em rgba(255,255,255,.22),0 0 .1em .25em inset rgba(255,255,255,.08),0 .4em .6em -.2em rgba(0,0,0,.45);backdrop-filter:blur(10px) saturate(150%);-webkit-backdrop-filter:blur(10px) saturate(150%);position:relative}
html body #pad50#pad50 .dp{border-radius:50%;padding:10px}
html body #pad50#pad50 button{position:relative;border-radius:999px;border:0!important;color:#fff!important;font-weight:600;background:linear-gradient(-75deg,rgba(255,255,255,.1),rgba(255,255,255,.3),rgba(255,255,255,.1))!important;box-shadow:inset 0 .125em .125em rgba(0,0,0,.05),inset 0 -.125em .125em rgba(255,255,255,.45),0 .25em .125em -.125em rgba(0,0,0,.35),0 0 .1em .25em inset rgba(255,255,255,.18)!important;backdrop-filter:blur(3px)!important;-webkit-backdrop-filter:blur(3px)!important;text-shadow:0 .1em .15em rgba(0,0,0,.45);transition:transform .4s cubic-bezier(.25,1,.5,1),box-shadow .4s cubic-bezier(.25,1,.5,1),background .3s,color .3s;-webkit-tap-highlight-color:transparent;overflow:visible}
html body #pad50#pad50 button::after{content:"";position:absolute;inset:-.5px;border-radius:999px;padding:1px;pointer-events:none;background:conic-gradient(from var(--pg-a1) at 50% 50%,rgba(0,0,0,.32),rgba(0,0,0,0) 5% 40%,rgba(0,0,0,.32) 50%,rgba(0,0,0,0) 60% 95%,rgba(0,0,0,.32)),linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,.5));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);transition:--pg-a1 .5s ease}
html body #pad50#pad50 button::before{content:"";position:absolute;inset:1px;border-radius:999px;pointer-events:none;mix-blend-mode:screen;background:linear-gradient(var(--pg-a2),rgba(255,255,255,0) 0%,rgba(255,255,255,.45) 40% 50%,rgba(255,255,255,0) 55%);background-size:200% 200%;background-position:0% 50%;background-repeat:no-repeat;transition:background-position .5s cubic-bezier(.25,1,.5,1),--pg-a2 .5s cubic-bezier(.25,1,.5,1)}
html body #pad50#pad50 button:hover{transform:scale(.975);background:linear-gradient(-75deg,rgba(255,255,255,.08),rgba(255,255,255,.26),rgba(255,255,255,.08))!important}
html body #pad50#pad50 button:hover::after{--pg-a1:-125deg}
html body #pad50#pad50 button:hover::before{background-position:25% 50%}
html body #pad50#pad50 button:active,html body #pad50#pad50 button.on{transform:scale(.94) translateY(1px);color:#1b1404!important;text-shadow:none;background:linear-gradient(-75deg,rgba(253,185,0,.75),rgba(255,212,92,.95),rgba(253,185,0,.75))!important;box-shadow:inset 0 .125em .2em rgba(0,0,0,.18),inset 0 -.125em .125em rgba(255,255,255,.55),0 0 .9em rgba(253,185,0,.55),0 .1em .1em -.05em rgba(0,0,0,.3)!important}
html body #pad50#pad50 button:active::before,html body #pad50#pad50 button.on::before{background-position:50% 15%;--pg-a2:-15deg}
html body #pad50#pad50 .c{font-size:10.5px;letter-spacing:.04em;color:#e9e4d6;background:linear-gradient(-75deg,rgba(255,255,255,.02),rgba(255,255,255,.1),rgba(255,255,255,.02));box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
html body #pad50#pad50 .c::after{display:none}
@media (hover:none) and (pointer:coarse){html body #pad50#pad50 button::after{--pg-a1:-75deg}html body #pad50#pad50 button::before{--pg-a2:-45deg}}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){html body #pad50#pad50 .dp,html body #pad50#pad50 .side{background:#11151be6}}
</style>`;

// ---------- scripts do 3D (injetados no 3d.html, que não é editado) ----------
const S3D = [
  ['tema3d', 2],      // (V1.82) temas Liquid Glass escuro/claro do 3D, com botão sol/lua
  ['ajustes3d', 2],
  ['cena3d', 1],
  ['eixos3d', 4],
  ['clima3d', 3],
  ['ficha3d', 5],
  ['cronogramas3d', 3],
  ['cenarios3d', 1],
  ['previsao3d', 8],
  ['ocultar3d', 5],
  ['pintar3d', 4],
  ['batch3d', 1],
  ['rdopasta3d', 1],
  ['cantitravel3d', 5],
  ['publicar3d', 4]
];
const tag3d = (n, v) => '<script src="/' + n + '.js?v=' + v + '" defer></script>';
// (V1.81) a mão de obra saiu do Dashboard do 3D e virou a página mao-de-obra.html: esconde os painéis (V1.37, V1.49 e V1.52) sem editar o 3d.html
const SEM_MO = '<style>#mo37,#mo49,#mo50{display:none!important}</style>';
const INJ_3D = PAD_CSS + SEM_MO + S3D.map(([n, v]) => tag3d(n, v)).join('');
// V1.66 — Planejamento: o mesmo 3D, com o armazenamento separado por cenário (planejamento3d.js roda antes do 3D, sem defer)
// e sem o que é só da produção (cenários do cronograma e leitura da Pasta do RDO).
const PLAN_SKIP = new Set(['cenarios3d', 'rdopasta3d']);
const INJ_PLAN = PAD_CSS + SEM_MO + '<script src="/planejamento3d.js?v=1"></script>' + S3D.filter(([n]) => !PLAN_SKIP.has(n)).map(([n, v]) => tag3d(n, v)).join('');

async function withLoader(res, extra = '') {
  const ct = res.headers.get('content-type') || '';
  if (res.status !== 200 || !ct.includes('text/html')) return res;
  let put = false;
  return new HTMLRewriter()
    // (V1.83) o 3D passa a aceitar as fontes do próprio site (pasta /fontes): só acrescenta font-src 'self' à política da página
    .on('meta[http-equiv="Content-Security-Policy"]', { element(e) { const c = e.getAttribute('content') || ''; if (c && !/font-src/.test(c)) e.setAttribute('content', c.replace(/;?\s*$/, "; font-src 'self'")); } })
    .on('head > title', { element(e) { if (!put) { put = true; e.after(LOADER_HTML + extra, { html: true }); } } })
    .on('body', { element(e) { if (!put) { put = true; e.prepend(LOADER_HTML + extra, { html: true }); } } })
    .transform(res);
}

// (V1.94) cabeçalhos de segurança em tudo que o site entrega; e escrita na API só a partir do próprio site (contra CSRF)
const SEG = { 'x-frame-options': 'SAMEORIGIN', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'strict-transport-security': 'max-age=31536000; includeSubDomains', 'permissions-policy': 'interest-cohort=()' };
function comSeg(res) {
  if (!res || res.status === 101) return res;
  const h = new Headers(res.headers); for (const [k, v] of Object.entries(SEG)) if (!h.has(k)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
export default {
  async fetch(req, env) { return comSeg(await rota(req, env)); }
};
async function rota(req, env) {
  {
    const url = new URL(req.url), path = url.pathname;
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const o = req.headers.get('origin'), sf = req.headers.get('sec-fetch-site');
      if ((o && o !== url.origin) || (sf && !['same-origin', 'none'].includes(sf))) return json({ error: 'origem não permitida' }, 403);
    }
    const email = await verifiedEmail(req, env).catch(() => null);
    if (!email) return blocked('Não foi possível confirmar o seu login. Feche a página e entre de novo pelo link do site.', '/', 'Entrar de novo');
    const prof = profileOf(email);
    if (path.startsWith('/api/rdo/')) return env.DADOS ? rdoApi(req, env, url, prof, email) : json({ error: 'armazenamento não configurado' }, 503);
    if (prof === 'apontador') {
      if (isRdo(path)) return withLoader(await env.ASSETS.fetch(req));
      if (path === '/rdo-catalogo.js') return env.ASSETS.fetch(req);   // (V1.76) catálogo de peças do RDO, em arquivo separado
      if (path.startsWith('/api/')) return json({ error: 'sem acesso' }, 403);
      return Response.redirect(url.origin + '/rdo', 302);
    }
    if (prof === 'equipe' && isRdo(path)) return blocked('O RDO é usado só pelos apontadores. Você tem acesso ao 3D, à pluviometria, às paralisações e à mão de obra.', '/', 'Ir para o início');
    // (V1.68) usuários do RDO com senha: tela e API só do perfil completo
    if (path === '/api/rdo-usuarios' || path.startsWith('/api/rdo-usuarios/')) return prof === 'completo' ? usuariosApi(req, env, url) : json({ error: 'só o perfil completo' }, 403);
    if ((path === '/usuarios' || path === '/usuarios.html') && prof !== 'completo') return blocked('A tela de usuários do RDO é só do perfil completo.', '/', 'Ir para o início');
    if (path.startsWith('/api/')) return api(req, env, url, prof, email);
    if (path === '/planejamento' || path === '/planejamento.html') return withLoader(await env.ASSETS.fetch(new Request(url.origin + '/3d', req)), INJ_PLAN);
    return withLoader(await env.ASSETS.fetch(req), path === '/3d' || path === '/3d.html' ? INJ_3D : '');
  }
}

// (V1.68) usado também pelo endereço só do RDO (rdo-worker.js)
export { rdoApi };
