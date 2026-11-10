# WBMC — e-komercijas izvērtējums (specifikācijas 8. sadaļa)

Sagatavots: 2026-11-10 · Cenas pārbaudītas 2026-11-10 (avoti beigās). Visas summas bez PVN, ja nav norādīts citādi. Pirms lēmuma cenas jāpārbauda vēlreiz pakalpojumu oficiālajās lapās — tās mainās.

## 1. Kas ir izdarīts jau tagad (bez veikala aizmugursistēmas)
- **Katalogs vietnē** (`merch.html`), ko pārvalda administrācijas panelī (sadaļa „Merch”): attēli, krāsas ar saviem attēliem, izmēri (nepieejamie atspējoti), materiāls, kopšana, pieejamība, cena, piegāde un atgriešana; 360° skats tikai, ja augšupielādēti īsti kadri (≥ 8).
- **Katram produktam neobligāta ārēja „Pirkt” saite** (`buy_url` + `provider`: Shopify produkts / Printful veikals / Stripe Payment Link / cits). Ja saites nav — poga **„Pieteikt pasūtījumu”** atver e-pastu uz `wolvesmc@inbox.lv` ar aizpildītu produktu, krāsu, izmēru un daudzumu, un skaidri pasaka, ka vietnē maksājumi netiek pieņemti.
- **Karšu dati vietnē netiek ievadīti, apstrādāti vai glabāti** nevienā variantā. Visi zemāk aprakstītie varianti izmanto pakalpojuma sniedzēja mitinātu apmaksas lapu (PCI DSS atbildība paliek pie tā).

Tātad jebkuru no variantiem var ieslēgt, neko nepārbūvējot: pietiek produktam ielikt „Pirkt” saiti.

## 2. Salīdzinājums

| | A. Stripe Payment Links + manuāla izpilde | B. Printful Quick Stores (patstāvīgi) | C. Printful + Shopify | D. Shopify ar savu krājumu |
|---|---|---|---|---|
| Ikmēneša maksa | 0 € | 0 € | Shopify Starter 5 €/mēn. **vai** Basic 32 €/mēn. (24 €/mēn., maksājot par gadu) | kā C |
| Darījuma maksa | 1,5 % + 0,25 € (standarta EEZ kartes); 2,8 % + 0,25 € (premium EEZ); 2,5 % + 0,25 € (UK); 3,15 % + 0,25 € (citas) | Printful lapa maksājumu apstrādes maksu nenorāda — jāpārbauda | Starter: 5 % no darījuma; Basic: Shopify Payments likme (ES likmes jāpārbauda Shopify lapā; trešās puses vārtejai +2 %) | kā C |
| Produkta izmaksas | savs krājums (iepirkums pirms pārdošanas) | Printful bāzes cena + druka + piegāde, atskaitīta no pircēja samaksas | Printful bāzes cena + druka + piegāde (Printful iekasē no kluba par katru pasūtījumu) | savs krājums |
| Krājums | klubs glabā un sūta pats | nav (druka pēc pieprasījuma) | nav (druka pēc pieprasījuma) | klubs glabā |
| Produktu sinhronizācija | nav (katram produktam/variantam sava saite) | Printful katalogs | Printful → Shopify automātiski | manuāli Shopify |
| Pasūtījumu statusi, izsekošana | Stripe panelis + e-pasts, statuss manuāli | Printful | automātiski (Printful nosūta izsekošanu Shopify, Shopify — pircējam) | Shopify, manuāli |
| Piegādes zonas | klubs nosaka pats (pakomāti LV, pasts ES) | Printful zonas | Printful piegādes likmes Shopify (Eiropa, UK u.c.) | Shopify zonas |
| Atgriešana | klubs | Printful sedz tikai savas kļūdas (bojājums, nepareiza druka) — jāpārbauda | kā B; „pārdomāju” atgriešanu sedz pārdevējs (klubs) | klubs |
| Darba apjoms klubam | liels (pasūtīt, iepakot, nosūtīt) | mazs | mazs | liels |
| Kontrole pār zīmolu/dizainu | pilna | ierobežota (Printful veidne) | pilna | pilna |

