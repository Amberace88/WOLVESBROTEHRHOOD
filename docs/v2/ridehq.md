# Ride HQ — maršrutu un brauciena informācijas centrs (spec. 4. sadaļa)

Lapa: `src/karte.html` · klients: `src/assets/js/map.js`, `src/assets/css/ridehq.css` · administrācija: `src/assets/js/admin/ridehq.js`
Serveris: `worker/src/modules/ridehq.js`, XLSX parsētājs `worker/src/lib/xlsx.js` · tulkojumi: `i18n/ridehq/{lv,en}.json` (atslēgas `hq.*`).

## 1. Ko lietotājs var darīt
- **Plānot**: sākums, līdz 8 pieturām, galamērķis; pieturu secība ar ↑/↓ pogām vai vilkšanu (pele); punktus var pievienot, klikšķinot kartē, un pārvilkt kartē; koordinātas var ievadīt tekstā (`56.95, 24.10`).
- **Apļa maršruts**: atgriežas sākumā; galamērķa lauks kļūst par „tālāko punktu” (nav obligāts). Kartē un rezultātā redzams viss aplis (arī atpakaļceļš), ar virziena bultiņām.
- **Rezultāts**: kopējais attālums, braukšanas laiks (OSRM automašīnas profils, bez pauzēm), pieturu skaits, ierašanās laiks katrā punktā, lietus varbūtība un sānvējš pa ceļam (Open-Meteo), „ceļš priekšā” pa ceļu numuriem, degvielas stacijas un atpūtas vietas ≤ 1 km no maršruta, kluba pieturas ≤ 3 km, biedru ceļa brīdinājumi ≤ 1 km, valstis maršrutā un to vidējās degvielas cenas, satiksmes datu paziņojums, datu avotu saraksts ar laiku.
- **Saglabāt**: ar aktīvu kontu → serverī (`saved_routes`), redzamība „tikai es” vai „kluba biedri” (vajag `routes:c`); bez konta → `localStorage` (līdz 30 maršrutiem, tikai šajā pārlūkā).
- **Kopīgot**: saite `karte.html?pts=lat,lng;lat,lng&loop=1&name=…&labels=A|B|…` (mobilajā `navigator.share`, citur — starpliktuve). Esošie parametri darbojas: `?route=<id>` (kluba maršruts no `data.js`), `?to=lat,lng&name=` (no pasākumu lapas), `?tab=plan|fuel|pack|sos`.
- **Slāņi**: Degviela, Atpūtas vietas, Ēdināšana, Naktsmītnes, Moto servisi, Fotoradari (OSM/Overpass, no tālummaiņas 10), Kluba pieturas (`/api/places`), Ceļa brīdinājumi (`/api/hazards`, biedri var ziņot no slāņu paneļa), Lietus radars (RainViewer), Vējš (Open-Meteo). Katram — avota uzraksts, skaits/stāvoklis, kļūdas gadījumā „kļūda ↻”.
- **Degviela** (cilne): LV, LT, EE, PL, FI, SE, DE + ES vidējā, pārējās ES valstis sakļautas; 95 / dīzelis / LPG; starpība pret ES vidējo; datums, avots, licence; Norvēģija atsevišķi (SSB, NOK).
- **Bars**: tikai aktīviem kluba kontiem (WebSocket `/api/pack/<KODS>`, sesijas sīkdatne; vārds no konta). Demo režīms noņemts — netiek rādīti izdomāti braucēji.
- **SOS**: 112 poga, atrašanās vietas noteikšana + SMS/WhatsApp/kopēšana; aktīviem biedriem — „Nosūtīt SOS klubam” (`POST /api/sos`, redzams Saziņā), pārējiem — saites uz `pieslegties.html` un `sazina.html#rhr`.

