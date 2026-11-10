# WBMC QR kods

Kods ved uz **https://wolvesbrotherhoodmc.com/qr** (kļūdu labošana H, versija 4).
`/qr` ir pārvaldīta pāradresācija Worker pusē: mērķi maina administrācijā → Iestatījumi → „QR mērķis” (noklusējums — sākumlapa).
Tāpēc drukātos materiālus nekad nevajag pārdrukāt, ja mainās lapas struktūra.

| Fails | Lietojums |
|---|---|
| `wbmc-qr.svg` | vektors, melns uz balta (druka, dizaina programmas) |
| `wbmc-qr-negative.svg` | kaula balts uz melna (tumšs fons, ekrāns) |
| `wbmc-qr.png` / `wbmc-qr-negative.png` | 1968 × 1968 px rastrs |
| `wbmc-qr.pdf` | vektora PDF |
| `wbmc-qr-kartite-A6.pdf` | gatava drukas kartīte 105 × 148 mm ar logo (`card.html` — avots) |

Visi faili pārbaudīti ar OpenCV dekoderi (2026-11-10).
Svarīgi: kods strādās tikai pēc tam, kad domēns `wolvesbrotherhoodmc.com` būs pieslēgts Cloudflare (sk. `wrangler.jsonc` routes).
Minimālais drukas izmērs: 2 × 2 cm, ap kodu atstāj balto malu (jau iekļauta).