Piezīmes:
- **Printful izpildes centrs ir Rīgā** (viens no Printful Eiropas centriem) — Baltijas pircējiem tas nozīmē īsu piegādi.
- **Shopify Payments Latvijā ir pieejams** kopš 2025. gada marta.
- **Shopify Starter** dod apmaksas saites un pogas, bet ne pilnu veikala vitrīnu — WBMC vitrīna jau ir šī vietne. Vai Printful lietotne strādā ar Starter plānu, jāpārbauda pirms izvēles.
- **Printful Growth** (24,99 USD/mēn. vai bez maksas pēc 12 000 USD gada apgrozījuma) nav vajadzīgs sākumā.
- **Stripe Tax** (0,5 % no darījuma bez koda integrācijām) vajadzīgs tikai tad, ja biedrība ir PVN reģistrēta vairākās valstīs.

## 3. PVN un nodokļi biedrībai (jāapstiprina grāmatvedim)
- Merch tirdzniecība ir biedrības **saimnieciskā darbība** — jāuzskaita atsevišķi un jāpārbauda, kā tā ietekmē nodokļus (t. sk. statusu, ja biedrībai ir sabiedriskā labuma organizācijas statuss).
- Latvijas standarta PVN likme: **21 %**.
- **PVN reģistrācija Latvijā**: vietējo reģistrācijas slieksni un to, vai biedrībai jāreģistrējas, jāapstiprina ar VID vai grāmatvedi (avots, kas pārbaudīts šim dokumentam, slieksni nenorāda).
- **Tālpārdošana citu ES valstu patērētājiem**: kamēr kopējā ES tālpārdošana nepārsniedz **10 000 € gadā**, piemēro Latvijas PVN noteikumus; virs šī sliekšņa PVN maksājams pircēja valstī, deklarējot caur **OSS** (vienas pieturas aģentūru).
- Ar Printful (B un C) jānoskaidro, **kurš ir pārdevējs** (merchant of record) un kā Printful rēķina PVN par saviem pakalpojumiem klubam. Quick Stores palīdzības lapa to nenorāda.
- Pārdošana ārpus ES (UK, Norvēģija): pircējam muitas maksājumi — produkta lapā tas jāpasaka.

## 4. Atgriešana
- ES distances līgumiem patērētājam parasti ir **14 dienu atteikuma tiesības**. Izņēmums attiecas uz precēm, kas izgatavotas pēc patērētāja specifikācijas vai personalizētas; standarta dizains, kas drukāts pēc pieprasījuma, parasti par personalizētu netiek uzskatīts. Precīzu formulējumu produktu lapām jāapstiprina juristam/valdei.
- Admin panelī katram produktam ir laukums „Atgriešana” (8 valodās). Kamēr tas tukšs, lapa godīgi saka, ka nosacījumus klubs norādīs, atbildot uz pasūtījumu — izdomāti noteikumi netiek publicēti.

## 5. Datu plūsma
**Tagad (pieteikums pa e-pastu):** pircējs → `merch.html` → poga atver e-pastu (produkts, krāsa, izmērs, daudzums) → `wolvesmc@inbox.lv` → klubs atbild ar kopsummu un rekvizītiem (Atbalsta lapas biedrības konts) → apmaksa bankā → klubs nosūta preci. Vietne nesaglabā pircēja datus.

**A (Stripe Payment Links):** produkta „Pirkt” → Stripe mitināta apmaksas lapa (piegādes adrese, izmērs kā Stripe pielāgots lauks — iestatīšanā jāpārbauda) → Stripe e-pasta paziņojums klubam → klubs izpilda pasūtījumu → izmaksa uz biedrības kontu. WBMC vietne saņem tikai saiti.