## 2. Datu avoti, licences, izmaksas
| Dati | Avots | Veids | Licence / noteikumi | Izmaksas, atslēga |
|---|---|---|---|---|
| Kartes flīzes | tile.openstreetmap.org | API | © OpenStreetMap (ODbL), [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) — nav paredzēts lielai slodzei | bez maksas, bez atslēgas |
| Maršrutēšana | OSRM demo serveris `router.project-osrm.org` | API | OSM dati; demo serveris „light use only”, bez SLA | bez maksas, bez atslēgas |
| Adreses / valstis | Photon (komoot) `photon.komoot.io` | API | OSM dati; godīga lietošana | bez maksas, bez atslēgas |
| DUS, atpūtas vietas, ēdināšana, naktsmītnes, servisi, fotoradari | Overpass API `overpass-api.de` | API | © OpenStreetMap; fair use (~10 000 pieprasījumu/dienā, 2 vienlaicīgi) | bez maksas, bez atslēgas |
| Laika prognoze, vējš | Open-Meteo | API | CC BY 4.0; nekomerciāli < 10 000 pieprasījumu/dienā | bez maksas, bez atslēgas |
| Lietus radars | RainViewer public API | API | bezmaksas publiskais API (attiecinājums) | bez maksas, bez atslēgas |
| Degvielas cenas ES27 | EK Weekly Oil Bulletin, „prices with taxes” | **Oficiāli** | CC BY 4.0 („© European Union, Weekly Oil Bulletin (DG ENER)”) | bez maksas |
| Degvielas cenas NO | Statistics Norway (SSB), tabula 09654 | **Oficiāli** | CC BY 4.0; 30 pieprasījumi/min/IP | bez maksas |
| Kluba pieturas | WBMC D1 `places` | Klubs | kluba apstiprinātas | — |
| Ceļa brīdinājumi | WBMC D1 `hazards` (biedri, 7 dienas) | **Biedru ziņojums** | nav pārbaudīti — tā arī marķēts | — |

Saskarnē datu veidi ir atdalīti ar atzīmēm: **Oficiāli** (EK, SSB) · **API** (automātiski no atvērtiem servisiem) · **Biedru ziņojums** · **Kluba pietura**. Katram blokam norādīts avots un ielādes/datu laiks.

**Ko darīt, ja slodze pieaug** (izmaksu modelis): OSRM — pašu serveris (Docker, Baltijas OSM izvilkums ~1 GB RAM) vai maksas maršrutēšana (GraphHopper/Mapbox/Stadia — ar atslēgu, maksa par pieprasījumu); flīzes — maksas flīžu pakalpojums (Stadia/MapTiler/Thunderforest) vai pašu Protomaps PMTiles (R2); Overpass — pašu instance vai vietu kešs Worker'ī; Photon — pašu instance. Visi izsaukumi notiek no lietotāja pārlūka, tāpēc limiti attiecas uz katra lietotāja IP, nevis uz kluba serveri. Izmaiņām ārējos domēnos jāpielāgo CSP `worker/src/index.js` (`CSP_CONNECT`, `CSP_IMG`).

**Maršrutēšanas iespējas un ierobežojumi**: OSRM demo — tikai automašīnas profils (motocikla profila nav), bez satiksmes, bez „izvairīties no maģistrālēm” (demo serverī nav garantēts); laiks ir aprēķins automašīnai bez pauzēm. Līdz 10 punktiem maršrutā.

