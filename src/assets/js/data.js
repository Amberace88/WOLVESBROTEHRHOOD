/* =====================================================================
   WBMC — kluba saturs (viss rediģējamais saturs šeit)
   Teksti var būt vienkārša virkne vai objekts pa valodām:
     { lv:"…", en:"…", ru:"…", de:"…", lt:"…", et:"…", no:"…", fr:"…" }
   Trūkstošā valodā rāda EN, tad LV.
   `sample: true` = paraugs (lapā redzama atzīme). Kad ieraksts īsts — izdzēs.
   ===================================================================== */
window.CLUB = {
  name: "WBMC",
  email: "wolvesmc@inbox.lv",                    // publiskā kontaktadrese (info@wbmc.com netiek publicēta, kamēr nav apstiprinātas domēna īpašumtiesības)
  founded: { date: null, year: 1999 },          // TODO: precīzs dibināšanas datums "MM-DD"
  homeBase: { name: "Rīga", lat: 56.9496, lon: 24.1052 },
  api: "/api",                                   // Cloudflare Worker API. Ja neatbild — lapa strādā demo režīmā
  socials: { instagram: "", facebook: "https://www.facebook.com/WolvesBrotherhoodMc/about", youtube: "" },
  legal: { name: "WBMC BIEDRĪBA", regNo: "40008360087", registered: "2026-05-12", address: "Jaunciema gatve 147-1, Rīga, LV-1023" }
};

/* ---------------- Kluba pasākumi ---------------- */
window.EVENTS = []; // kluba pasākumi tagad tiek pārvaldīti admin panelī (Moto pasākumi)