**B (Printful Quick Stores):** produkta „Pirkt” → Printful veikala lapa → apmaksa Printful pusē → Printful drukā Rīgā/ES un nosūta → peļņa (mazumcena − bāzes cena − piegāde) klubam reizi mēnesī, ja > 25 USD.

**C (Printful + Shopify):** Printful produkti sinhronizējas uz Shopify → WBMC „Pirkt” ved uz Shopify produkta lapu → apmaksa Shopify → pasūtījums automātiski Printful → izsekošana Shopify → pircējam. Pēc vajadzības vēlāk: Shopify Storefront API, lai katalogu WBMC vietnē lasītu automātiski (tad `products` tabula kļūst par kešu) — nav vajadzīgs sākumā.

## 6. Ieteikums
1. **Tagad**: atstāt pašreizējo risinājumu (katalogs + pasūtījuma pieteikums). Bez ikmēneša izmaksām; ļauj saprast pieprasījumu, pirms tiek iepirkts krājums vai maksāti abonementi.
2. **Pirmie tirdzniecības mēneši** (maz pasūtījumu): **Printful drukas izpilde + Stripe Payment Link** katram produktam. 0 €/mēn., zemākā darījuma maksa (EEZ kartēm 1,5 % + 0,25 €), nav krājuma; Printful pasūtījumu klubs izveido manuāli pēc Stripe paziņojuma. Saites ievieto admin panelī — kods nav jāmaina.
3. **Ja pasūtījumu kļūst daudz** (orientējoši vairāk par 20–30 mēnesī) vai pieprasījums ir ārpus Baltijas: **Shopify Basic + Printful lietotne** — automātiska sinhronizācija, statusi, izsekošana, piegādes likmes; WBMC vietnē „Pirkt” saites uz Shopify produktiem.
4. **Printful Quick Stores** izmantot tikai pēc tam, kad Printful rakstiski apstiprina, kurš ir pārdevējs un kā tiek rēķināts PVN.
5. **Neizmantot** variantus ar savu krājumu (A ar iepirkumu, D), kamēr nav pierādīts pieprasījums.

## 7. Lēmumi, kas jāpieņem klubam
- Vai merch pārdod biedrība (saimnieciskā darbība) — grāmatveža atzinums par PVN un nodokļiem.
- Kuri dizaini drīkst būt pārdošanā (pilnās kluba krāsas netiek pārdotas).
- Cenas katram produktam (vietnē tiek rādīta tikai admin panelī ievadītā cena).
- Piegādes zonas (tikai Latvija / Baltija / ES) un atgriešanas noteikumu teksts.
- Kurš apstrādā pasūtījuma pieteikumus `wolvesmc@inbox.lv` un cik ātri atbild.
- Kad un kuru variantu (A/B/C) ieslēgt.

## Avoti (pārbaudīti 2026-11-10)
- Shopify plāni un likmes (pārbaudīts pret Shopify cenu lapu 2026. g. maijā, atjaunots 2026-08-28): https://craftshift.com/shopify-pricing-plans-2026-complete-breakdown/
- Shopify Payments pieejams Latvijā (2025-03-21): https://changelog.shopify.com/posts/shopify-payments-available-in-14-additional-european-countries
- Printful cenas, Growth, Rīgas izpildes centrs (atjaunots 2026-09-22): https://www.stylefactoryproductions.com/blog/printful-pricing
- Printful Quick Stores izmaksas: https://help.printful.com/hc/en-us/articles/15045650586780-How-much-does-using-Quick-Stores-cost
- Stripe cenas EEZ uzņēmumiem (Igaunijas lapa; Latvijai tā pati EEZ shēma — pirms reģistrācijas pārbaudīt LV lapu), Payment Links, Stripe Tax: https://stripe.com/ee/pricing
- Stripe EEZ likmes (publicēts 2026-04-21, atjaunots 2026-09-09): https://checkoutpage.com/blog/stripe-international-fees
- Latvijas PVN likme un ES tālpārdošanas slieksnis (atjaunots 2026-09-22): https://trykintsugi.com/sales-tax-guides/europe/latvia