## 3. Ko NAV (godīgi)
- **Satiksmes dati** (sastrēgumi, ceļu darbi, slēgti posmi, ierobežojumi): Baltijas valstīm nav bezmaksas atvērta API. Rezultātā redzams paziņojums „Satiksmes dati: nav pieejami no atvērta avota” un saites uz oficiālajiem dienestiem (lvceli.lv, eismoinfo.lt, tarktee.ee; FI — Fintraffic, ja maršruts iet caur Somiju) + kluba biedru brīdinājumi ar ziņošanas laiku. Maršruts satiksmi neievēro. Nākotnes iespējas: Somijai Digitraffic (atvērts, CC BY 4.0), Zviedrijai Trafikverket API (bezmaksas ar atslēgu), Latvijai/Lietuvai/Igaunijai — DATEX II plūsmas pēc līguma ar ceļu dienestiem.
- **Konkrētu DUS cenas**: LV un EE — oficiāla atvērta avota nav. LT — Lietuvas Enerģētikas aģentūra (LEA) publicē staciju cenas (`ena.lt`, `degalukainos.ena.lt`), bet bez skaidras atkalizmantošanas licences, un karte lieto nedokumentētu API ar iebūvētu atslēgu → **netiek izmantots**. Ja klubs saņem LEA atļauju, to var pievienot kā atsevišķu avotu.
- **Biedru iesniegtas cenas** netiek vāktas.
- Datos nekas netiek „aizpildīts” — tukšs EK lauks (piem., LPG Somijā) rāda „nav datu”, nevis 0.

## 4. Degvielas cenu atjaunošana
- `worker/src/modules/ridehq.js` → `export async function scheduled(env)` — izsauc Worker cron (`wrangler.jsonc` → `"triggers": { "crons": ["17 6 * * *"] }`, reizi dienā).
- **EK**: GET `https://energy.ec.europa.eu/document/download/264c2d0f-f161-4ea3-a777-78faae59bea0_en` (stabils dokumenta UUID, fails tiek aizstāts katru nedēļu). Ja atbilde nav ZIP — rezerves ceļš: biļetena lapā meklē saiti „prices with taxes”. Fails tiek parsēts **Worker'ī** (`lib/xlsx.js`: ZIP centrālā direktorija → `DecompressionStream("deflate-raw")` → `sharedStrings.xml` + pirmā lapa; kolonnas pēc virsraksta teksta „Euro-super 95”, „Automotive gas oil”, „LPG”; vienības „1000 l” pārbaude; cenu datums no A2; valstu nosaukumi → ISO2; EUR/1000 l → EUR/l; ārpus 0,3–4 €/l → null). Ja izkārtojums mainās — parsētājs met kļūdu, saglabātie dati paliek nemainīti, kļūda redzama administrācijā.
- **SSB**: POST `https://data.ssb.no/api/v0/en/table/09654` (JSON-stat2, `PetroleumProd` 031 = 95, 035 = dīzelis, pēdējais mēnesis), NOK/l.
- Glabāšana (`settings`): `fuel_prices` = `{ date, unit:"EUR/l", countries:{LV:{e95,diesel,lpg},…}, eu27, ea, kind:"official", source, sourceUrl, fileUrl, license, attribution, fetchedAt, via:"auto"|"upload" }`; `fuel_prices_no` = `{ period:"YYYY-MM", currency:"NOK", unit:"NOK/l", e95, diesel, source, license, fetchedAt }`; `fuel_status` = pēdējais mēģinājums/kļūda katram avotam.
- `GET /api/fuel` → `{ available, stale, ec, no }` (kešs 1 h; ja `stale` — 10 min). Ja EK dati ielādēti > 8 dienas atpakaļ, fonā (`waitUntil`, ne biežāk kā reizi stundā) sāk atjaunošanu, bet atbild ar esošajiem datiem. `stale: true`, ja ielāde > 8 dienas vai cenu datums > 15 dienas — saskarnē brīdinājums „dati var būt novecojuši”. Nekad nav ielādēts → `{ available: false }`.
- Manuāli: `POST /api/admin/fuel/refresh` (`settings:e`, MFA). Rezerves ceļš: `POST /api/admin/fuel/upload` — administrators augšupielādē oriģinālo EK XLSX failu no EK vietnes (ja saite mainās vai EK serveris bloķē Worker); to parsē tas pats kods, datos `via: "upload"`, darbība auditā. Administrācijā: sadaļa „Ride HQ pieturas” → bloks „Degvielas cenas” (stāvoklis, „Atjaunot tagad”, „Augšupielādēt EK XLSX”).
- Lokāli (sandbox nesasniedz EK/SSB): parsētāja tests `node worker/test/xlsx.test.mjs` (paraugs `worker/test/fixtures/wob-prices-with-taxes-2026-09-28.xlsx`, EK dati, CC BY 4.0); datus lokālajā D1 iesēj ar augšupielādes galapunktu.

