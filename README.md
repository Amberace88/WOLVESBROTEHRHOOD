# Wolves Brotherhood MC — wolvesbrotherhoodmc.com

Kluba mājaslapa 8 valodās (LV, EN, RU, DE, LT, ET, NO, FR) + Ride HQ karte, Eiropas moto pasākumu kalendārs, Riders Help Riders (forums, SOS, brīdinājumi, palīdzības punkti, kluba čati) un ziedojumi.

Viss darbojas uz **viena Cloudflare Worker** (Workers Paid plāns): statiskā lapa + `/api` (D1 datubāze + Durable Objects reāllaika čatiem un "bara" atrašanās vietai).

## Struktūra

| Ceļš | Kas tur ir |
|---|---|
| `src/*.html` | Lapu veidnes (`index`, `karte`, `eiropa`, `brali`, `404`) ar `{{atslēga}}` tulkojumiem |
| `src/assets/js/data.js` | **Viss kluba saturs**: pasākumi, dienasgrāmata, hronika, biedri, maršruti, galerija, merch, ziedojumu rekvizīti |
| `src/assets/js/eu-events.json` | Eiropas moto pasākumi (58 ieraksti, ar avotiem) |
| `i18n/*.json` | Saskarnes tulkojumi 8 valodās |
| `scripts/build.mjs` | Būvē `dist/` — LV saknē, pārējās valodas `/en/`, `/ru/` … + sitemap.xml, hreflang |
| `worker/src/index.js` | API: auth, forums, čati, SOS, brīdinājumi, palīdzības punkti, bars |
| `worker/schema.sql` | D1 tabulas |

## Lokāli

```bash
npm install
npm run build              # → dist/
npx wrangler d1 execute wolves --local --file worker/schema.sql
npx wrangler dev           # http://localhost:8787  (API + lapa)
```

Bez Worker (`dist/index.html` atverot tieši) Riders Help Riders un bars strādā **demo režīmā** — dati tikai pārlūkā.

## Izvietošana uz Cloudflare (vienreiz)

1. Domēnam `wolvesbrotherhoodmc.com` jābūt Cloudflare kontā (nameserveri → Cloudflare).
2. `npx wrangler login`
3. `npx wrangler d1 create wolves` → ieliec `database_id` failā `wrangler.jsonc`
4. `npm run db:init` — izveido tabulas
5. `wrangler.jsonc` → `vars.ADMIN_EMAIL` = tavs e-pasts (šis konts pēc reģistrācijas kļūst par valdi/officer)
6. `npm run deploy`
7. Lapā **Riders Help Riders → Reģistrēties** ar ADMIN_EMAIL → "Izveidot biedra ielūgumu" → kodus izsniedz brāļiem.

Turpmāk: rediģē `data.js` / tulkojumus → `npm run deploy` (labāk vairākas izmaiņas vienā reizē).

## Kas jāaizpilda (`src/assets/js/data.js`)

- `CLUB.founded` — kluba dibināšanas datums un gads (rādās kalendārā un hronikā)
- `MEMBERS` — vārdi / iesaukas (vārda dienas automātiski parādās kalendārā)
- `EVENTS`, `DIARY`, `HISTORY` — īstie ieraksti (izdzēs `sample: true`)
- `DONATE.iban`, `bank`, `bic` vai `stripeLink` — tad ziedojumi rāda rekvizītus + SEPA QR kodu
- `CLUB.socials`, `CLUB.email`
- Galerijai: bildes uz `src/assets/img/`, ieraksti `GALLERY`

## Datu avoti (bez maksas)

Open-Meteo (laikapstākļi), OSRM (maršruti), Photon/komoot (adrešu meklēšana), Overpass/OpenStreetMap (DUS, servisi, kafejnīcas, fotoradari), RainViewer (radars), CARTO (tumšā karte). Vārda dienas: Latvijas kalendārs (`vardadienas`, MIT).
