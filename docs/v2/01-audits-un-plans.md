# WBMC — specifikācija v2.0: audits un ieviešanas plāns

Sagatavots: 2026-11-10 · Zars: `spec-v2` · Pamats: „WBMC_Techniska_Specifikacija_v2.pdf”

## 1. Konstatētā situācija (esošā sistēma)

| Joma | Stāvoklis |
|---|---|
| Steks | Statiska daudzvalodu lapa (`scripts/build.mjs`, 8 valodas) + viens Cloudflare Worker (`worker/src/index.js`): API, D1 datubāze `wolves`, Durable Object `Room` (čati, „bars”, šaha partijas) |
| Hostings | `wolvesbrotherhood.eddieweb.workers.dev` (demo). Domēns `wolvesbrotherhoodmc.com` vēl nav pārcelts uz Cloudflare |
| Izvietošana | Īpašnieka Mac: `scripts/deploy-demo.sh` (wrangler). Konteinerā Cloudflare API nav sasniedzams |
| Autentifikācija | E-pasts + parole (PBKDF2), bearer tokens `localStorage`, ielūguma kodi, lomas rider/member/officer. Nav MFA, nav apstiprināšanas, nav audita žurnāla |
| Moduļi | Sākums (šodiena, hronika, dienasgrāmata, pasākumi, kalendārs, maršruti, šahs, galerija, biedri, merch, ziedojumi, pievienošanās), Ride HQ, Eiropas pasākumi, Riders Help Riders (publisks forums, čati, SOS, brīdinājumi, palīdzības punkti) |
| Datu avoti | Open-Meteo, OSRM, Photon, Overpass, RainViewer, OSM flīzes |

### Atrastās problēmas, kas jālabo nekavējoties
1. **GitHub repozitorijs ir publisks**, un `wrangler.jsonc` satur administratora e-pastu (`ADMIN_EMAIL`). Labojums: vērtība izņemta no repozitorija; īpašnieka Mac konfigurācijā tā paliek. Vēsturē adrese joprojām redzama — ieteicams repozitoriju padarīt privātu (to var tikai īpašnieks GitHub iestatījumos).
2. Sesijas tokens glabājas `localStorage` un WebSocket pieslēgumā tiek sūtīts URL parametrā (nonāk žurnālos). Labojums: HttpOnly sīkdatne + CSRF aizsardzība.
3. Forums un daļa kluba datu ir publiski lasāmi — pretrunā ar 5. sadaļu („WBMC vietne nav publisks forums”).
4. Sākumlapā publiski redzams biedru saraksts — pretrunā ar 5. sadaļas „Privātums” prasību.
5. Sauklis „Viens bars. Viens ceļš.” = „One Pack” formulējums, ko specifikācija liek nelietot.
6. `info@wbmc.com`: publiski pieejamā informācija liecina, ka domēns `wbmc.com` pieder citai organizācijai. Adrese **netiek publicēta**, līdz īpašnieks apstiprina domēna īpašumtiesības (11. sadaļas noteikums). Publicēta tiek `wolvesmc@inbox.lv`.

## 2. Prasību kartējums

Apzīmējumi: **S** — saglabāt, **L** — labot, **I** — izstrādāt no jauna, **N** — integrēt, **V** — izvērtēt (lēmums vai dokumentācija).

