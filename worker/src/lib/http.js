/* WBMC API — HTTP palīgi un ievades validācija */
export class HttpError extends Error {
  constructor(status, message, extra){ super(message); this.status = status; this.extra = extra || null; }
}
export const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };
export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
});
export const now = () => Date.now();
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
export const uid = (n = 16) => { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const x of b) s += B36[x % 36]; return s; };

/* ---- validācija ---- */
export const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, n);
export const text = (s, n, min = 0, field = "text") => { const v = clip(s, n); if (v.length < min) fail(400, `${field} is required`); return v; };
export const num = (v, min, max, field = "number") => { const x = Number(v); if (!Number.isFinite(x) || x < min || x > max) fail(400, `Invalid ${field}`); return x; };
export const int = (v, min, max, field = "number") => Math.round(num(v, min, max, field));
export const optNum = (v, min, max, field) => v === null || v === undefined || v === "" ? null : num(v, min, max, field);
export const oneOf = (v, list, dflt) => list.includes(v) ? v : (dflt !== undefined ? dflt : fail(400, "Invalid value"));
export const bool = v => v === true || v === 1 || v === "1" || v === "true";
export const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(Date.parse(s));
export const date = (s, field = "date", optional = false) => { if (optional && (s === null || s === undefined || s === "")) return null; if (!isDate(s)) fail(400, `Invalid ${field}`); return s; };
export const url = (s, field = "url", optional = true) => {
  const v = clip(s, 600);
  if (!v) return optional ? "" : fail(400, `${field} is required`);
  let u; try { u = new URL(v); } catch (e) { fail(400, `Invalid ${field}`); }
  if (u.protocol !== "https:" && u.protocol !== "http:") fail(400, `Invalid ${field}`);
  return u.toString();
};
export const email = (s, optional = false) => {
  const v = clip(s, 120).toLowerCase();
  if (!v && optional) return "";
  if (!/^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(v)) fail(400, "Invalid email");
  return v;
};
export const slug = s => clip(s, 80).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
/* daudzvalodu teksts: { lv, en, … } → tīrs objekts ar ierobežotu garumu */
export const LANGS = ["lv", "en", "ru", "de", "lt", "et", "no", "fr"];
export const ml = (v, n, required = false, field = "text") => {
  const out = {};
  if (typeof v === "string") v = { lv: v };
  for (const l of LANGS) { const s = clip(v && v[l], n); if (s) out[l] = s; }
  if (required && !out.lv && !out.en) fail(400, `${field} is required`);
  return out;
};
export const arr = (v, max, map) => (Array.isArray(v) ? v : []).slice(0, max).map(map).filter(x => x !== null && x !== undefined && x !== "");
export const parseJSON = (s, dflt) => { try { return s ? JSON.parse(s) : dflt; } catch (e) { return dflt; } };

/* ---- sīkdatnes ---- */
export const cookies = req => Object.fromEntries((req.headers.get("Cookie") || "").split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
export const setCookie = (name, value, { maxAge, httpOnly = true, sameSite = "Strict", path = "/", secure = true } = {}) =>
  `${name}=${encodeURIComponent(value)}; Path=${path}${maxAge !== undefined ? `; Max-Age=${maxAge}` : ""}${httpOnly ? "; HttpOnly" : ""}${secure ? "; Secure" : ""}; SameSite=${sameSite}`;

/* maršruta deklarācija moduļiem: route("GET", "/ceļš" | /regex/, handler) */
export function route(method, pattern, handler, opts = {}){ return { method, pattern, handler, ...opts }; }