/* ---------------- Svētā dienasgrāmata ---------------- */
window.DIARY = [
  { date: "2026-10-04", author: "Road Captain", place: { lv: "Gaujas senleja", en: "Gauja valley", ru: "Долина Гауи", de: "Gauja-Tal" }, km: 214, sample: true,
    title: { lv: "Rudens zelts", en: "Autumn gold", ru: "Осеннее золото", de: "Herbstgold", lt: "Rudens auksas", et: "Sügiskuld", no: "Høstgull", fr: "L'or de l'automne" },
    text: { lv: "Izbraucām agri, kamēr migla vēl gulēja lejās. Pie Līgatnes pagriezieniem bars savilkās ciešāk, neviens neskrēja pa priekšu. Cēsīs kafija, atpakaļceļā pirmās lietus lāses — bet mājās visi kopā, kā vienmēr.",
      en: "We left early while the fog still lay in the valleys. On the Līgatne bends the pack pulled tighter, nobody ran ahead. Coffee in Cēsis, the first raindrops on the way back — but everyone home together, as always.",
      ru: "Выехали рано, пока туман ещё лежал в низинах. На поворотах у Лигатне стая сомкнулась, никто не рвался вперёд. Кофе в Цесисе, первые капли дождя на обратном пути — но домой все вместе, как всегда.",
      de: "Wir fuhren früh los, als der Nebel noch in den Tälern lag. In den Kurven bei Līgatne rückte das Rudel enger zusammen, keiner preschte vor. Kaffee in Cēsis, auf dem Rückweg die ersten Regentropfen — aber alle gemeinsam zu Hause, wie immer." } },
  { date: "2026-08-23", author: "President", place: { lv: "Baltijas ceļš", en: "Baltic Way", ru: "Балтийский путь", de: "Baltischer Weg" }, km: 168, sample: true,
    title: { lv: "Sadotām rokām", en: "Hand in hand", ru: "Рука об руку", de: "Hand in Hand", lt: "Susikibę rankomis", et: "Käsikäes", no: "Hånd i hånd", fr: "Main dans la main" },
    text: { lv: "Šajā dienā mūsu vecāki stāvēja uz šosejas sadevušies rokās. Mēs nobraucām to pašu ceļu klusumā. Brālība nav tikai motocikli — tā ir atmiņa, ko nesam tālāk.",
      en: "On this day our parents stood on the highway holding hands. We rode the same road in silence. Brotherhood is not just motorcycles — it is memory we carry on.",
      ru: "В этот день наши родители стояли на шоссе, взявшись за руки. Мы проехали ту же дорогу в тишине. Братство — это не только мотоциклы, это память, которую мы несём дальше.",
      de: "An diesem Tag standen unsere Eltern Hand in Hand an der Landstraße. Wir fuhren dieselbe Strecke in Stille. Bruderschaft ist nicht nur Motorräder — es ist Erinnerung, die wir weitertragen." } },
  { date: "2026-06-23", author: "Secretary", place: { lv: "Kluba mājas", en: "Clubhouse", ru: "Клуб", de: "Clubhaus" }, km: 0, sample: true,
    title: { lv: "Līgo nakts", en: "Midsummer night", ru: "Ночь Лиго", de: "Mittsommernacht", lt: "Joninių naktis", et: "Jaaniöö", no: "Sankthansnatt", fr: "Nuit de la Saint-Jean" },
    text: { lv: "Ugunskurs, siers un motoru rūkoņa līdz rītausmai. Jaunie prospekti pirmo reizi turēja nakts sardzi pie motocikliem.",
      en: "Bonfire, caraway cheese and the rumble of engines until dawn. The new prospects stood night watch over the bikes for the first time.",
      ru: "Костёр, сыр и рокот моторов до рассвета. Новые проспекты впервые несли ночной дозор у мотоциклов.",
      de: "Lagerfeuer, Kümmelkäse und Motorengrollen bis zum Morgengrauen. Die neuen Prospects hielten zum ersten Mal Nachtwache bei den Maschinen." } },
  { date: "2026-04-25", author: "Sergeant at Arms", place: "Rīga", km: 96, sample: true,
    title: { lv: "Sezona sākas", en: "The season begins", ru: "Сезон начинается", de: "Die Saison beginnt", lt: "Sezonas prasideda", et: "Hooaeg algab", no: "Sesongen begynner", fr: "La saison commence" },
    text: { lv: "Ziema bija gara. Pārbaudījām riepas, ķēdes, bremzes. Pirmais kopīgais aplis pa pilsētu, un tad ārā uz Jūrmalas šoseju. Vilki ir atpakaļ uz ceļa.",
      en: "Winter was long. We checked tyres, chains, brakes. The first lap through the city together, then out onto the Jūrmala highway. The wolves are back on the road.",
      ru: "Зима была долгой. Проверили шины, цепи, тормоза. Первый совместный круг по городу, а потом — на Юрмальское шоссе. Волки снова на дороге.",
      de: "Der Winter war lang. Reifen, Ketten, Bremsen geprüft. Die erste gemeinsame Runde durch die Stadt, dann raus auf die Jūrmala-Chaussee. Die Wölfe sind zurück auf der Straße." } }
];

/* ---------------- Hronika ---------------- */
window.HISTORY = [
  { year: "1999",
    title: { lv: "Klubs dibināts", en: "The club is founded", ru: "Основание клуба", de: "Gründung des Clubs", lt: "Klubas įkurtas", et: "Klubi asutamine", no: "Klubben grunnlegges", fr: "Fondation du club" },
    text: { lv: "WBMC — Latvijas motociklu klubs kopš 1999. gada.", en: "WBMC — a Latvian motorcycle club since 1999.", ru: "WBMC — латвийский мотоклуб с 1999 года.", de: "WBMC — ein lettischer Motorradclub seit 1999.", lt: "WBMC — Latvijos motociklų klubas nuo 1999 metų.", et: "WBMC — Läti mootorrattaklubi aastast 1999.", no: "WBMC — en latvisk motorsykkelklubb siden 1999.", fr: "WBMC — club de moto letton depuis 1999." } },
  { year: "2026",
    title: { lv: "WBMC biedrība", en: "WBMC association", ru: "Общество WBMC", de: "Verein WBMC", lt: "WBMC draugija", et: "WBMC ühing", no: "WBMC-foreningen", fr: "Association WBMC" },
    text: { lv: "Klubs reģistrēts kā biedrība (reģ. nr. 40008360087).", en: "The club is registered as an association (reg. no. 40008360087).", ru: "Клуб зарегистрирован как общество (рег. № 40008360087).", de: "Der Club ist als Verein eingetragen (Reg.-Nr. 40008360087).", lt: "Klubas įregistruotas kaip draugija (reg. nr. 40008360087).", et: "Klubi on registreeritud ühinguna (reg-nr 40008360087).", no: "Klubben er registrert som forening (org.nr. 40008360087).", fr: "Le club est enregistré comme association (n° 40008360087)." } }
];

