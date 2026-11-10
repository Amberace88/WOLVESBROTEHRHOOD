# WBMC v2 — moduļu izstrādes rokasgrāmata (palīgiem un izstrādātājiem)

Projekts: Latvijas motociklu kluba WBMC vietne. Specifikācija: `docs/v2/01-audits-un-plans.md` (izlasi!). Saziņas valoda ar klientu — latviešu.
Pamatprincipi: **saglabāt kluba identitāti; neizdomāt datus** (pasākumu datumus, cenas, auditorijas skaitļus, biedru faktus, nopelnus); **piekļuves pārbaude vienmēr servera pusē**; katra administrācijas darbība — audita žurnālā.

## Arhitektūra
- **Statiskās lapas**: `src/<lapa>.html` → `scripts/build.mjs` → `dist/` (LV saknē, citas valodas `/en/`, `/ru/` …). Veidnēs: `{{atslēga}}` (tulkojums), `{{@head}}`, `{{@nav}}`, `{{@footer}}`, `{{@base}}` (ceļa prefikss), `{{@lang}}`, `{{@css:a,b}}` (ielādē `assets/css/a.css`, `b.css`; `leaflet` = kartes CSS).
  Kopējais stils `src/assets/css/core.css` tiek ielādēts vienmēr. Moduļa stils — savā failā.
- **Tulkojumi**: `i18n/<modulis>/<valoda>.json` (8 valodas: lv, en, ru, de, lt, et, no, fr). Tu raksti **lv un en**; pārējās aizpildīs tulkošanas posms. Build met kļūdu, ja veidnē ir nezināma `{{atslēga}}` → vispirms pievieno atslēgu, tad izmanto. JS: `WB.t("atsl", {n})`, `WB.tp(k, n)` (daudzskaitlis), `WB.L(obj)` (daudzvalodu objekts → tekošā valoda).
- **Worker**: `worker/src/index.js` maršrutē `/api/*` uz moduļiem `worker/src/modules/*.js`. Katrs modulis eksportē `routes` (masīvs) un `migrations` (masīvs `{ id: "modulis-001-…", sql: [ … ] }`), pēc izvēles `scheduled(env, execCtx)` (cron reizi dienā).
  - Migrācijas tikai papildinošas (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN, INSERT OR IGNORE). Nekad DROP/DELETE lietotāju datiem. Id unikāli, nekad nemaini jau esošu migrāciju — pievieno jaunu.
  - Durable Object „Room”: `worker/src/room.js` izsauc `worker/src/rooms/<veids>.js` (`fetch(room, req, url)`, `message(room, ws, attachment, raw)`, `close(room, ws, attachment)`).
- **Servera palīgi** (`worker/src/lib/http.js`, `core.js`):
  - `route(method, "/ceļš" | /^\/regex\/(\w+)$/, async (ctx, ...params) => Response)`
  - `json(data, status, headers)`, `fail(status, message, { code })`
  - validācija: `clip(s,n)`, `text(s,n,min,field)`, `num`, `int`, `optNum`, `oneOf(v, list, dflt)`, `bool`, `date(s)`, `url(s)`, `email(s)`, `slug(s)`, `ml(v, n, required)` (daudzvalodu objekts), `arr(v, max, map)`, `parseJSON`, `uid()`, `now()`
  - `ctx.user` (`{ id, name, role, roleName, level, status, mfaEnabled, mfaRequired, profileId }`) vai null; `ctx.active` (aktīvs konts); `ctx.isAdmin`
  - `ctx.needUser()` — aktīvs konts; `await ctx.need(module, action, { elevated })` — tiesību pārbaude. Darbības: `v c e d a x` (skatīt, izveidot, labot, dzēst, apstiprināt, eksportēt). **Visām administrācijas darbībām `{ elevated: true }`** (prasa MFA). `await ctx.can(module, action)` → bool.
  - Moduļi tiesībām: members, memorials, events, places, routes, orders, forum, chat, ideas, merch, partners, ads, gallery, users, invites, roles, audit, security, settings, i18n.
  - `await ctx.audit("modulis.darbība", "tips", id, { before, after })`, `await ctx.sec(type, "LOW|MEDIUM|HIGH|CRITICAL", details)`, `await ctx.limit(key, max, logaSek)`, `await ctx.body()` (JSON ≤256 KB).
  - Faili: `import { registerFileUpload, registerFileAccess } from "./files.js"` — reģistrē savu kontekstu: `registerFileUpload("event", async (ctx, ctxId) => ctx.can("events","e"))`, `registerFileAccess("chat", async (ctx, file) => …)`. Augšupielāde `POST /api/files` (galvenes `X-Context`, `X-Context-Id`), lasīšana `GET /api/files/:id`. Publiskiem failiem (logo, produktu attēli, publicēti Memorials foto) uzstādi `UPDATE files SET public = 1 WHERE id = ?`, kad saturs tiek publicēts.