| § | Prasība | Darbība | Risinājums |
|---|---|---|---|
| 1 | Logotips pilnā proporcijā, bez rāmja; nosaukums „WBMC” | L | Galvenē un sākumlapā oriģinālais logo bez apmales; zīmola teksts „WBMC” |
| 1 | Minimālistiska galvene, „Latvian Motorcycle Club from 1999”, valodu izvēlne ar ☰ | L | Jauna galvene: logo · galvenās saites · valodas poga · ☰ izvēlne (pilna navigācija + valodas) |
| 1 | Navigācijas secība | L | Klubs · Moto pasākumi · Ride HQ · Brāļi · Memorials · Saziņa/Atbalsts · Merch · Partneri; biedru saites tikai autorizētiem |
| 1 | QR kods (SVG, PDF, PNG) | I | `brand/qr/` — kods uz `https://wolvesbrotherhoodmc.com/qr`, Worker pāradresē (mērķi var mainīt bez pārdrukāšanas); skenēšana pārbaudīta |
| 2 | Atsevišķa valodu izvēlne, izvēle saglabājas | L | Izvēle `localStorage` + automātiska pāradresācija nākamajā apmeklējumā; pārlūka valoda tikai kā ieteikums; bez ģeolokācijas |
| 2 | Kluba formulējums „One brotherhood. One road. We are.” | L | Sauklis visās valodās angliski (kā kluba apstiprināts teksts) |
| 2 | Valodu QA | I | Build pārbauda trūkstošās atslēgas visās 8 valodās; tulkojumu pārrakstīšana admin panelī |
| 3 | „Moto pasākumi”, LV pirmie, 4 kategorijas, filtri, statusi, admin pārvaldība, iCal | L+I | D1 tabula `events`, API, admin redaktors, publiskā lapa `pasakumi.html` (saraksts/kalendārs/laika josla/karte), `/api/events.ics`, atgādinājumi (.ics ar VALARM); vecā `eiropa.html` pāradresē |
| 3 | Nepublicēt nepārbaudītus datumus | I | Statusi melnraksts/pārbaudē/publicēts/atcelts/noslēdzies; publiski redzams tikai „publicēts”; katram avots |
| 4 | Maršruts: sākums, beigas, pieturas, aplis, saglabāt/kopīgot | L | Ride HQ plānotājs: pieturu pievienošana/kārtošana, apļa maršruts, saglabāšana (biedriem D1, citiem pārlūkā) un saite |
| 4 | Satiksmes dati | V | Bezmaksas atvērta satiksmes API Baltijai nav — kartē godīgs paziņojums „dati nav pieejami”, nevis izdomāti dati |
| 4 | Slāņi: DUS, atpūta, ēdināšana, naktsmītnes, servisi, kluba pieturas | L+I | Overpass slāņi + D1 `places` (kluba apstiprinātās pieturas, admin pārvalda) |
| 4 | Degvielas cenas | I | EK Weekly Oil Bulletin (oficiāls, vidējās cenas pa valstīm, datums, avots). DUS līmeņa cenas tikai, ja ir oficiāls avots |
| 5 | Ielūgumi (vienreizēji/termiņa), apstiprināšana, RBAC, norīkojumi ar vēsturi | I | Konfigurējamas lomas ar tiesībām pa moduļiem (skatīt/izveidot/labot/dzēst/apstiprināt/eksportēt), konti „gaida apstiprinājumu”, ielūgumu žurnāls, norīkojumi ar izmaiņu vēsturi; pārbaude servera pusē |
| 6 | Saziņa: Norīkojumi, Vispārējais čats, Slēgtais čats, Piezīmes un idejas, Tehnika un serviss, Maršruti un braucieni | L | Biedru zona `sazina.html`; „Riders Help Riders” kā tēma kopējā saziņā (atsevišķa sadaļa netiek veidota) |
| 6 | Privātās un grupu sarunas, atbildes, labošana/dzēšana, faili un attēli, nelasītās, meklēšana, laika atzīmes | I | DO istabas + D1; faili D1 (attēli saspiesti klientā), piekļuve pārbaudīta katram failam |
| 6 | Balss ziņas, skaņas paziņojumi (ieslēdzami) | I | MediaRecorder (Opus), skaņa izslēgta pēc noklusējuma |
| 6 | Videozvani | V | Jitsi Meet (atvērts kods, šifrēts transports, bez savas infrastruktūras) — saite uz neuzminamu istabu; lēmums īpašniekam |
| 7 | Brāļu profili ar lauku redzamību, admin labošana, audits | I | `brali.html` (tikai biedriem), D1 `profiles`; pakāpes maiņa tikai manuāli, žurnālā |
| 7 | Memorials | I | `memorials.html`, kartītes, apstiprinātājs un piekrišana, „Vārdi no brāļiem” ar moderāciju; nekas netiek izdomāts — tukšs, līdz klubs pievieno |
| 8 | Merch ar produktu lapām | L+I | `merch.html`: attēli, izmēri, krāsas, materiāls, pieejamība, cena, piegāde/atgriešana; admin pārvalda; 360° tikai ja ir faili |
| 8 | Shopify/Printful | V | Izvērtējums dokumentā; integrācija pēc lēmuma; līdz tam pasūtījums caur saiti/pieteikumu, karšu dati vietnē netiek glabāti |
| 8 | Partneri, „Sadarbība un reklāma”, reklāmu pārvaldība ar marķējumu | I | `partneri.html`, `sadarbiba.html`, D1 `partners`/`ads`; cenas un auditorijas skaitļi netiek izdomāti |
| 9 | „Atbalsts”, bez „tvertnes” frāzes, bankas dati | L | Jauna `atbalsts.html`; rekvizīti no specifikācijas (IBAN kontrolsumma pārbaudīta — derīga), atzīmēti kā „jāapstiprina” īpašniekam |
| 10 | E-pasti, Facebook | L | `wolvesmc@inbox.lv` publiski; `info@wbmc.com` — skat. 1.6; Facebook ikona ar `rel="noopener noreferrer"` |
| 10 | SPF/DKIM/DMARC | V | Pārbaudes saraksts dokumentācijā (DNS pārvalda īpašnieks) |
| 11 | WAF, HTTPS, galvenes, CSP, CSRF, validācija, rate limiting, droša augšupielāde | L+I | Stingra CSP un drošības galvenes Worker'ī, HttpOnly sesijas sīkdatne + Origin/galvenes CSRF pārbaude, ievades validācija, ierobežojumi, failu tipu pārbaude pēc satura |
| 11 | Obligāta MFA | I | TOTP (RFC 6238) + rezerves kodi; obligāta lomām ar paaugstinātām tiesībām; atslēgšana tikai ar otra pilnvarota admina apstiprinājumu; WebAuthn — nākamais solis |
| 11 | Sesijas, neveiksmīgie mēģinājumi, jaunas ierīces, audits | I | Sesiju termiņi, bloķēšana pēc neveiksmīgiem mēģinājumiem, ierīču reģistrs, drošības notikumu žurnāls |
| 11 | Serveru nostiprināšana, SSH, IDS/IPS, SIEM | V | Serverless arhitektūrā nav pārvaldāmu serveru/SSH; Cloudflare WAF/Security Events + Logpush kā SIEM avots — dokumentēts |
| 11 | Rezerves kopijas | I | Izvietošanas skripts pirms katras izvietošanas eksportē D1 (`backups/`) un reģistrē faktu datubāzē; D1 Time Travel — atjaunošanas procedūra dokumentēta |
| 11 | Security Center, incidentu paziņojumi | I | Admin panelī tikai faktiski dati; paziņojumi uz `SECURITY_WEBHOOK` (Telegram/Discord/Slack — kanāls jāizvēlas) |
| 12 | Modularitāte, admin panelis, audits, SEO, veiktspēja | L+I | API moduļi, admin panelis `admin.html`, katrai darbībai audita ieraksts, unikāli meta, sitemap bez slēgtajām lapām, `noindex` biedru lapām |
| 13 | Privātums, piekrišana, minimizācija | I | `privatums.html`; piekrišanas lauki fotogrāfijām/Memorials; glabāšanas termiņi; pieprasījumu procedūra |
| 14–15 | Posmi, versiju kontrole, rezerves kopijas, testēšana | — | Darbs zarā `spec-v2`; lokāla testa vide (`wrangler dev` + lokāla D1); katra posma testi; atgriešanās plāns zemāk |