/* ---------------- Biedri ---------------- */
window.MEMBERS = [
  { role: "President", name: null, road: null },
  { role: "Vice President", name: null, road: null },
  { role: "Sergeant at Arms", name: null, road: null },
  { role: "Road Captain", name: null, road: null },
  { role: "Secretary", name: null, road: null },
  { role: "Treasurer", name: null, road: null },
  { role: "Member", name: null, road: null, count: 8 },
  { role: "Prospect", name: null, road: null, count: 2 }
];

/* ---------------- Kluba maršruti ---------------- */
window.ROUTES = [
  { id: "gauja", name: { lv: "Gaujas loks", en: "Gauja loop", ru: "Петля Гауи", de: "Gauja-Runde", lt: "Gaujos ratas", et: "Koiva ring", no: "Gauja-runden", fr: "Boucle de la Gauja" }, region: "Vidzeme", km: 260, level: "easy",
    text: { lv: "Sigulda, Līgatnes serpentīni, Cēsis un atpakaļ gar jūru caur Saulkrastiem.", en: "Sigulda, the Līgatne bends, Cēsis and back along the sea via Saulkrasti.", ru: "Сигулда, серпантины Лигатне, Цесис и обратно вдоль моря через Саулкрасты.", de: "Sigulda, die Kurven von Līgatne, Cēsis und zurück an der Küste über Saulkrasti.", lt: "Sigulda, Līgatnės serpantinai, Cėsis ir atgal pajūriu per Saulkrastus.", et: "Sigulda, Līgatne kurvid, Võnnu ja tagasi mööda rannikut läbi Saulkrasti.", no: "Sigulda, svingene ved Līgatne, Cēsis og tilbake langs kysten via Saulkrasti.", fr: "Sigulda, les lacets de Līgatne, Cēsis et retour par la côte via Saulkrasti." },
    pts: [[56.9496,24.1052],[57.1537,24.8530],[57.2340,25.0420],[57.3119,25.2697],[57.5385,25.4264],[57.5133,24.7213],[57.2556,24.4128],[56.9496,24.1052]] },
  { id: "kolka", name: { lv: "Kurzemes krasts", en: "Courland coast", ru: "Побережье Курземе", de: "Kurland-Küste", lt: "Kuršo pakrantė", et: "Kuramaa rannik", no: "Kurland-kysten", fr: "Côte de Courlande" }, region: "Kurzeme", km: 330, level: "medium",
    text: { lv: "Jūrmala, Tukums, Talsi, Roja un Kolkasrags, noslēgumā Ventspils.", en: "Jūrmala, Tukums, Talsi, Roja and Cape Kolka, finishing in Ventspils.", ru: "Юрмала, Тукумс, Талси, Роя и мыс Колка, финиш в Вентспилсе.", de: "Jūrmala, Tukums, Talsi, Roja und Kap Kolka, Ziel in Ventspils.", lt: "Jūrmala, Tukumas, Talsai, Roja ir Kolkos ragas, finišas Ventspilyje.", et: "Jūrmala, Tukums, Talsi, Roja ja Kolka neem, lõpp Ventspilsis.", no: "Jūrmala, Tukums, Talsi, Roja og Kolka-neset, mål i Ventspils.", fr: "Jūrmala, Tukums, Talsi, Roja et le cap Kolka, arrivée à Ventspils." },
    pts: [[56.9496,24.1052],[56.9680,23.7700],[56.9670,23.1550],[57.2450,22.5870],[57.5070,22.8030],[57.7570,22.5920],[57.3894,21.5606]] },
  { id: "latgale", name: { lv: "Latgales ezeri", en: "Latgale lakes", ru: "Озёра Латгалии", de: "Lettgallische Seen", lt: "Latgalos ežerai", et: "Latgale järved", no: "Latgale-sjøene", fr: "Lacs de Latgale" }, region: "Latgale", km: 290, level: "medium",
    text: { lv: "Daugavpils, Krāslava gar Daugavu, Dagda, Rāznas ezers, Ludza un Rēzekne.", en: "Daugavpils, Krāslava along the Daugava, Dagda, Lake Rāzna, Ludza and Rēzekne.", ru: "Даугавпилс, Краслава вдоль Даугавы, Дагда, озеро Резна, Лудза и Резекне.", de: "Daugavpils, Krāslava an der Düna, Dagda, Rāzna-See, Ludza und Rēzekne.", lt: "Daugpilis, Kraslava prie Dauguvos, Dagda, Rėznos ežeras, Ludza ir Rėzeknė.", et: "Daugavpils, Krāslava Väina ääres, Dagda, Rāzna järv, Ludza ja Rēzekne.", no: "Daugavpils, Krāslava langs Daugava, Dagda, Rāzna-sjøen, Ludza og Rēzekne.", fr: "Daugavpils, Krāslava le long de la Daugava, Dagda, le lac Rāzna, Ludza et Rēzekne." },
    pts: [[55.8740,26.5360],[55.8950,27.1680],[56.0950,27.5370],[56.3300,27.4800],[56.5460,27.7190],[56.5100,27.3300]] },
  { id: "kurzeme", name: { lv: "Kuldīga un Liepāja", en: "Kuldīga & Liepāja", ru: "Кулдига и Лиепая", de: "Kuldīga & Liepāja", lt: "Kuldyga ir Liepoja", et: "Kuldīga ja Liepāja", no: "Kuldīga og Liepāja", fr: "Kuldīga et Liepāja" }, region: "Kurzeme", km: 410, level: "long",
    text: { lv: "Ventas rumba Kuldīgā, Aizputes ceļi un vējš Liepājas jūrmalā.", en: "The Venta rapid in Kuldīga, the roads of Aizpute and the wind on Liepāja's seafront.", ru: "Водопад Вентас румба в Кулдиге, дороги Айзпуте и ветер на взморье Лиепаи.", de: "Der Venta-Wasserfall in Kuldīga, die Straßen um Aizpute und der Wind an Liepājas Küste.", lt: "Ventos slenkstis Kuldygoje, Aizputės keliai ir vėjas Liepojos pajūryje.", et: "Venta juga Kuldīgas, Aizpute teed ja tuul Liepāja rannas.", no: "Venta-fossen i Kuldīga, veiene rundt Aizpute og vinden ved Liepāja.", fr: "La chute de la Venta à Kuldīga, les routes d'Aizpute et le vent du front de mer de Liepāja." },
    pts: [[56.9496,24.1052],[56.6510,23.7200],[56.9680,21.9680],[56.7200,21.6000],[56.5050,21.0110]] },
  { id: "augstiene", name: { lv: "Vidzemes augstiene", en: "Vidzeme uplands", ru: "Видземская возвышенность", de: "Livländisches Hochland", lt: "Vidžemės aukštuma", et: "Vidzeme kõrgustik", no: "Vidzeme-høylandet", fr: "Hautes terres de Vidzeme" }, region: "Vidzeme", km: 380, level: "medium",
    text: { lv: "Ērgļi, Gaiziņkalns, Madona, Cesvaine un Alūksnes ezers — kalni un līkumi.", en: "Ērgļi, Gaiziņkalns, Madona, Cesvaine and Lake Alūksne — hills and curves.", ru: "Эргли, Гайзинькалнс, Мадона, Цесвайне и озеро Алуксне — холмы и повороты.", de: "Ērgļi, Gaiziņkalns, Madona, Cesvaine und Alūksne-See — Hügel und Kurven.", lt: "Ērgļi, Gaizinio kalnas, Madona, Cesvainė ir Alūksnės ežeras — kalvos ir vingiai.", et: "Ērgļi, Gaiziņkalns, Madona, Cesvaine ja Alūksne järv — mäed ja kurvid.", no: "Ērgļi, Gaiziņkalns, Madona, Cesvaine og Alūksne-sjøen — bakker og svinger.", fr: "Ērgļi, Gaiziņkalns, Madona, Cesvaine et le lac d'Alūksne — collines et virages." },
    pts: [[56.9496,24.1052],[56.8970,25.6400],[56.8710,25.9630],[56.8530,26.2170],[56.9670,26.3100],[57.1770,26.7500],[57.4220,27.0470]] },
  { id: "zemgale", name: { lv: "Zemgales pilis", en: "Zemgale palaces", ru: "Замки Земгале", de: "Semgallische Schlösser", lt: "Žiemgalos rūmai", et: "Zemgale lossid", no: "Zemgale-slottene", fr: "Châteaux de Zemgale" }, region: "Zemgale", km: 170, level: "easy",
    text: { lv: "Jelgavas pils, Rundāle, Bauska un atpakaļ caur Iecavu. Ideāls pusdienas brauciens.", en: "Jelgava Palace, Rundāle, Bauska and back via Iecava. A perfect half-day ride.", ru: "Елгавский дворец, Рундале, Бауска и обратно через Иецаву. Идеальная поездка на полдня.", de: "Schloss Jelgava, Rundāle, Bauska und zurück über Iecava. Die perfekte Halbtagestour.", lt: "Jelgavos rūmai, Rundālė, Bauskė ir atgal per Iecavą. Puikus pusdienio važiavimas.", et: "Jelgava loss, Rundāle, Bauska ja tagasi läbi Iecava. Ideaalne poolepäevasõit.", no: "Jelgava slott, Rundāle, Bauska og tilbake via Iecava. Den perfekte halvdagsturen.", fr: "Le palais de Jelgava, Rundāle, Bauska et retour par Iecava. La balade idéale d'une demi-journée." },
    pts: [[56.9496,24.1052],[56.6510,23.7200],[56.4140,24.0250],[56.4080,24.1930],[56.5960,24.2050],[56.9496,24.1052]] }
];