- **Klienta palīgi** (`src/assets/js/common.js`, objekts `WB`):
  - `await WB.req("/ceļš", { body, method })` — API ar sesijas sīkdatni un CSRF galveni; kļūda → `WB.ApiError` (`.status`, `.code`); `WB.errMsg(e)`; automātiski prasa MFA apstiprinājumu (`mfa_stepup`).
  - `await WB.session()` → `WB.me` (`{ id, name, role, roleName, level, status, mfaEnabled, perms }`) vai null; `WB.can(module, action)`.
  - `await WB.gate(el, { module, action })` → lietotājs vai null (parāda „tikai biedriem” / „gaida apstiprinājumu” / „nav piekļuves”).
  - `WB.toast(msg, bad)`, `await WB.modal({ title, body, actions, onOpen, wide })`, `await WB.prompt(title, laukuHTML, okLabel)` → `{lauks: vērtība}` vai null, `await WB.confirm(title, text, label, danger)`.
  - `await WB.upload(file, context, contextId)`, `await WB.shrinkImage(file, maxPx)`.
  - Datumi: `WB.parseISO`, `WB.iso`, `WB.dayLabel`, `WB.dateLong`, `WB.range(a,b)`, `WB.monShort`, `WB.relDays(n)`, `WB.daysUntil(d)`; `WB.icon(name)`; `WB.esc()`; kartes: `WB.darkTiles()`, `WB.osrm(pts)`, `WB.hav(a,b)`; `WB.wsUrl("/ceļš")` WebSocket (sesijas sīkdatne tiek nosūtīta automātiski).
  - Lapas sākumā `common.js` pats inicializē galveni, `[data-rocker]` virsrakstus un `[data-reveal]`.
- **Administrācija**: `src/admin.html` jau ielādē `assets/js/admin/<modulis>.js`. Reģistrē sadaļas:
  `WBAdmin.register({ id, title, need: ["events","v"], order: 40, render: async el => { … } })`.
  Palīgi: `WBAdmin.mlField(name, label, value, { textarea, max, required })` + `WBAdmin.readML(form, name)`, `WBAdmin.imageField(name, label, currentUrl, context)` (slēptais lauks satur faila id), `WBAdmin.table(cols, rowsHtml, empty)`, `await WBAdmin.editor({ title, body, onSave: async form => …, danger: { label, onClick } })`, `WBAdmin.badge(status)`, `WBAdmin.fmt(ts)`, `WBAdmin.fmtDate(iso)`, `WBAdmin.show(id)` (pārzīmēt), `WBAdmin.loading(el)`, `WBAdmin.err(el, e)`.
  Statusu tulkojumi jau ir: `status.draft|review|published|cancelled|ended|pending|active|archived|approved`.

