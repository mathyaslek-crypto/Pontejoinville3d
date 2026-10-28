// Ponte Joinville — usuários do RDO com usuário e senha (V1.68)
// Usado por dois Workers:
//   worker.js      (site principal, atrás da Cloudflare Access): tela "Usuários do RDO", só para o perfil completo
//   rdo-worker.js  (endereço só do RDO, sem Cloudflare Access): login com usuário e senha
// No KV `DADOS` (um registro por usuário, para um login não sobrescrever a alteração de outro):
//   rdo-u:<usuario>        {nome,email,salt,hash,iter,ativo,v,criado,alterado,ultimo,falhas,bloq}
//   rdo-sessao-segredo-v1  chave aleatória que assina o cookie de sessão (criada no primeiro uso)
// As senhas nunca são guardadas: só o PBKDF2-SHA256 com sal próprio de cada usuário.
// `v` sobe quando a senha é trocada ou o usuário é bloqueado: as sessões abertas com o `v` antigo deixam de valer.
export const RDO_URL = 'https://rdo-ponte.alyaconstrutora.workers.dev';
const PREFIX = 'rdo-u:', SECRET_KEY = 'rdo-sessao-segredo-v1';
const ITER = 20000;                                   // PBKDF2 (cabe no tempo de CPU do Worker)
export const USER_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const SENHA_MIN = 6;
export const MAX_FALHAS = 5, BLOQ_MIN = 15;           // 5 senhas erradas seguidas → 15 minutos bloqueado
export const SESSAO_DIAS = 30;

const enc = new TextEncoder();
const b64 = u8 => btoa(String.fromCharCode.apply(null, u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64u = u8 => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

async function pbkdf2(senha, salt, iter) {
  const k = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, 256));
}
export async function hashSenha(senha) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), hash: b64(await pbkdf2(senha, salt, ITER)), iter: ITER };
}
function iguais(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
export async function confereSenha(u, senha) {
  if (!u || !u.salt || !u.hash) { await pbkdf2(String(senha), new Uint8Array(16), ITER); return false; }   // mesmo tempo quando o usuário não existe
  return iguais(await pbkdf2(String(senha), unb64(u.salt), u.iter || ITER), unb64(u.hash));
}

export const normUser = s => String(s || '').trim().toLowerCase();
export async function lerUsuario(env, nome) {
  if (!USER_RE.test(nome)) return null;
  return await env.DADOS.get(PREFIX + nome, 'json').catch(() => null);
}
export function gravarUsuario(env, nome, u) { return env.DADOS.put(PREFIX + nome, JSON.stringify(u)); }
export function apagarUsuario(env, nome) { return env.DADOS.delete(PREFIX + nome); }
export async function listarUsuarios(env) {
  const nomes = []; let cur;
  do { const r = await env.DADOS.list({ prefix: PREFIX, cursor: cur }); r.keys.forEach(k => nomes.push(k.name.slice(PREFIX.length))); cur = r.list_complete ? null : r.cursor; } while (cur);
  const out = [];
  for (const n of nomes) { const u = await lerUsuario(env, n); if (u) out.push([n, u]); }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}
export function publico(nome, u) {
  return { usuario: nome, nome: u.nome || '', email: u.email || '', ativo: u.ativo !== false, criado: u.criado || '', alterado: u.alterado || '',
    ultimo: u.ultimo || '', bloqueadoAte: u.bloq && u.bloq > Date.now() ? new Date(u.bloq).toISOString() : '' };
}

// ---------- sessão: cookie assinado com HMAC (usuário, versão do usuário e validade) ----------
let keyCache = null;
async function chave(env) {
  if (keyCache) return keyCache;
  let s = await env.DADOS.get(SECRET_KEY).catch(() => null);
  if (!s) { s = b64(crypto.getRandomValues(new Uint8Array(32))); await env.DADOS.put(SECRET_KEY, s); }
  keyCache = await crypto.subtle.importKey('raw', unb64(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return keyCache;
}
export async function criaSessao(env, nome, u) {
  const p = b64u(enc.encode(JSON.stringify({ u: nome, v: u.v || 0, exp: Date.now() + SESSAO_DIAS * 864e5 })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await chave(env), enc.encode(p)));
  return p + '.' + b64u(sig);
}
// confere a assinatura, a validade e se o usuário continua ativo e com a mesma versão
export async function leSessao(env, token) {
  const [p, sig] = String(token || '').split('.');
  if (!p || !sig) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await chave(env), unb64u(sig), enc.encode(p)); } catch (e) { return null; }
  if (!ok) return null;
  let s; try { s = JSON.parse(new TextDecoder().decode(unb64u(p))); } catch (e) { return null; }
  if (!s || typeof s.u !== 'string' || !(s.exp > Date.now())) return null;
  const u = await lerUsuario(env, s.u);
  if (!u || u.ativo === false || (u.v || 0) !== s.v) return null;
  return { nome: s.u, u, exp: s.exp };
}
