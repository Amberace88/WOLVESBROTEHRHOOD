/* Modulis: commerce — Merch (katalogs), Partneri, Reklāma (marķēta „Sponsorēts”), Atbalsts (rekvizītu apstiprinājums).
   Vietnē maksājumi netiek pieņemti un karšu dati netiek glabāti: produktam var būt ārēja „Pirkt” saite
   (Shopify / Printful / Stripe Payment Link) vai pasūtījuma pieteikums pa e-pastu. */
import { route, json, fail, now, uid, clip, text, num, int, oneOf, bool, date, url, slug as mkSlug, ml, arr, parseJSON } from "../lib/http.js";
import { getSetting, putSetting } from "../lib/core.js";
import { registerFileUpload, registerFileAccess } from "./files.js";

/* ---------- konstantes ---------- */
const P_STATUS = ["draft", "published", "archived"];
const AVAIL = ["in_stock", "preorder", "sold_out", "coming"];
const PROVIDERS = ["manual", "shopify", "printful", "stripe"];
const P_CATS = ["apparel", "headwear", "accessories", "other"];
const PARTNER_CATS = ["sponsor", "partner", "service", "media", "community"];
const AD_STATUS = ["draft", "scheduled", "active", "paused", "ended"];
const PLACEMENTS = ["home", "events", "ridehq", "merch"];
const FRAMES_MIN = 8, FRAMES_MAX = 72;
const FID = /^[0-9a-z]{20}$/;
const fileUrl = id => id ? `/api/files/${id}` : null;
/* šodiena Latvijā (reklāmu periodi ir kalendāra datumi) */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/* ---------- failu tiesības ---------- */
registerFileUpload("product", async ctx => (await ctx.can("merch", "e")) || (await ctx.can("merch", "c")));
registerFileUpload("partner", async ctx => (await ctx.can("partners", "e")) || (await ctx.can("partners", "c")));
registerFileUpload("ad", async ctx => (await ctx.can("ads", "e")) || (await ctx.can("ads", "c")));
/* nepublicētos attēlus redz tie, kas drīkst skatīt attiecīgo administrācijas sadaļu (publicētie ir public = 1) */
registerFileAccess("product", ctx => ctx.can("merch", "v"));
registerFileAccess("partner", ctx => ctx.can("partners", "v"));
registerFileAccess("ad", ctx => ctx.can("ads", "v"));

/* faila id saraksts: tikai esoši attēli no pareizā konteksta (citādi kāds varētu publiskot cita moduļa failu) */
async function checkFiles(env, ids, ctxType){
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 50) {
    const part = uniq.slice(i, i + 50);
    const { results } = await env.DB.prepare(`SELECT id FROM files WHERE ctx_type = ? AND mime LIKE 'image/%' AND id IN (${part.map(() => "?").join(",")})`).bind(ctxType, ...part).all();
    if (results.length !== part.length) fail(400, "Unknown image — upload it again", { code: "file" });
  }
}
async function setPublic(env, ctxType, ids, pub){
  const uniq = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 50) {
    const part = uniq.slice(i, i + 50);
    await env.DB.prepare(`UPDATE files SET public = ? WHERE ctx_type = ? AND id IN (${part.map(() => "?").join(",")})`).bind(pub ? 1 : 0, ctxType, ...part).run();
  }
}
/* publiskums pēc saglabāšanas: jaunie faili → pēc statusa; izņemtie → privāti */
async function syncFiles(env, ctxType, before, after, pub){
  const gone = before.filter(id => !after.includes(id));
  if (gone.length) await setPublic(env, ctxType, gone, false);
  if (after.length) await setPublic(env, ctxType, after, pub);
}
const fid = v => (typeof v === "string" && FID.test(v)) ? v : null;
const fids = (v, max) => [...new Set(arr(v, max, fid))];

/* ======================================================================
   Produkti
   ====================================================================== */
