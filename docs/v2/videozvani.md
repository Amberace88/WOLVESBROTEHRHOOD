# Videozvani saziņā — izvērtējums un ieviešana

Specifikācijas 6. sadaļa: izvērtēt drošu trešās puses WebRTC/video pakalpojumu privātiem un grupu zvaniem (šifrēšana, dalībnieku limiti, izmaksas, datu glabāšana, piekļuves kontrole, mobilo pārlūku atbalsts) un **neveidot savu video infrastruktūru**.

Fakti pārbaudīti 2026-11-10 (avoti beigās). Pakalpojumu noteikumi mainās — pirms kluba lēmuma pārbaudiet vēlreiz.

## Ieteikums (noklusējums līdz kluba lēmumam)

**Jitsi Meet** (atvērtā koda, bez maksas), sākumā publiskajā instancē `meet.jit.si`, zvans **atveras jaunā cilnē**. Ja klubam vajag iegultu zvanu, stingru piekļuves kontroli vai datus ES serverī — pāriet uz **JaaS (8x8)** vai **pašu uzturētu Jitsi**; vietnes kods tam jāmaina minimāli (sk. „Pāreja”).

## Salīdzinājums

| Kritērijs | meet.jit.si (publisks) | JaaS — 8x8 „Jitsi as a Service” | Pašu uzturēts Jitsi |
|---|---|---|---|
| Transporta šifrēšana | Jā — WebRTC (DTLS-SRTP) līdz serverim; serveris (videotilts) redz atšifrētu plūsmu | Tāpat | Tāpat; serveris ir kluba kontrolē |
| E2EE (pilna) | Pēc izvēles, ieslēdz telpas drošības iestatījumos. Darbojas pārlūkos ar *Insertable Streams* (Chrome, Edge, Safari); Firefox — nē. Nedarbojas kopā ar ierakstīšanu/straumēšanu | Tāpat | Tāpat |
| Pieteikšanās | Kopš 2023-08-24 telpas izveidotājam (pirmajam) jāienāk ar Google, Facebook vai GitHub kontu; pārējiem konts nav vajadzīgs | Piekļuve ar JWT — Worker var parakstīt žetonu tikai sarunas dalībniekiem | Var ieslēgt JWT vai paroles autentifikāciju |
| Laika / dalībnieku limiti | Ziņots (2026-10, Jitsi paziņojums, citēts forumā): sapulces ierobežotas līdz **95 min**. Vēsturiski minēts ≈75 dalībnieku maksimums, kvalitāte krīt virs ≈30 | Limits pēc mēneša aktīvajiem lietotājiem (MAU), sapulces dalībnieku limits cenrādī nav norādīts | Atkarīgs no servera jaudas |
| Izmaksas | Bez maksas | Developer: 25 MAU bez maksas; Basic: 300 MAU — 99 USD/mēn.; virs limita 0,99 USD par MAU; ierakstīšana 0,01 USD/min | Servera noma (cena atkarīga no nodrošinātāja) + uzturēšanas laiks |
| Datu glabāšana | Pēc Jitsi privātuma pielikuma: zvana dati (IP, ilgums, čats) apstrādāti zvana laikā, ieraksti tikai, ja kāds ieraksta. Operators — 8x8 | 8x8; ieraksti 8x8 krātuvē, ja tiek ierakstīts | Viss kluba serverī (var izvēlēties ES datu centru) |
| Iegulšana vietnē | Iespējama (iframe), bet publiskā instance nav paredzēta produkcijas iegulšanai — tāpēc atveram jaunā cilnē | Paredzēta iegulšanai, domēns `8x8.vc` | Pilnībā |
| Mobilie pārlūki | Strādā Chrome/Safari mobilajā pārlūkā; Jitsi piedāvā arī lietotnes | Tāpat | Tāpat |

Citas komerciālas WebRTC platformas (Daily, Whereby, Twilio u.c.) prasa API atslēgas, maksas plānus un datu apstrādes līgumu; Jitsi ir vienīgais variants ar bezmaksas sākumu, atvērtu kodu un iespēju vēlāk pārcelt uz savu serveri bez lietotāju pārmācīšanas.

## Ieviestais risinājums