Saglabājamie moduļi (bez saskaņošanas netiek dzēsti): vārda dienas un kalendārs, hronika, dienasgrāmata, galerija, šaha galds, laikapstākļu analīze maršrutā, „bars” kartē, SOS un brīdinājumi (pārcelti uz biedru saziņu / Ride HQ).

## 3. Datu bāzes izmaiņas
Tikai papildinošas migrācijas (jaunas tabulas un kolonnas), nekas netiek dzēsts. Migrācijas izpilda Worker pēc kārtas un reģistrē tabulā `_migrations`. Pirms katras izvietošanas `deploy` skripts izveido D1 eksportu.

Jaunas tabulas: `roles`, `role_perms`, `invite_log`, `devices`, `security_events`, `audit_log`, `settings`, `orders`, `order_history`, `ideas`, `idea_comments`, `rooms`, `room_members`, `chat_reads`, `files`, `profiles`, `memorials`, `memorial_words`, `events`, `places`, `saved_routes`, `products`, `partners`, `ads`, `i18n_overrides`.

## 4. Drošības un darbības riski
- Esošie konti pēc pārejas uz sesijas sīkdatni būs jāpiesakās vēlreiz (vienreizēji).
- Esošie „rider” konti kļūst par „gaida apstiprinājumu” — administratoram tie jāapstiprina.
- Faili D1 datubāzē: ierobežoti izmēri (attēli ≤ 600 KB pēc saspiešanas, balss ≤ 1,5 MB). Lielākiem apjomiem ieteicams R2.