function productIn(b){
  const sizes = arr(b.sizes, 16, s => {
    if (!s || typeof s !== "object") return null;
    const code = clip(s.code, 12); if (!code) return null;
    return { code, label: clip(s.label, 40) || code, available: s.available === undefined ? true : bool(s.available) };
  });
  if (new Set(sizes.map(s => s.code.toLowerCase())).size !== sizes.length) fail(400, "Size codes must be unique");
  const colors = arr(b.colors, 10, c => {
    if (!c || typeof c !== "object") return null;
    const name = ml(c.name, 40);
    if (!name.lv && !name.en) return null;
    const hex = /^#[0-9a-fA-F]{6}$/.test(c.hex || "") ? c.hex.toLowerCase() : "#000000";
    return { name, hex, images: fids(c.images, 8) };
  });
  const frames = fids(b.model360, FRAMES_MAX);
  const buyUrl = url(b.buyUrl, "buy link");
  if (buyUrl && !/^https:/.test(buyUrl)) fail(400, "Buy link must use https://");
  const price = b.price === null || b.price === undefined || b.price === "" ? null : Math.round(num(b.price, 0, 100000, "price") * 100) / 100;
  const currency = (clip(b.currency, 3) || "EUR").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) fail(400, "Invalid currency");
  return {
    name: ml(b.name, 120, true, "name"), description: ml(b.description, 4000), material: ml(b.material, 1000), care: ml(b.care, 1000),
    shipping: ml(b.shipping, 2000), returns: ml(b.returns, 2000),
    price, currency, images: fids(b.images, 12), sizes, colors,
    availability: oneOf(b.availability, AVAIL, "in_stock"), category: oneOf(b.category, P_CATS, "apparel"),
    buy_url: buyUrl, provider: buyUrl ? oneOf(b.provider, PROVIDERS, "manual") : "manual",
    model360: frames.length ? frames : null, featured: bool(b.featured) ? 1 : 0, sort: b.sort === undefined || b.sort === "" ? 0 : int(b.sort, -9999, 9999, "sort"),
    status: oneOf(b.status, P_STATUS, "draft")
  };
}
const productFiles = p => [...(p.images || []), ...(p.colors || []).flatMap(c => c.images || []), ...(p.model360 || [])];
const productRow = r => r ? ({
  ...r, name: parseJSON(r.name, {}), description: parseJSON(r.description, {}), material: parseJSON(r.material, {}), care: parseJSON(r.care, {}),
  shipping: parseJSON(r.shipping, {}), returns: parseJSON(r.returns, {}), images: parseJSON(r.images, []), sizes: parseJSON(r.sizes, []),
  colors: parseJSON(r.colors, []), model360: parseJSON(r.model360, null)
}) : null;
/* publiskais attēlojums (tikai publicētie) — lauki atbilst home.js līgumam + pilnā produkta lapa */
const productPub = p => ({
  slug: p.slug, name: p.name, price: p.price, currency: p.currency, image: fileUrl(p.images[0]),
  category: p.category, description: p.description, material: p.material, care: p.care,
  images: p.images.map(fileUrl), sizes: p.sizes.map(s => ({ code: s.code, label: s.label, available: !!s.available })),
  colors: p.colors.map(c => ({ name: c.name, hex: c.hex, images: (c.images || []).map(fileUrl) })),
  availability: p.availability, shipping: p.shipping, returns: p.returns, buyUrl: p.buy_url || null, provider: p.provider,
  model360: p.model360 && p.model360.length >= FRAMES_MIN ? p.model360.map(fileUrl) : null, featured: !!p.featured
});
const productAdmin = p => ({ ...productPub(p), id: p.id, imageIds: p.images, colors: p.colors.map(c => ({ ...c, imageUrls: (c.images || []).map(fileUrl) })),
  model360Ids: p.model360 || [], status: p.status, sort: p.sort, created: p.created, updated: p.updated, by: p.by_name || null });

async function uniqueSlug(env, s, selfId){
  const r = await env.DB.prepare("SELECT id FROM products WHERE slug = ?").bind(s).first();
  if (r && r.id !== selfId) fail(409, "This web address (slug) is already used by another product", { code: "slug" });
}
const loadProduct = async (env, id) => productRow(await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first());

/* ======================================================================
   Partneri
   ====================================================================== */