## Dizains (obligāti)
- Kluba identitāte: melns `#000`, virsmas `--felt`, līnijas `--line`/`--line-2`, kaula baltais `--bone`, sudrabs `--silver`/`--dim`. **Sarkanais `--eye` tikai signāliem** (tiešraide, SOS, kritiski), nekad dekoram.
- Fonti: `--f-display` (virsraksti, šaurs), `--f-ui` (pamatteksts — Fira Sans), `--f-book` (gari stāsti: Memorials, dienasgrāmata).
- Lapas augšā viens `h1.rocker` (jau ir veidnē). Sadaļu virsraksti — parasti `h2`, bez lieliem burtiem, bez „eyebrow” uzrakstiem virs virsrakstiem.
- Mierīgs, nepārslogots: saraksti ar līnijām (`.rows`), nevis desmitiem vienādu kartīšu; `.panel` tikai tur, kur saturs tiešām ir atsevišķs bloks. Kustība tikai kā atbilde uz darbību (atvērt, apstiprināt).
- Gatavās klases: `.btn` (`.ghost`, `.small`, `.danger`), `.icon-btn`, `.link-btn`, `.form`/`.field`/`.two`, `.check`, `.hint`, `.form-err`, `.tabs`, `.chips`/`.chip.on`, `.badge` (`.ok/.warn/.bad/.solid/.official`), `.live`, `.panel`, `.rows`, `.table`/`.table-wrap`, `.empty`, `.gate`, `.section`, `.section-head`, `.grid-2`/`.grid-3`, `.prose`, `.book`, `.muted`, `.dim`, `.small`, `.num`, `.stitch`.
- Teksti: teikuma reģistrā, darbības vārdi pogās („Saglabāt pasākumu”, nevis „Iesniegt”). Tukšs stāvoklis = norāde, ko darīt. Kļūdas — konkrēti, kas noticis un kā labot.
- Responsīvi līdz 360 px, redzams tastatūras fokuss, `prefers-reduced-motion`, attēliem `alt`, formām `label`.

## Testēšana (katram modulim)
1. Savā darba kopijā: `ln -s /home/claude/wolvesbrotehrhood/node_modules node_modules` (ja nav).
2. Palaid: `nohup bash scripts/dev.sh <modulis> <ports> > /tmp/claude-0/dev-<modulis>.log 2>&1 &` un gaidi `curl -s localhost:<ports>/api/health`. Pēc katras `src/` izmaiņas vajag pārbūvēt → apstādini (`kill` konkrētos PID; **nekad `pkill -f`**, tas nogalina tavu čaulu) un palaid no jauna. Worker koda izmaiņas wrangler pārlādē pats.
3. Testa administrators: reģistrē `admin@wbmc.test` bez ielūguma (pirmā administratora režīms), ieslēdz MFA (`/me/mfa/setup` → `/me/mfa/enable` ar TOTP, aprēķina skriptā — paraugs `/tmp/claude-0/qa/v2/api-core.mjs`). Pieprasījumiem: galvenes `X-WBMC: 1` un `Origin: http://localhost:<ports>`; sīkdatnes jāglabā.
4. API tests (Node skripts): tiesības (anonīms/biedrs/admins), validācija, statusi, audita ieraksti.
5. Pārlūka tests (Playwright, `python3` + `playwright.async_api`, Chromium jau instalēts): ekrānuzņēmumi 1440×900 un 390×844, pārbaudi konsoles kļūdas, aplūko attēlus ar Read rīku un labo izskatu.

## Nodošana
- Darba beigās: `git add -A && git commit -m "<modulis>: …"` savā darba kopijā (zarā). Nekomitē `dist/`, `.dev/`, `node_modules`.
- Atbildē: izmainīto failu saraksts, API galapunkti, migrāciju id, testu rezultāti, zināmās nepilnības un lēmumi, kas jāpieņem klubam.
- Nemaini kopīgos failus (`common.js`, `core.css`, `build.mjs`, `index.js`, `lib/*`, `i18n/core/*`, `admin/core.js`). Ja tiešām vajag izmaiņu tajos — apraksti to atbildē, es to ieviesīšu.