/* ---------------- Galerija ---------------- */
window.GALLERY = [
  { src: "assets/img/brotherhood.jpg", span: "big", w: 1206, h: 877, album: "pack", alt: { lv: "Brāļi ar motocikliem, slapjā kolodija fotogrāfija", en: "The brothers with their bikes, wet-plate collodion photo", ru: "Братья с мотоциклами, фото мокрым коллодием", de: "Die Brüder mit ihren Maschinen, Nassplatten-Kollodium-Foto" } },
  { src: "assets/img/g-bikes.jpg", span: "wide", w: 900, h: 391, album: "pack", alt: { lv: "Motocikli pie kluba sienas", en: "Bikes by the clubhouse wall", ru: "Мотоциклы у стены клуба", de: "Maschinen an der Clubhauswand" } },
  { src: "assets/img/g-pack.jpg", w: 900, h: 627, album: "pack", alt: { lv: "Brāļi stāv rindā", en: "The brothers lined up", ru: "Братья в ряд", de: "Die Brüder in einer Reihe" } },
  { src: "assets/img/g-factory.jpg", span: "wide", w: 900, h: 298, album: "places", alt: { lv: "Rūpnīcas jumti virs kluba vietas", en: "Factory roofs above the club grounds", ru: "Крыши завода над территорией клуба", de: "Fabrikdächer über dem Clubgelände" } },
  { src: "assets/img/g-rider.jpg", span: "tall", w: 600, h: 646, album: "pack", alt: { lv: "Brālis uz motocikla", en: "A brother on his bike", ru: "Брат на мотоцикле", de: "Ein Bruder auf seiner Maschine" } },
  { src: "assets/img/logo-600.png", w: 600, h: 597, album: "colors", patch: true, alt: { lv: "Kluba uzšuve", en: "Club patch", ru: "Нашивка клуба", de: "Club-Patch" } }
];