function partnerIn(b){
  const links = arr(b.links, 6, l => {
    if (!l || typeof l !== "object") return null;
    const u = url(l.url, "link"); if (!u) return null;
    return { label: clip(l.label, 40) || new URL(u).hostname.replace(/^www\./, ""), url: u };
  });
  return {
    name: text(b.name, 80, 2, "name"), logo: fid(b.logo), description: ml(b.description, 600), url: url(b.url, "website"), links,
    category: oneOf(b.category, PARTNER_CATS, "partner"), sort: b.sort === undefined || b.sort === "" ? 0 : int(b.sort, -9999, 9999, "sort"),
    status: oneOf(b.status, P_STATUS, "draft"), consent_brand: bool(b.consentBrand) ? 1 : 0, consent_note: clip(b.consentNote, 500)
  };
}
const partnerRow = r => r ? ({ ...r, description: parseJSON(r.description, {}), links: parseJSON(r.links, []) }) : null;
const partnerPub = p => ({ id: p.id, name: p.name, logo: fileUrl(p.logo), url: p.url || null, links: p.links, category: p.category, description: p.description });
const partnerAdmin = p => ({ ...partnerPub(p), logoId: p.logo, sort: p.sort, status: p.status, consentBrand: !!p.consent_brand, consentNote: p.consent_note || "",
  consentAt: p.consent_at, consentBy: p.consent_by_name || null, created: p.created, updated: p.updated });
const loadPartner = async (env, id) => partnerRow(await env.DB.prepare("SELECT p.*, u.name AS consent_by_name FROM partners p LEFT JOIN users u ON u.id = p.consent_by WHERE p.id = ?").bind(id).first());
/* publicēšanas noteikums (servera pusē): bez reģistrētas piekrišanas zīmola un logo lietošanai publicēt nedrīkst */
const assertConsent = p => {
  if (p.status !== "published") return;
  if (!p.consent_brand) fail(400, "Record the partner's consent to use their brand and logo before publishing", { code: "consent" });
  if (clip(p.consent_note, 500).length < 5) fail(400, "Describe how the consent was given (who, when, how) before publishing", { code: "consent" });
};

/* ======================================================================
   Reklāma
   ====================================================================== */
function adIn(b){
  const starts = date(b.starts, "start date", true), ends = date(b.ends, "end date", true);
  const status = oneOf(b.status, AD_STATUS, "draft");
  if ((status === "scheduled" || status === "active") && (!starts || !ends)) fail(400, "Set the start and end date before scheduling the ad", { code: "dates" });
  if (starts && ends && ends < starts) fail(400, "End date must not be before the start date", { code: "dates" });
  const label = clip(b.label, 30) || "Sponsorēts";
  return { partner_id: clip(b.partnerId, 24) || null, title: text(b.title, 120, 2, "title"), image: fid(b.image), url: url(b.url, "link"),
    placement: oneOf(b.placement, PLACEMENTS, "home"), starts, ends, status, label };
}
const adLiveSql = "status IN ('active','scheduled') AND starts IS NOT NULL AND ends IS NOT NULL AND starts <= ? AND ends >= ?";
const adPub = a => ({ id: a.id, title: a.title, image: fileUrl(a.image), url: a.url || null, label: a.label || "Sponsorēts", partner: a.partner_name || null });
const adAdmin = a => ({ ...adPub(a), imageId: a.image, partnerId: a.partner_id, placement: a.placement, starts: a.starts, ends: a.ends, status: a.status,
  live: ["active", "scheduled"].includes(a.status) && a.starts && a.ends && a.starts <= today() && a.ends >= today(), created: a.created, updated: a.updated });
const adFilesPublic = a => ["active", "scheduled"].includes(a.status) && (!a.ends || a.ends >= today());

/* ======================================================================
   Atbalsts: IBAN pārbaude (ISO 13616 mod-97)
   ====================================================================== */