## 5. Testēšanas plāns
Lokāla Workers izpildvide ar lokālu D1: API testi (lomas, piekļuves liegums, MFA, CSRF, ierobežojumi), pārlūka testi (Playwright) 1440 px un 390 px, valodu atslēgu pārbaude, QR koda dekodēšana, saišu pārbaude.

## 6. Atgriešanās plāns
1. Kods: `main` zars paliek neskarts; atgriešanās = izvietot `main`.
2. Dati: migrācijas ir papildinošas, vecais kods turpina strādāt ar paplašināto shēmu; nepieciešamības gadījumā D1 Time Travel (`wrangler d1 time-travel restore wolves --timestamp …`) vai `backups/*.sql`.
3. Worker versijas: `wrangler rollback`.

## 7. Atvērtie lēmumi (16. sadaļa) — pieņemtie noklusējumi
| # | Lēmums | Noklusējums līdz kluba apstiprinājumam |
|---|---|---|
| 1 | Lomu un pakāpju struktūra | Administrators · Kluba vadība · Member · Prospect · Hang-around · Atbalstītājs — maināms admin panelī |
| 2 | Valodas un redakcionālā valoda | 8 valodas, galvenā — latviešu |
| 3 | Pasākumu un satiksmes avoti | Organizatoru/federāciju oficiālās lapas, manuāla apstiprināšana; satiksmes datu nav |
| 4 | Kartes pakalpojums | OpenStreetMap + OSRM + Overpass (bez maksas, bez atslēgām) |
| 5 | Degvielas cenu avots | EK Weekly Oil Bulletin |
| 6 | Videozvani | Jitsi Meet (saite uz istabu) |
| 7 | Shopify/Printful | Vēl nav pieslēgts; katalogs + pasūtījuma pieteikums |
| 8 | Reklāmas cenas | „Pēc vienošanās” |
| 9 | Biedru datu un Memorials publicēšana | Tikai ar admina apstiprinājumu un atzīmētu piekrišanu |
| 10 | Drošības paziņojumu kanāls | Webhook (`SECURITY_WEBHOOK`), kanāls jāizvēlas |
| 11 | RPO/RTO | RPO ≤ 24 h (D1 Time Travel + eksports pie izvietošanas), RTO ≤ 2 h |
