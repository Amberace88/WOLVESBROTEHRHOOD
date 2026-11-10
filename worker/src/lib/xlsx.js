/* Minimāls XLSX lasītājs (bez atkarībām) Worker vidē un Node ≥ 18:
   ZIP centrālā direktorija → DecompressionStream("deflate-raw") → xl/sharedStrings.xml + pirmā lapa.
   Plus EK Weekly Oil Bulletin („Weekly prices with taxes”) parsētājs. */

/* ---------- ZIP ---------- */
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function zipEntries(buf){
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b.length < 22 || b[0] !== 0x50 || b[1] !== 0x4b) throw new Error("not a zip file");
  // End of central directory: meklējam no beigām (komentārs ≤ 65535 B)
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("zip: end of central directory not found");
  const count = u16(b, eocd + 10), cdOff = u32(b, eocd + 16);
  const out = new Map(); let p = cdOff;
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(b, p) !== 0x02014b50) throw new Error("zip: bad central directory");
    const method = u16(b, p + 10), csize = u32(b, p + 20), usize = u32(b, p + 24);
    const nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), lho = u32(b, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
    if (u32(b, lho) !== 0x04034b50) throw new Error("zip: bad local header");
    const dataOff = lho + 30 + u16(b, lho + 26) + u16(b, lho + 28);
    out.set(name, { method, csize, usize, data: b.subarray(dataOff, dataOff + csize) });
    p += 46 + nl + xl + cl;
  }
  return out;
}
async function inflateRaw(data){
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function zipRead(entries, name, maxBytes = 8 * 1024 * 1024){
  const e = entries.get(name); if (!e) return null;
  if (e.usize > maxBytes) throw new Error("zip: entry too large");
  if (e.method === 0) return e.data;
  if (e.method === 8) return inflateRaw(e.data);
  throw new Error("zip: unsupported compression " + e.method);
}

/* ---------- XML (viegla parsēšana) ---------- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export const xmlText = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] ?? m));
const attr = (s, n) => { const m = s.match(new RegExp(`(?:^|\\s)${n}="([^"]*)"`)); return m ? xmlText(m[1]) : null; };
const tText = s => [...s.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)].map(m => xmlText(m[1] || "")).join("");

export function parseSharedStrings(xml){
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => tText(m[1]));
}
const colIndex = ref => { let n = 0; for (const ch of ref.match(/^[A-Z]+/)[0]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
/* atgriež rindu masīvu (rows[r][c]); skaitļi — Number, teksti — String, tukšas šūnas — null */
export function parseSheet(xml, shared = []){
  const rows = [];
  const re = /<c\b((?:[^>"]|"[^"]*")*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const a = m[1], body = m[2] || "", ref = attr(a, "r");
    if (!ref || !/^[A-Z]+\d+$/.test(ref)) continue;
    const r = +ref.match(/\d+$/)[0] - 1, c = colIndex(ref), type = attr(a, "t");
    const vm = body.match(/<v>([\s\S]*?)<\/v>/);
    let v = null;
    if (type === "s") v = vm ? (shared[+vm[1]] ?? null) : null;
    else if (type === "inlineStr") v = tText(body);
    else if (type === "str") v = vm ? xmlText(vm[1]) : null;
    else if (type === "b") v = vm ? vm[1] === "1" : null;
    else if (type === "e") v = null;
    else if (vm) { const x = Number(vm[1]); v = Number.isFinite(x) ? x : null; }
    if (v === "") v = null;
    (rows[r] = rows[r] || [])[c] = v;
  }
  for (let i = 0; i < rows.length; i++) rows[i] = rows[i] || [];
  return rows;
}

/* pirmā darblapa pēc workbook.xml secības (rezerves variants: sheet1.xml) */
export async function readFirstSheet(buf){
  const z = zipEntries(buf), dec = new TextDecoder();
  const txt = async n => { const d = await zipRead(z, n); return d ? dec.decode(d) : null; };
  let sheetPath = "xl/worksheets/sheet1.xml";
  try {
    const wb = await txt("xl/workbook.xml"), rels = await txt("xl/_rels/workbook.xml.rels");
    const first = wb && wb.match(/<sheet\b[^>]*>/);
    const rid = first && attr(first[0], "r:id");
    if (rid && rels) {
      const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(x => x[0]).find(x => attr(x, "Id") === rid);
      const target = rel && attr(rel, "Target");
      if (target) sheetPath = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
    }
  } catch (e) { /* paliekam pie sheet1.xml */ }
  const sheet = await txt(sheetPath) ?? await txt("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("xlsx: worksheet not found");
  return parseSheet(sheet, parseSharedStrings(await txt("xl/sharedStrings.xml")));
}

/* Excel datums (1900 sistēma, epoha 1899-12-30) → YYYY-MM-DD */
export const excelDate = serial => new Date(Math.round((serial - 25569) * 864e5)).toISOString().slice(0, 10);

/* ---------- EK Weekly Oil Bulletin (prices with taxes, latest week) ---------- */
export const WOB_COUNTRIES = {
  Austria: "AT", Belgium: "BE", Bulgaria: "BG", Croatia: "HR", Cyprus: "CY", Czechia: "CZ", "Czech Republic": "CZ", Denmark: "DK", Estonia: "EE",
  Finland: "FI", France: "FR", Germany: "DE", Greece: "GR", Hungary: "HU", Ireland: "IE", Italy: "IT", Latvia: "LV", Lithuania: "LT", Luxembourg: "LU",
  Malta: "MT", Netherlands: "NL", Poland: "PL", Portugal: "PT", Romania: "RO", Slovakia: "SK", Slovenia: "SI", Spain: "ES", Sweden: "SE"
};
const norm = v => String(v ?? "").replace(/\s+/g, " ").trim();
/* EUR par 1000 l → EUR/l (3 zīmes); ārpus 0,3–4 €/l → null (nekad 0) */
const perLitre = v => { if (typeof v !== "number" || !Number.isFinite(v)) return null; const x = Math.round(v) / 1000; return x >= 0.3 && x <= 4 ? x : null; };

export function parseWOB(rows){
  const hi = rows.findIndex(r => r.some(c => /euro-?super\s*95/i.test(norm(c))));
  if (hi < 0) throw new Error("WOB: header row not found");
  const head = rows[hi].map(norm);
  if (!/^in EUR$/i.test(head[0] || "")) throw new Error(`WOB: currency header changed (${head[0]})`);
  const find = re => { const i = head.findIndex(h => re.test(h)); if (i < 0) throw new Error("WOB: column not found " + re); return i; };
  const col = { e95: find(/euro-?super\s*95/i), diesel: find(/automotive gas oil/i), lpg: find(/\bLPG\b/) };
  const units = rows[hi + 1] || [];
  for (const [k, i] of Object.entries(col)) if (norm(units[i]) !== "1000 l") throw new Error(`WOB: unexpected unit for ${k}: ${units[i]}`);
  const d = units[0];
  let date = null;
  if (typeof d === "number" && d > 30000 && d < 80000) date = excelDate(d);
  else { const m = norm(d).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) date = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  if (!date) throw new Error("WOB: price date missing");
  const countries = {}; let eu27 = null, ea = null;
  for (const r of rows.slice(hi + 2)) {
    const label = norm(r[0]); if (!label) continue;
    const v = { e95: perLitre(r[col.e95]), diesel: perLitre(r[col.diesel]), lpg: perLitre(r[col.lpg]) };
    if (WOB_COUNTRIES[label]) countries[WOB_COUNTRIES[label]] = v;
    else if (/EUR27/i.test(label)) eu27 = v;
    else if (/Euro Area/i.test(label)) ea = v;
  }
  if (Object.keys(countries).length < 20) throw new Error("WOB: too few countries (" + Object.keys(countries).length + ")");
  return { date, unit: "EUR/l", countries, eu27, ea };
}
export async function parseWOBFile(buf){ return parseWOB(await readFirstSheet(buf)); }

/* ---------- JSON-stat 2 (SSB) ---------- */
export function jsonStatValue(js, sel){
  const ids = js.id, size = js.size; let idx = 0, stride = 1;
  for (let k = ids.length - 1; k >= 0; k--) {
    const dim = js.dimension[ids[k]], ix = dim.category.index;
    const pos = Array.isArray(ix) ? ix.indexOf(sel[ids[k]]) : (sel[ids[k]] !== undefined ? ix[sel[ids[k]]] : (size[k] === 1 ? 0 : undefined));
    if (pos === undefined || pos < 0) return null;
    idx += pos * stride; stride *= size[k];
  }
  const v = Array.isArray(js.value) ? js.value[idx] : js.value[idx];
  return typeof v === "number" ? v : null;
}