/* ---------------- Merch ----------------
   Pilnās kluba krāsas netiek pārdotas — veikalā "Support" dizaini. */
window.MERCH = [
  { id: "tee-support", type: "tee", design: "support", price: 29, colors: ["#000","#2a2a2a"], name: { lv: "Support T-krekls", en: "Support T-shirt", ru: "Футболка Support", de: "Support-T-Shirt", lt: "Support marškinėliai", et: "Support T-särk", no: "Support T-skjorte", fr: "T-shirt Support" } },
  { id: "hoodie-pack", type: "hoodie", design: "mark", price: 59, colors: ["#000","#1f1f1f"], name: { lv: "Bara hūdijs", en: "Pack hoodie", ru: "Худи «Стая»", de: "Rudel-Hoodie", lt: "Gaujos džemperis", et: "Karja pusa", no: "Flokk-hettegenser", fr: "Sweat à capuche Meute" } },
  { id: "cap", type: "cap", design: "mark", price: 25, colors: ["#000"], name: { lv: "Cepure ar vilku", en: "Wolf cap", ru: "Кепка с волком", de: "Wolf-Cap", lt: "Kepurė su vilku", et: "Hundiga nokamüts", no: "Ulvecaps", fr: "Casquette Loup" } },
  { id: "tee-latvia", type: "tee", design: "latvia", price: 29, colors: ["#000","#e8e4dc"], name: { lv: "Latvia Ride T-krekls", en: "Latvia Ride T-shirt", ru: "Футболка Latvia Ride", de: "Latvia-Ride-T-Shirt", lt: "Latvia Ride marškinėliai", et: "Latvia Ride T-särk", no: "Latvia Ride T-skjorte", fr: "T-shirt Latvia Ride" } },
  { id: "mug", type: "mug", design: "mark", price: 15, colors: ["#000"], name: { lv: "Krūze", en: "Mug", ru: "Кружка", de: "Becher", lt: "Puodelis", et: "Kruus", no: "Krus", fr: "Mug" } },
  { id: "flag", type: "flag", design: "support", price: 35, colors: ["#000"], name: { lv: "Karogs 90×60", en: "Flag 90×60", ru: "Флаг 90×60", de: "Fahne 90×60", lt: "Vėliava 90×60", et: "Lipp 90×60", no: "Flagg 90×60", fr: "Drapeau 90×60" } },
  { id: "stickers", type: "sticker", design: "mark", price: 6, colors: ["#000"], name: { lv: "Uzlīmju komplekts", en: "Sticker pack", ru: "Набор наклеек", de: "Stickerset", lt: "Lipdukų rinkinys", et: "Kleebisekomplekt", no: "Klistremerkesett", fr: "Lot d'autocollants" } }
];