## 5. API
| Metode, ceļš | Tiesības | Apraksts |
|---|---|---|
| GET `/api/places` | publisks | publicētās kluba pieturas (kešs 5 min) |
| GET `/api/admin/places` | `places:v`, MFA | visas pieturas ar statusu un autoru |
| POST `/api/admin/places` | `places:c`, MFA | izveidot (audits `place.create`) |
| POST `/api/admin/places/:id` | `places:e`, MFA | labot / publicēt / arhivēt (audits `place.update|publish|archive`) |
| DELETE `/api/admin/places/:id` | `places:d`, MFA | dzēst (audits `place.delete` ar pilnu ierakstu) |
| GET `/api/routes` | aktīvs konts | `{ mine, club, canShare }` (club — ar `routes:v`) |
| POST `/api/routes` | aktīvs konts (`club` → `routes:c`) | `{ name, points:[{lat,lng,name}], roundTrip, distanceKm, durationMin, visibility }` |
| GET `/api/routes/:id` | īpašnieks vai `club` + `routes:v` | viens maršruts |
| DELETE `/api/routes/:id` | īpašnieks; cita kluba maršruts — `routes:d`, MFA, audits `route.delete` | dzēst |
| GET `/api/fuel` | publisks | degvielas cenas (sk. 4.) |
| GET `/api/admin/fuel` | `settings:v` vai `places:v`, MFA | avotu stāvoklis |
| POST `/api/admin/fuel/refresh` | `settings:e`, MFA | atjaunot tagad (audits `fuel.refresh`) |
| POST `/api/admin/fuel/upload` | `settings:e`, MFA | EK XLSX augšupielāde (audits `fuel.upload`) |
| GET/POST `/api/hazards`, WS `/api/pack/<KODS>` | kā iepriekš | brīdinājumi (7 d.), bars (aktīvs konts) |

Migrācija: `ridehq-001-places-routes` (tabulas `places`, `saved_routes`, indeksi).

## 6. Kļūdu stāvokļi
Katram ārējam servisam (OSRM, Open-Meteo, Overpass, Photon, RainViewer) ir taimauts (8–40 s) un saprotams paziņojums: kas nav pieejams + iemesls (taimauts, nav savienojuma, servisa kļūda N, pārāk daudz pieprasījumu) + poga „Mēģināt vēlreiz”. Maršruta kļūdas gadījumā kartē paliek punkti ar raustītu līniju; ja nav laika prognozes — maršruts un pārējais tiek rādīts, lietus josla paslēpta; ja nav Overpass — slāņos „kļūda ↻”; ja nav Photon — var ievadīt koordinātas vai izvēlēties punktu kartē.

## 7. Testi
- `node worker/test/xlsx.test.mjs` — ZIP/XML/WOB/JSON-stat parsētājs (vērtības salīdzinātas ar openpyxl izpēti; 2132,5 → 2,133 — noapaļošana uz augšu).
- API (lokāli, `scripts/dev.sh`): tiesības anonīmam/biedram/adminam, validācija, statusi, audits, degvielas augšupielāde un kļūdas stāvoklis, maršrutu redzamība, WS bez pieteikšanās → 401.
- Pārlūks (Playwright, ārējie servisi aizvietoti): plānošana ar 2+ pieturām un apli, pārkārtošana, saglabāšana (pārlūkā un kontā), kopīgošanas saites atgriešanās, slāņi, degvielas panelis, servisu kļūdas, bars, SOS, admin CRUD ar karti; 1440×900 un 390×844, LV un EN; bez konsoles kļūdām.
