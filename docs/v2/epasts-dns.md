# E-pasts: SPF, DKIM, DMARC — pārbaudes saraksts

Publiskais kontakts pašlaik: **wolvesmc@inbox.lv**. Tā DNS (SPF/DKIM/DMARC) pārvalda inbox.lv — klubam tur nekas nav jāiestata.

`info@wbmc.com` vietnē **netiek rādīts**: domēns `wbmc.com` (pēc publiskiem datiem) pieder citai organizācijai. Pirms jebkāda lietojuma jāpierāda īpašumtiesības uz domēnu.

## Ja klubs vēlas e-pastu savā domēnā (piem., info@wolvesbrotherhoodmc.com)

1. **Domēns Cloudflare.** Pievieno `wolvesbrotherhoodmc.com` Cloudflare (nameserveri pie reģistratora).
2. **Saņemšana.** Cloudflare Email Routing (bez maksas) — pāradresē `info@…` uz esošo pastkasti. Cloudflare pats pievieno MX un SPF ierakstus.
3. **Sūtīšana** no `info@…` vajag pasta pakalpojumu (piem., Zoho Mail, Google Workspace, Proton). Tas dod savus ierakstus:
   - **SPF** (TXT uz saknes): viens ieraksts, piem. `v=spf1 include:<pakalpojums> ~all`. Nekad divi SPF ieraksti vienlaikus.
   - **DKIM** (TXT/CNAME, ko norāda pakalpojums): `<selector>._domainkey`.
4. **DMARC** (TXT `_dmarc`): sāc ar uzraudzību, pēc 2–4 nedēļām pastiprini:
   - sākums: `v=DMARC1; p=none; rua=mailto:<adrese atskaitēm>`
   - pēc pārbaudes: `p=quarantine`, vēlāk `p=reject`.
5. **Ja domēns e-pastam netiek lietots** — aizsargā to no viltošanas: `v=spf1 -all` un `_dmarc` ar `v=DMARC1; p=reject`.
6. **Pārbaude:** nosūti vēstuli uz Gmail → „Rādīt oriģinālu” → SPF, DKIM, DMARC = PASS. Vai rīks, piem., mail-tester.com.

Vietne pati e-pastus nesūta (saziņas forma un pasūtījumi atver lietotāja e-pasta programmu ar `mailto:`), tāpēc Worker'im e-pasta atslēgas nav vajadzīgas.