/* ---------------- Ziedojumi ----------------
   Aizpildi vismaz vienu maksājuma veidu (tukšs = netiek rādīts). */
window.DONATE = {
  // 9. sadaļa: rekvizīti no specifikācijas melnraksta — pirms publicēšanas jāpārbauda pie biedrības un bankas
  recipient: "WBMC BIEDRĪBA", iban: "LV87RIKO0002930404914", bank: "Luminor Bank AS Latvijas filiāle", bic: "RIKOLV2X", bankAddress: "Skanstes iela 12, Rīga, LV-1013",
  stripeLink: "", stripeMonthly: "", paypal: "",
  goals: [
    { id: "home", target: 5000, raised: 0,
      name: { lv: "Kluba mājas", en: "Clubhouse", ru: "Дом клуба", de: "Clubhaus", lt: "Klubo namai", et: "Klubimaja", no: "Klubbhus", fr: "Local du club" },
      text: { lv: "Telpas motocikliem, krāsām un dienasgrāmatai. Remonts, apkure, darbnīca.", en: "A place for the bikes, the colours and the diary. Renovation, heating, workshop.", ru: "Помещение для мотоциклов, цветов и дневника. Ремонт, отопление, мастерская.", de: "Ein Ort für Maschinen, Farben und Tagebuch. Renovierung, Heizung, Werkstatt.", lt: "Patalpos motociklams, spalvoms ir dienoraščiui. Remontas, šildymas, dirbtuvės.", et: "Ruumid ratastele, värvidele ja päevikule. Remont, küte, töökoda.", no: "Et sted for syklene, fargene og dagboka. Oppussing, varme, verksted.", fr: "Un lieu pour les motos, les couleurs et le journal. Rénovation, chauffage, atelier." } },
    { id: "charity", target: 2000, raised: 0,
      name: { lv: "Labdarības braucieni", en: "Charity rides", ru: "Благотворительные поездки", de: "Wohltätigkeitsfahrten", lt: "Labdaros važiavimai", et: "Heategevussõidud", no: "Veldedighetsturer", fr: "Balades caritatives" },
      text: { lv: "Degviela un loģistika braucieniem, kuros vedam palīdzību bērnunamiem un veterāniem.", en: "Fuel and logistics for rides bringing help to children's homes and veterans.", ru: "Топливо и логистика для поездок с помощью детским домам и ветеранам.", de: "Sprit und Logistik für Fahrten mit Hilfe für Kinderheime und Veteranen.", lt: "Kuras ir logistika važiavimams, kuriais vežame pagalbą vaikų namams ir veteranams.", et: "Kütus ja logistika sõitudeks, millega viime abi lastekodudele ja veteranidele.", no: "Drivstoff og logistikk til turer med hjelp til barnehjem og veteraner.", fr: "Carburant et logistique pour les balades apportant de l'aide aux foyers d'enfants et aux vétérans." } },
    { id: "memorial", target: 800, raised: 0,
      name: { lv: "Piemiņas pasākumi", en: "Memorial events", ru: "Памятные мероприятия", de: "Gedenkveranstaltungen", lt: "Atminimo renginiai", et: "Mälestusüritused", no: "Minnearrangementer", fr: "Cérémonies du souvenir" },
      text: { lv: "Ziedi, sveces un pasākumi Lāčplēša dienā, 18. novembrī un brāļu piemiņai.", en: "Flowers, candles and events on Lāčplēsis Day, 18 November and in memory of fallen brothers.", ru: "Цветы, свечи и мероприятия в День Лачплесиса, 18 ноября и в память о братьях.", de: "Blumen, Kerzen und Veranstaltungen am Lāčplēsis-Tag, am 18. November und zum Gedenken an Brüder.", lt: "Gėlės, žvakės ir renginiai Lāčplēsio dieną, lapkričio 18-ąją ir brolių atminimui.", et: "Lilled, küünlad ja üritused Lāčplēsise päeval, 18. novembril ja vendade mälestuseks.", no: "Blomster, lys og arrangementer på Lāčplēsis-dagen, 18. november og til minne om brødre.", fr: "Fleurs, bougies et cérémonies le jour de Lāčplēsis, le 18 novembre et en mémoire des frères." } }
  ],
  tiers: [
    { id: "friend", price: 5 }, { id: "supporter", price: 15 }, { id: "patron", price: 50 }
  ],
  supporters: [] // { name: "Jānis B.", tier: "patron" }
};
