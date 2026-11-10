/* WBMC API — kriptogrāfija: paroles, tokeni, TOTP (RFC 6238) */
const enc = new TextEncoder();
export const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export const sha = async s => hex(await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc.encode(s) : s));
export const token = (bytes = 32) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
export const eqConst = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

/* PBKDF2-SHA256, 100 000 iterāciju (Workers WebCrypto maksimums) */
export async function hashPassword(pw, saltHex){
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return { hash: hex(bits), salt: hex(salt) };
}
export const passwordPolicy = pw => typeof pw === "string" && pw.length >= 10 && pw.length <= 200 && !/^(.)\1+$/.test(pw);

/* ---- Base32 (RFC 4648) ---- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function b32encode(bytes){
  let bits = 0, val = 0, out = "";
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
export function b32decode(s){
  s = String(s).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, val = 0; const out = [];
  for (const c of s) { val = (val << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return new Uint8Array(out);
}
export const newTotpSecret = () => b32encode(crypto.getRandomValues(new Uint8Array(20)));

async function hotp(secretB32, counter){
  const key = await crypto.subtle.importKey("raw", b32decode(secretB32), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new ArrayBuffer(8), dv = new DataView(msg);
  dv.setUint32(0, Math.floor(counter / 2 ** 32)); dv.setUint32(4, counter >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6;
  return String(code).padStart(6, "0");
}
/* atgriež izmantoto skaitītāju (lai neļautu atkārtot to pašu kodu) vai null */
export async function verifyTotp(secretB32, code, lastCounter = 0, at = Date.now()){
  code = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const c = Math.floor(at / 30000);
  for (const d of [0, -1, 1]) {
    const ctr = c + d;
    if (ctr <= lastCounter) continue;
    if (eqConst(await hotp(secretB32, ctr), code)) return ctr;
  }
  return null;
}
export const totpNow = (secret, at = Date.now()) => hotp(secret, Math.floor(at / 30000)); // testiem

/* rezerves kodi: 10 × XXXX-XXXX, glabā tikai jaucējvērtības */
export function recoveryCodes(n = 10){
  const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: n }, () => { const b = crypto.getRandomValues(new Uint8Array(8)); let s = ""; for (let i = 0; i < 8; i++) { s += A[b[i] % A.length]; if (i === 3) s += "-"; } return s; });
}
export const normCode = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