- Poga **„Sākt videozvanu”** privātajā sarunā, grupā vai kanālā (sarunas galvenē un informācijas panelī).
- `POST /api/comms/rooms/:id/video` — serveris pārbauda, ka lietotājs drīkst rakstīt šajā sarunā, un vienreiz izveido neuzminamu istabas nosaukumu `wbmc-<24 nejaušas zīmes [0-9a-z]>` (≈124 biti), kas glabājas `rooms.video_room`. Saiti redz un saņem **tikai sarunas dalībnieki** (citiem — 403).
- Sarunā tiek ierakstīta sistēmas ziņa „… sāka videozvanu” ar pogu „Pievienoties zvanam” (ne biežāk kā reizi 10 minūtēs).
- Zvans atveras **jaunā cilnē** (strādā arī mobilajā pārlūkā; logs tiek atvērts uzreiz pēc klikšķa, lai pārlūks to nebloķē). Vietnes CSP jau atļauj `frame-src https://meet.jit.si` un kameras/mikrofona deleģēšanu, ja vēlāk izvēlēsies iegult.
- Jitsi domēnu var mainīt ar Worker mainīgo `JITSI_BASE` (noklusējums `https://meet.jit.si`).

## Zināmie ierobežojumi

1. **Saite = piekļuve.** Publiskajā instancē Jitsi nepārbauda kluba dalību: kas saņēmis saiti, var pievienoties. Mazinājums: saite ir neuzminama un redzama tikai dalībniekiem; zvana moderators Jitsi saskarnē var ieslēgt **vestibilu (lobby)** un **paroli**. Pilnīga piekļuves kontrole — tikai ar JaaS vai pašu Jitsi + JWT.
2. Pirmajam dalībniekam meet.jit.si prasa Google/GitHub/Facebook kontu (Jitsi noteikums, ne vietnes).
3. Ziņotais 95 minūšu limits uz sapulci publiskajā instancē.
4. Istabas saites nomaiņa (ja tā noplūdusi) vēl nav pieejama saskarnē — nākamais solis: administratora poga „Jauna videozvana saite” (`UPDATE rooms SET video_room = NULL`).

## Pāreja uz JaaS vai pašu Jitsi

1. Iestatīt `JITSI_BASE` (piem., `https://8x8.vc/<AppID>` vai `https://meet.klubs.lv`).
2. CSP `frame-src` un `Permissions-Policy` (`worker/src/index.js`) pievienot jauno domēnu — tikai, ja zvans tiks iegults.
3. JWT piekļuvei: Worker galapunktā `/video` parakstīt īslaicīgu žetonu (RS256 JaaS gadījumā) ar istabas nosaukumu un lietotāja vārdu, pievienot saitei `?jwt=…`. Pārbaude „vai lietotājs ir sarunas dalībnieks” jau notiek serverī.

## Lēmums klubam

- [ ] Paliekam pie meet.jit.si (bez maksas, jaunā cilnē) — **pašreizējais noklusējums**
- [ ] JaaS Developer (līdz 25 aktīviem lietotājiem mēnesī bez maksas, ar JWT piekļuvi)
- [ ] Pašu Jitsi serveris ES (pilna datu kontrole, uzturēšanas darbs)

## Avoti

- Jitsi pieteikšanās prasība: [TechRadar — „Jitsi Meet ditches anonymity”](https://www.techradar.com/computing/cyber-security/privacy-first-app-jitsi-meet-ditches-anonymityheres-why); [Privacy Guides forums](https://discuss.privacyguides.net/t/jitsi-meet-no-longer-works-without-an-account-authentication/13779)
- 95 minūšu limits: [Privacy Guides forums, 2026-10](https://discuss.privacyguides.net/t/jitsi-limits-calls-to-95-min/41435) (citē Jitsi paziņojumu)
- E2EE darbība un pārlūki: [lib-jitsi-meet E2EE ceļvedis](https://www.mintlify.com/jitsi/lib-jitsi-meet/guides/end-to-end-encryption); [Mozilla *Privacy Not Included*](https://www.mozillafoundation.org/en/privacynotincluded/jitsimeet/)
- Datu apstrāde un dalībnieku skaits: [Freedom of the Press Foundation](https://freedom.press/digisec/blog/what-we-know-jitsi-meet/) (raksts vairs netiek uzturēts)
- JaaS cenas: [8x8 JaaS cenrādis](https://cpaas.8x8.com/en/pricing/jitsi-as-a-service-pricing/); JaaS domēns `8x8.vc`: [8x8 IFrame API](https://developer.8x8.com/jaas/docs/iframe-api-overview)
