# Rezerves kopijas un atjaunošana

Mērķi (pieņemti pēc noklusējuma, klubs var mainīt): **RPO ≤ 24 h** (zaudējam ne vairāk kā diennakts datus), **RTO ≤ 2 h** (lapa atjaunota divu stundu laikā).

## Kas tiek kopēts
- **D1 datubāze `wolves`** — konti, lomas, pasākumi, saziņa, profili, Memorials, faili (attēli glabājas D1), audits.
- Kods un saturs — Git repozitorijā (GitHub). Repozitoriju ieteicams padarīt **privātu**.

## Automātiski
1. **Cloudflare D1 Time Travel** — D1 glabā izmaiņu vēsturi 30 dienas (Workers Paid). Atjaunošana uz jebkuru minūti:
   `npx wrangler d1 time-travel info wolves` → `npx wrangler d1 time-travel restore wolves --timestamp=<UNIX vai ISO>`
2. **Pirms katras izvietošanas** `scripts/deploy-demo.sh` izveido pilnu SQL kopiju `backups/wolves-<datums>.sql` un ieraksta laiku iestatījumā `last_backup` (redzams Security Center).

## Manuāli (ieteicams reizi nedēļā)
```bash
npx wrangler d1 export wolves --remote --output backups/wolves-$(date +%Y%m%d).sql
```
Kopijas glabā šifrētā vietā (piem., šifrēts disks / 1Password dokuments). Tajās ir biedru dati — nekad tās nekomitē Git.

## Atjaunošana no SQL faila (avārijas gadījumā)
1. Izveido jaunu tukšu datubāzi: `npx wrangler d1 create wolves-restore`
2. Ielādē kopiju: `npx wrangler d1 execute wolves-restore --remote --file backups/wolves-<datums>.sql`
3. `wrangler.jsonc` nomaini `database_id` uz jauno ID un izvieto (`bash scripts/deploy-demo.sh`).
4. Pārbaudi: pieslēgšanās, Security Center, pasākumu saraksts. Pēc tam veco DB dzēš tikai ar valdes atļauju.

## Pārbaude
Reizi ceturksnī atjauno pēdējo kopiju testa DB (`wolves-restore`) un pārliecinies, ka lapa ar to strādā. Ieraksti datumu šeit.

| Datums | Kas pārbaudīja | Rezultāts |
|---|---|---|
| | | |
