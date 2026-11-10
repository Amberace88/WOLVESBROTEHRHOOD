# WBMC — Wolves Brotherhood MC · wolvesbrotherhoodmc.com

Latvian Motorcycle Club from 1999. Vietne 8 valodās (LV, EN, RU, DE, LT, ET, NO, FR), izstrādāta pēc `WBMC_Techniska_Specifikacija_v2`.
Kartējums prasība → risinājums: `docs/v2/01-audits-un-plans.md`.

Viss darbojas uz **viena Cloudflare Worker**: statiskās lapas + `/api` (D1 datubāze, Durable Objects reāllaika saziņai, bara atrašanās vietai un šaham).

## Sadaļas

| Lapa | Kas tur ir | Piekļuve |
|---|---|---|
| `index` | Logo, „Latvian Motorcycle Club from 1999”, tuvākie pasākumi, Ride HQ, partneri | publiska |
| `klubs` | Šodiena, hronika, dienasgrāmata, kalendārs, galerija, saziņas forma | publiska |
| `pasakumi` | Moto pasākumi: Latvija → Eiropa → citi transporta pasākumi; saraksts, kalendārs, karte, laika josla, iCal | publiska |
| `karte` | Ride HQ: maršruti (punkti, aplis, saglabāt, kopīgot), laikapstākļi, slāņi, degvielas cenas (EK), SOS | publiska (bars, SOS — biedriem) |
| `brali` | Biedru profili ar lauku redzamību pēc pakāpes | tikai biedriem |
| `memorials` | Piemiņas kartītes (publicē tikai ar ģimenes piekrišanu un apstiprinātāju) | publiska |
| `sazina` | Norīkojumi, kanāli pēc pakāpes, grupas, privātās sarunas, idejas, Riders Help Riders (SOS), balss ziņas, videozvani (Jitsi) | tikai biedriem |
| `atbalsts` | Bankas rekvizīti, EPC/SEPA QR, atbalsta mērķi | publiska |
| `merch`, `partneri`, `sadarbiba` | Produkti, partneri (ar zīmola piekrišanu), reklāmas iespējas | publiska |
| `admin` | Konti, lomas un tiesības, ielūgumi, audits, Security Center, iestatījumi, tulkojumi + katra moduļa pārvaldība | pēc tiesībām, ar MFA |
| `pieslegties`, `profils` | Ieeja ar ielūgumu, MFA (TOTP), rezerves kodi, sesijas | — |

## Struktūra

| Ceļš | Saturs |
|---|---|
| `src/*.html` | Lapu veidnes ar `{{atslēga}}` tulkojumiem |
| `src/assets/css/core.css` | Dizaina sistēma (krāsas, fonti, komponentes); moduļu stili atsevišķos failos |
| `src/assets/js/common.js` | Kopējais klients `WB` (API, sesija, tiesības, dialogi, datumi, karte) |
| `i18n/<modulis>/<valoda>.json` | Tulkojumi (core, events, ridehq, comms, people, commerce) |
| `scripts/build.mjs` | Būvē `dist/` — LV saknē, citas valodas `/en/` … + sitemap, robots, hreflang |
| `worker/src/index.js` | API ieeja: drošības galvenes, CSP ar nonce, CSRF, pāradresācijas (`/qr`), cron |
| `worker/src/lib/` | `http.js` (validācija), `core.js` (sesijas, RBAC, audits, migrācijas), `crypto.js` (paroles, TOTP), `xlsx.js` |
| `worker/src/modules/` | auth, admin, files, events, ridehq, comms, rhr, people, commerce, chess |
| `brand/qr/` | QR kods (SVG, PNG, PDF, A6 kartīte) |
| `docs/v2/` | Specifikācijas kartējums, izstrādes rokasgrāmata, Ride HQ datu avoti, videozvani, e-komercija, rezerves kopijas |

## Lokāli

```bash
npm install
bash scripts/dev.sh main 8787      # būvē un palaiž http://localhost:8787 (atsevišķa lokālā DB)
```
Pirmais konts ar e-pastu `admin@wbmc.test` kļūst par administratoru (tikai lokāli). Datubāzes tabulas izveido Worker pats (`worker/src/migrations`, moduļu `migrations`).

## Izvietošana

```bash
bash ~/Desktop/"EDDIE WEBS"/CLIENTS/"WOLVES BROTHERHOOD MC"/website/scripts/deploy-demo.sh
```
Skripts: rīki → Cloudflare pieslēgšanās → D1 → **rezerves kopija** (`backups/`) → būve → izvietošana → migrācijas → pārbaude.

Vienreizēji iestatījumi Cloudflare (Worker → Settings → Variables and Secrets):
- `ADMIN_EMAIL` — pirmā administratora e-pasts (tikai pirmajai reģistrācijai, pēc tam var atstāt tukšu). Nekur netiek rādīts publiski.
- `MFA_KEY` (secret) — 32 baitu atslēga base64, ar ko šifrē MFA atslēgas datubāzē: `openssl rand -base64 32`.
- Pēc izvēles: `SECURITY_WEBHOOK` (Slack/Discord/Telegram drošības paziņojumiem), `TURNSTILE_SECRET` + `TURNSTILE_SITEKEY` (botu aizsardzība).
- Domēns `wolvesbrotherhoodmc.com` jāpievieno Cloudflare (nameserveri), tad `wrangler.jsonc` maršruti strādā un QR kods ved uz lapu.

## Drošība īsumā

HttpOnly + SameSite=Strict sesijas, CSRF galvene + Origin pārbaude, CSP ar nonce, HSTS, lomas un tiesības katrā API pieprasījumā servera pusē, obligāta MFA administratoriem un kluba vadībai, atkārtots MFA apstiprinājums administrācijas darbībām, pieteikšanās bloķēšana, jaunu ierīču notikumi, audita žurnāls, Security Center (tikai reāli dati). Sīkāk — `docs/v2/01-audits-un-plans.md`.

## Datu avoti (bez maksas)

OpenStreetMap (karte, Overpass objekti), OSRM (maršruti), Photon (adreses), Open-Meteo (laikapstākļi), RainViewer (radars), EK Weekly Oil Bulletin (degvielas cenas, CC BY 4.0), SSB (Norvēģija). Sīkāk — `docs/v2/ridehq.md`.
