// Single shared-password login with a signed cookie. Works in middleware (edge) and Node.

export const SESSION_COOKIE = 'abs_session';

// The admin area needs a password in production (the public site shares this domain).
// Locally, with no ADMIN_PASSWORD set, it stays open so you can try it with zero setup.
export function authEnabled() {
  return !!process.env.ADMIN_PASSWORD || process.env.NODE_ENV === 'production';
}

function secret() {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || '';
}

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || '';
}

const enc = (s: string) => new TextEncoder().encode(s);

async function hmac(msg: string) {
  const key = await crypto.subtle.importKey('raw', enc(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function makeSession(days = 30) {
  const exp = Date.now() + days * 864e5;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function checkSession(v?: string | null) {
  if (!v || !secret()) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp));
}