const ibanOk = s => {
  const v = String(s || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(v)) return false;
  const r = (v.slice(4) + v.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let m = 0; for (const ch of r) m = (m * 10 + +ch) % 97;
  return m === 1;
};

/* ======================================================================
   Migrācijas (tikai papildinošas)
   ====================================================================== */
export const migrations = [
  { id: "commerce-001-tables", sql: [
    `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT, material TEXT, care TEXT,
      price REAL, currency TEXT NOT NULL DEFAULT 'EUR', images TEXT, sizes TEXT, colors TEXT, availability TEXT NOT NULL DEFAULT 'in_stock',
      shipping TEXT, returns TEXT, buy_url TEXT, provider TEXT NOT NULL DEFAULT 'manual', model360 TEXT, featured INTEGER NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', created INTEGER NOT NULL, updated INTEGER NOT NULL, by TEXT, category TEXT NOT NULL DEFAULT 'apparel')`,
    "CREATE INDEX IF NOT EXISTS products_pub ON products(status, featured, sort)",
    `CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY, name TEXT NOT NULL, logo TEXT, description TEXT, url TEXT, links TEXT, category TEXT NOT NULL DEFAULT 'partner',
      sort INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', consent_brand INTEGER NOT NULL DEFAULT 0, consent_note TEXT, consent_at INTEGER, consent_by TEXT,
      created INTEGER NOT NULL, updated INTEGER NOT NULL)`,
    "CREATE INDEX IF NOT EXISTS partners_pub ON partners(status, sort)",
    `CREATE TABLE IF NOT EXISTS ads (id TEXT PRIMARY KEY, partner_id TEXT, title TEXT NOT NULL, image TEXT, url TEXT, placement TEXT NOT NULL DEFAULT 'home',
      starts TEXT, ends TEXT, status TEXT NOT NULL DEFAULT 'draft', label TEXT NOT NULL DEFAULT 'Sponsorēts', created INTEGER NOT NULL, updated INTEGER NOT NULL)`,
    "CREATE INDEX IF NOT EXISTS ads_live ON ads(placement, status, starts, ends)"
  ] }
];

/* ======================================================================
   Maršruti
   ====================================================================== */
export const routes = [
  /* ---------- publiskie ---------- */
  route("GET", "/products", async ctx => {
    const sp = ctx.url.searchParams;
    const featured = sp.get("featured") === "1";
    const limit = Math.max(1, Math.min(200, +sp.get("limit") || 200));
    const { results } = await ctx.env.DB.prepare(`SELECT * FROM products WHERE status = 'published' ${featured ? "AND featured = 1" : ""} ORDER BY sort ASC, created DESC LIMIT ?`).bind(limit).all();
    return json({ products: results.map(productRow).map(productPub) });
  }),
  route("GET", /^\/products\/([a-z0-9-]{1,60})$/, async (ctx, s) => {
    const p = productRow(await ctx.env.DB.prepare("SELECT * FROM products WHERE slug = ? AND status = 'published'").bind(s).first());
    if (!p) fail(404, "Not found");
    return json({ product: productPub(p) });
  }),
  route("GET", "/partners", async ctx => {
    const { results } = await ctx.env.DB.prepare("SELECT * FROM partners WHERE status = 'published' AND consent_brand = 1 ORDER BY sort ASC, name COLLATE NOCASE ASC LIMIT 300").all();
    return json({ partners: results.map(partnerRow).map(partnerPub) });
  }),
  route("GET", "/ads", async ctx => {
    const placement = oneOf(ctx.url.searchParams.get("placement"), PLACEMENTS, "home"), d = today();
    const { results } = await ctx.env.DB.prepare(`SELECT a.*, p.name AS partner_name FROM ads a LEFT JOIN partners p ON p.id = a.partner_id AND p.status = 'published'
      WHERE a.placement = ? AND ${adLiveSql.replace(/\b(status|starts|ends)\b/g, "a.$1")} ORDER BY a.starts DESC, a.created DESC LIMIT 2`).bind(placement, d, d).all();
    return json({ ads: results.map(adPub) });
  }),
  route("GET", "/support", async ctx => {
    const v = await getSetting(ctx.env, "bank_verified", null);
    return json({ bankVerified: v && v.date ? v.date : null, iban: v && v.date ? v.iban : null });
  }),

  /* ---------- administrācija: produkti ---------- */
  route("GET", "/admin/products", async ctx => {
    await ctx.need("merch", "v", { elevated: true });
    const { results } = await ctx.env.DB.prepare("SELECT p.*, u.name AS by_name FROM products p LEFT JOIN users u ON u.id = p.by ORDER BY CASE p.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, p.sort ASC, p.created DESC LIMIT 500").all();
    return json({ products: results.map(productRow).map(productAdmin) });
  }),
  route("POST", "/admin/products", async ctx => {
    await ctx.need("merch", "c", { elevated: true });
    const b = await ctx.body(), p = productIn(b);
    if (p.status === "published") await ctx.need("merch", "e", { elevated: true });
    const s = mkSlug(b.slug || p.name.lv || p.name.en); if (!s) fail(400, "Web address (slug) is required");
    await uniqueSlug(ctx.env, s);
    await checkFiles(ctx.env, productFiles(p), "product");
    const id = uid(12), t = now();
    await ctx.env.DB.prepare(`INSERT INTO products (id, slug, name, description, material, care, price, currency, images, sizes, colors, availability, shipping, returns, buy_url, provider, model360, featured, sort, status, created, updated, by, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, s, JSON.stringify(p.name), JSON.stringify(p.description), JSON.stringify(p.material), JSON.stringify(p.care),
      p.price, p.currency, JSON.stringify(p.images), JSON.stringify(p.sizes), JSON.stringify(p.colors), p.availability, JSON.stringify(p.shipping), JSON.stringify(p.returns),
      p.buy_url || null, p.provider, p.model360 ? JSON.stringify(p.model360) : null, p.featured, p.sort, p.status, t, t, ctx.user.id, p.category).run();
    await syncFiles(ctx.env, "product", [], productFiles(p), p.status === "published");
    await ctx.audit("product.create", "product", id, { after: { slug: s, name: p.name.lv || p.name.en, status: p.status, price: p.price, buyUrl: p.buy_url || null } });
    return json({ ok: true, id, slug: s });
  }),
  route("POST", /^\/admin\/products\/(\w{6,24})$/, async (ctx, id) => {
    await ctx.need("merch", "e", { elevated: true });
    const old = await loadProduct(ctx.env, id); if (!old) fail(404, "Not found");
    const b = await ctx.body(), p = productIn(b);
    const s = mkSlug(b.slug || old.slug); if (!s) fail(400, "Web address (slug) is required");
    await uniqueSlug(ctx.env, s, id);
    await checkFiles(ctx.env, productFiles(p), "product");
    await ctx.env.DB.prepare(`UPDATE products SET slug = ?, name = ?, description = ?, material = ?, care = ?, price = ?, currency = ?, images = ?, sizes = ?, colors = ?, availability = ?,
      shipping = ?, returns = ?, buy_url = ?, provider = ?, model360 = ?, featured = ?, sort = ?, status = ?, updated = ?, by = ?, category = ? WHERE id = ?`).bind(s, JSON.stringify(p.name), JSON.stringify(p.description),
      JSON.stringify(p.material), JSON.stringify(p.care), p.price, p.currency, JSON.stringify(p.images), JSON.stringify(p.sizes), JSON.stringify(p.colors), p.availability,
      JSON.stringify(p.shipping), JSON.stringify(p.returns), p.buy_url || null, p.provider, p.model360 ? JSON.stringify(p.model360) : null, p.featured, p.sort, p.status, now(), ctx.user.id, p.category, id).run();
    await syncFiles(ctx.env, "product", productFiles(old), productFiles(p), p.status === "published");
    const pick = x => ({ slug: x.slug, status: x.status, price: x.price, availability: x.availability, buyUrl: x.buy_url || null, provider: x.provider, featured: !!x.featured, images: (x.images || []).length });
    await ctx.audit("product.update", "product", id, { before: pick(old), after: pick({ ...p, slug: s }) });
    return json({ ok: true, slug: s });
  }),
  route("POST", /^\/admin\/products\/(\w{6,24})\/status$/, async (ctx, id) => {
    await ctx.need("merch", "e", { elevated: true });
    const old = await loadProduct(ctx.env, id); if (!old) fail(404, "Not found");
    const status = oneOf((await ctx.body()).status, P_STATUS);
    await ctx.env.DB.prepare("UPDATE products SET status = ?, updated = ?, by = ? WHERE id = ?").bind(status, now(), ctx.user.id, id).run();
    await setPublic(ctx.env, "product", productFiles(old), status === "published");
    await ctx.audit("product.status", "product", id, { before: old.status, after: status });
    return json({ ok: true });
  }),
  route("DELETE", /^\/admin\/products\/(\w{6,24})$/, async (ctx, id) => {
    await ctx.need("merch", "d", { elevated: true });
    const old = await loadProduct(ctx.env, id); if (!old) fail(404, "Not found");
    await setPublic(ctx.env, "product", productFiles(old), false);
    await ctx.env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
    await ctx.audit("product.delete", "product", id, { before: { slug: old.slug, name: old.name, status: old.status, price: old.price } });
    return json({ ok: true });
  }),

  /* ---------- administrācija: partneri ---------- */
  route("GET", "/admin/partners", async ctx => {
    await ctx.need("partners", "v", { elevated: true });
    const { results } = await ctx.env.DB.prepare("SELECT p.*, u.name AS consent_by_name FROM partners p LEFT JOIN users u ON u.id = p.consent_by ORDER BY CASE p.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, p.sort ASC, p.name COLLATE NOCASE LIMIT 500").all();
    return json({ partners: results.map(partnerRow).map(partnerAdmin) });
  }),
  route("POST", "/admin/partners", async ctx => {
    await ctx.need("partners", "c", { elevated: true });
    const p = partnerIn(await ctx.body());
    assertConsent(p);
    if (p.logo) await checkFiles(ctx.env, [p.logo], "partner");
    const id = uid(12), t = now();
    await ctx.env.DB.prepare(`INSERT INTO partners (id, name, logo, description, url, links, category, sort, status, consent_brand, consent_note, consent_at, consent_by, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, p.name, p.logo, JSON.stringify(p.description), p.url || null, JSON.stringify(p.links), p.category, p.sort, p.status,
      p.consent_brand, p.consent_note || null, p.consent_brand ? t : null, p.consent_brand ? ctx.user.id : null, t, t).run();
    if (p.logo) await setPublic(ctx.env, "partner", [p.logo], p.status === "published");
    await ctx.audit("partner.create", "partner", id, { after: { name: p.name, status: p.status, consentBrand: !!p.consent_brand, consentNote: p.consent_note } });
    return json({ ok: true, id });
  }),
  route("POST", /^\/admin\/partners\/(\w{6,24})$/, async (ctx, id) => {
    await ctx.need("partners", "e", { elevated: true });
    const old = await loadPartner(ctx.env, id); if (!old) fail(404, "Not found");
    const p = partnerIn(await ctx.body());
    /* piekrišanas atsaukšana noņem publikāciju */
    if (!p.consent_brand && p.status === "published" && old.consent_brand) p.status = "draft";
    assertConsent(p);
    if (p.logo) await checkFiles(ctx.env, [p.logo], "partner");
    const consentChanged = !!p.consent_brand !== !!old.consent_brand || (p.consent_note || "") !== (old.consent_note || "");
    const cAt = p.consent_brand ? (consentChanged ? now() : old.consent_at) : null, cBy = p.consent_brand ? (consentChanged ? ctx.user.id : old.consent_by) : null;
    await ctx.env.DB.prepare(`UPDATE partners SET name = ?, logo = ?, description = ?, url = ?, links = ?, category = ?, sort = ?, status = ?, consent_brand = ?, consent_note = ?, consent_at = ?, consent_by = ?, updated = ? WHERE id = ?`)
      .bind(p.name, p.logo, JSON.stringify(p.description), p.url || null, JSON.stringify(p.links), p.category, p.sort, p.status, p.consent_brand, p.consent_note || null, cAt, cBy, now(), id).run();
    await syncFiles(ctx.env, "partner", [old.logo].filter(Boolean), [p.logo].filter(Boolean), p.status === "published");
    const pick = x => ({ name: x.name, status: x.status, category: x.category, url: x.url || null, consentBrand: !!x.consent_brand, consentNote: x.consent_note || null, logo: x.logo || null });
    await ctx.audit(consentChanged ? "partner.consent" : "partner.update", "partner", id, { before: pick(old), after: pick(p) });
    return json({ ok: true, status: p.status });
  }),
  route("POST", /^\/admin\/partners\/(\w{6,24})\/status$/, async (ctx, id) => {
    await ctx.need("partners", "e", { elevated: true });
    const old = await loadPartner(ctx.env, id); if (!old) fail(404, "Not found");
    const status = oneOf((await ctx.body()).status, P_STATUS);
    assertConsent({ ...old, status });
    await ctx.env.DB.prepare("UPDATE partners SET status = ?, updated = ? WHERE id = ?").bind(status, now(), id).run();
    if (old.logo) await setPublic(ctx.env, "partner", [old.logo], status === "published");
    await ctx.audit("partner.status", "partner", id, { before: old.status, after: status });
    return json({ ok: true });
  }),
  route("DELETE", /^\/admin\/partners\/(\w{6,24})$/, async (ctx, id) => {
    await ctx.need("partners", "d", { elevated: true });
    const old = await loadPartner(ctx.env, id); if (!old) fail(404, "Not found");
    if (old.logo) await setPublic(ctx.env, "partner", [old.logo], false);
    await ctx.env.DB.batch([ctx.env.DB.prepare("DELETE FROM partners WHERE id = ?").bind(id), ctx.env.DB.prepare("UPDATE ads SET partner_id = NULL WHERE partner_id = ?").bind(id)]);
    await ctx.audit("partner.delete", "partner", id, { before: { name: old.name, status: old.status, consentBrand: !!old.consent_brand, consentNote: old.consent_note } });
    return json({ ok: true });
  }),

  /* ---------- administrācija: reklāma ---------- */
  route("GET", "/admin/ads", async ctx => {
    await ctx.need("ads", "v", { elevated: true });
    const { results } = await ctx.env.DB.prepare("SELECT a.*, p.name AS partner_name FROM ads a LEFT JOIN partners p ON p.id = a.partner_id ORDER BY CASE a.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'draft' THEN 2 WHEN 'paused' THEN 3 ELSE 4 END, a.starts DESC, a.created DESC LIMIT 500").all();
    return json({ ads: results.map(adAdmin), today: today() });
  }),
  route("POST", "/admin/ads", async ctx => {
    await ctx.need("ads", "c", { elevated: true });
    const a = adIn(await ctx.body());
    if (a.partner_id && !(await ctx.env.DB.prepare("SELECT id FROM partners WHERE id = ?").bind(a.partner_id).first())) fail(400, "Unknown partner");
    if (a.image) await checkFiles(ctx.env, [a.image], "ad");
    const id = uid(12), t = now();
    await ctx.env.DB.prepare("INSERT INTO ads (id, partner_id, title, image, url, placement, starts, ends, status, label, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, a.partner_id, a.title, a.image, a.url || null, a.placement, a.starts, a.ends, a.status, a.label, t, t).run();
    if (a.image) await setPublic(ctx.env, "ad", [a.image], adFilesPublic(a));
    await ctx.audit("ad.create", "ad", id, { after: { title: a.title, placement: a.placement, starts: a.starts, ends: a.ends, status: a.status, url: a.url || null } });
    return json({ ok: true, id });
  }),
  route("POST", /^\/admin\/ads\/(\w{6,24})$/, async (ctx, id) => {
    await ctx.need("ads", "e", { elevated: true });
    const old = await ctx.env.DB.prepare("SELECT * FROM ads WHERE id = ?").bind(id).first(); if (!old) fail(404, "Not found");
    const a = adIn(await ctx.body());
    if (a.partner_id && !(await ctx.env.DB.prepare("SELECT id FROM partners WHERE id = ?").bind(a.partner_id).first())) fail(400, "Unknown partner");
    if (a.image) await checkFiles(ctx.env, [a.image], "ad");
    await ctx.env.DB.prepare("UPDATE ads SET partner_id = ?, title = ?, image = ?, url = ?, placement = ?, starts = ?, ends = ?, status = ?, label = ?, updated = ? WHERE id = ?")
      .bind(a.partner_id, a.title, a.image, a.url || null, a.placement, a.starts, a.ends, a.status, a.label, now(), id).run();
    await syncFiles(ctx.env, "ad", [old.image].filter(Boolean), [a.image].filter(Boolean), adFilesPublic(a));
    const pick = x => ({ title: x.title, placement: x.placement, starts: x.starts, ends: x.ends, status: x.status, url: x.url || null, label: x.label, image: x.image || null });
    await ctx.audit("ad.update", "ad", id, { before: pick(old), after: pick(a) });
    return json({ ok: true });
  }),
  route("POST", /^\/admin\/ads\/(\w{6,24})\/status$/, async (ctx, id) => {
    await ctx.need("ads", "e", { elevated: true });
    const old = await ctx.env.DB.prepare("SELECT * FROM ads WHERE id = ?").bind(id).first(); if (!old) fail(404, "Not found");
    const status = oneOf((await ctx.body()).status, AD_STATUS);
    if ((status === "scheduled" || status === "active") && (!old.starts || !old.ends)) fail(400, "Set the start and end date before scheduling the ad", { code: "dates" });
    await ctx.env.DB.prepare("UPDATE ads SET status = ?, updated = ? WHERE id = ?").bind(status, now(), id).run();
    if (old.image) await setPublic(ctx.env, "ad", [old.image], adFilesPublic({ ...old, status }));
    await ctx.audit("ad.status", "ad", id, { before: old.status, after: status });
    return json({ ok: true });
  }),
  route("DELETE", /^\/admin\/ads\/(\w{6,24})$/, async (ctx, id) => {
    await ctx.need("ads", "d", { elevated: true });
    const old = await ctx.env.DB.prepare("SELECT * FROM ads WHERE id = ?").bind(id).first(); if (!old) fail(404, "Not found");
    if (old.image) await setPublic(ctx.env, "ad", [old.image], false);
    await ctx.env.DB.prepare("DELETE FROM ads WHERE id = ?").bind(id).run();
    await ctx.audit("ad.delete", "ad", id, { before: { title: old.title, placement: old.placement, starts: old.starts, ends: old.ends, status: old.status } });
    return json({ ok: true });
  }),

  /* ---------- administrācija: atbalsta rekvizītu apstiprinājums ---------- */
  route("GET", "/admin/support", async ctx => {
    await ctx.need("settings", "v", { elevated: true });
    return json({ verified: await getSetting(ctx.env, "bank_verified", null) });
  }),
  route("POST", "/admin/support/verify", async ctx => {
    await ctx.need("settings", "e", { elevated: true });
    const b = await ctx.body(), before = await getSetting(ctx.env, "bank_verified", null);
    let val = null;
    if (bool(b.verified)) {
      const iban = String(b.iban || "").replace(/\s+/g, "").toUpperCase();
      if (!ibanOk(iban)) fail(400, "IBAN checksum is not valid", { code: "iban" });
      const d = date(b.date, "verification date");
      if (d > today()) fail(400, "Verification date cannot be in the future");
      val = { date: d, iban, note: text(b.note, 300, 5, "source of verification"), by: ctx.user.id, byName: ctx.user.name, at: now() };
    }
    await putSetting(ctx.env, "bank_verified", val);
    await ctx.audit(val ? "support.bank_verify" : "support.bank_unverify", "setting", "bank_verified", { before, after: val });
    return json({ ok: true, verified: val });
  })
];

/* reizi dienā: beigušās reklāmas → „ended”, attēli vairs nav publiski */
export async function scheduled(env){
  const d = today();
  const { results } = await env.DB.prepare("SELECT id, image FROM ads WHERE status IN ('active','scheduled','paused') AND ends IS NOT NULL AND ends < ?").bind(d).all();
  if (!results.length) return;
  await env.DB.prepare("UPDATE ads SET status = 'ended', updated = ? WHERE status IN ('active','scheduled','paused') AND ends IS NOT NULL AND ends < ?").bind(now(), d).run();
  await setPublic(env, "ad", results.map(r => r.image).filter(Boolean), false);
}
