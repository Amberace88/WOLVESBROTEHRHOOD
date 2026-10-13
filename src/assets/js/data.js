/* =====================================================================
   WOLVES BROTHERHOOD MC — kluba saturs (viss rediģējamais saturs šeit)
   Teksti var būt vienkārša virkne vai objekts pa valodām:
     { lv:"…", en:"…", ru:"…", de:"…", lt:"…", et:"…", no:"…", fr:"…" }
   Trūkstošā valodā rāda EN, tad LV.
   `sample: true` = paraugs (lapā redzama atzīme). Kad ieraksts īsts — izdzēs.
   ===================================================================== */
window.CLUB = {
  name: "Wolves Brotherhood MC",
  email: "info@wolvesbrotherhoodmc.com",
  founded: { date: null, year: null },          // TODO: kluba dibināšanas datums "MM-DD" un gads
  homeBase: { name: "Rīga", lat: 56.9496, lon: 24.1052 },
  api: "/api",                                   // Cloudflare Worker API. Ja neatbild — lapa strādā demo režīmā
  socials: { instagram: "", facebook: "", youtube: "" },
  legal: { name: "Biedrība WBMC", regNo: "40008360087", registered: "2026-05-12", address: "Jaunciema gatve 147-1, Rīga, LV-1023" }
};

/* ---------------- Kluba pasākumi ---------------- */
window.EVENTS = [
  { date: "2026-10-24", time: "11:00", route: "gauja", kind: "ride", sample: true,
    title: { lv: "Sezonas noslēguma brauciens", en: "Season closing ride", ru: "Поездка закрытия сезона", de: "Saisonabschlussfahrt", lt: "Sezono uždarymo važiavimas", et: "Hooaja lõpusõit", no: "Sesongavslutningstur", fr: "Balade de clôture de saison" },
    place: "Rīga → Sigulda → Cēsis",
    text: { lv: "Pēdējie siltie kilometri pirms ziemas. Kopīgs starts no kluba mājām, pusdienas Cēsīs.", en: "The last warm miles before winter. Joint start from the clubhouse, lunch in Cēsis.", ru: "Последние тёплые километры перед зимой. Общий старт от клуба, обед в Цесисе.", de: "Die letzten warmen Kilometer vor dem Winter. Gemeinsamer Start am Clubhaus, Mittagessen in Cēsis." } },
  { date: "2026-11-11", time: "17:00", kind: "memorial", sample: true,
    title: { lv: "Lāčplēša dienas sveču brauciens", en: "Lāčplēsis Day candle ride", ru: "Поездка со свечами в День Лачплесиса", de: "Kerzenfahrt zum Lāčplēsis-Tag", lt: "Lāčplēsio dienos žvakių važiavimas", et: "Lāčplēsise päeva küünlasõit", no: "Lyskjøring på Lāčplēsis-dagen", fr: "Balade aux bougies du jour de Lāčplēsis" },
    place: { lv: "Rīga, Krastmala", en: "Riga, embankment", ru: "Рига, набережная", de: "Riga, Uferpromenade" },
    text: { lv: "Kopā ar brāļiem nolieksim sveces pie Rīgas pils mūra.", en: "Together with the brothers we will lay candles at the Riga Castle wall.", ru: "Вместе с братьями зажжём свечи у стены Рижского замка.", de: "Gemeinsam legen wir Kerzen an der Mauer des Rigaer Schlosses nieder." } },
  { date: "2026-12-19", time: "19:00", kind: "club", sample: true,
    title: { lv: "Kluba Ziemassvētku vakars", en: "Club Christmas night", ru: "Рождественский вечер клуба", de: "Weihnachtsabend des Clubs", lt: "Klubo Kalėdų vakaras", et: "Klubi jõuluõhtu", no: "Klubbens julekveld", fr: "Soirée de Noël du club" },
    place: { lv: "Kluba mājas", en: "Clubhouse", ru: "Клуб", de: "Clubhaus", lt: "Klubo namai", et: "Klubimaja", no: "Klubbhuset", fr: "Local du club" },
    text: { lv: "Gada noslēgums, apbalvojumi par sezonas kilometriem un jaunie ieraksti dienasgrāmatā.", en: "End of the year, awards for the season's miles and new entries in the diary.", ru: "Итоги года, награды за километры сезона и новые записи в дневнике.", de: "Jahresabschluss, Ehrungen für die Saisonkilometer und neue Tagebucheinträge." } },
  { date: "2027-04-24", time: "12:00", kind: "ride", sample: true,
    title: { lv: "Moto sezonas atklāšana 2027", en: "2027 season opening", ru: "Открытие мотосезона 2027", de: "Saisoneröffnung 2027", lt: "2027 m. sezono atidarymas", et: "Hooaja avamine 2027", no: "Sesongåpning 2027", fr: "Ouverture de la saison 2027" },
    place: "Rīga",
    text: { lv: "Pirmais kopīgais izbrauciens sezonā. Tehniskā apskate pirms starta.", en: "First group ride of the season. Technical check before the start.", ru: "Первый совместный выезд сезона. Техосмотр перед стартом.", de: "Erste gemeinsame Ausfahrt der Saison. Technikcheck vor dem Start." } },
  { date: "2027-06-19", time: "10:00", route: "kolka", kind: "ride", sample: true,
    title: { lv: "Kurzemes krasta brauciens uz Kolku", en: "Courland coast ride to Kolka", ru: "Поездка по побережью Курземе в Колку", de: "Kurland-Küstenfahrt nach Kolka", lt: "Kuršo pakrantės važiavimas į Kolką", et: "Kuramaa rannikusõit Kolkasse", no: "Kurland-kysttur til Kolka", fr: "Balade sur la côte de Courlande jusqu'à Kolka" },
    place: "Rīga → Kolka → Ventspils",
    text: { lv: "Divu dienu brauciens gar jūru ar nakšņošanu Ventspilī.", en: "Two-day ride along the sea with an overnight stay in Ventspils.", ru: "Двухдневная поездка вдоль моря с ночёвкой в Вентспилсе.", de: "Zweitägige Fahrt am Meer mit Übernachtung in Ventspils." } }
];

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
  { year: { lv: "Sākums", en: "Beginning", ru: "Начало", de: "Anfang", lt: "Pradžia", et: "Algus", no: "Begynnelsen", fr: "Origines" }, sample: true,
    title: { lv: "Bars sanāk kopā", en: "The pack comes together", ru: "Стая собирается", de: "Das Rudel findet sich", lt: "Gauja susiburia", et: "Kari tuleb kokku", no: "Flokken samles", fr: "La meute se forme" },
    text: { lv: "Draugi ar vienu kaislību — ceļš, motocikli un uzticība.", en: "Friends with one passion — the road, motorcycles and trust.", ru: "Друзья с одной страстью — дорога, мотоциклы и доверие.", de: "Freunde mit einer Leidenschaft — die Straße, Motorräder und Vertrauen.", lt: "Draugai su viena aistra — kelias, motociklai ir pasitikėjimas.", et: "Sõbrad ühe kirega — tee, mootorrattad ja usaldus.", no: "Venner med én lidenskap — veien, motorsykler og tillit.", fr: "Des amis unis par une passion : la route, la moto et la confiance." } },
  { year: { lv: "Krāsas", en: "Colours", ru: "Цвета", de: "Farben", lt: "Spalvos", et: "Värvid", no: "Fargene", fr: "Les couleurs" }, sample: true,
    title: { lv: "Pirmās uzšuves", en: "The first patches", ru: "Первые нашивки", de: "Die ersten Patches", lt: "Pirmieji antsiuvai", et: "Esimesed embleemid", no: "De første merkene", fr: "Les premiers écussons" },
    text: { lv: "Dzelzs krusts un vilks ar sarkano aci — zīme, ko nopelna, nevis nopērk.", en: "The iron cross and the wolf with the red eye — a sign you earn, not buy.", ru: "Железный крест и волк с красным глазом — знак, который заслуживают, а не покупают.", de: "Das Eiserne Kreuz und der Wolf mit dem roten Auge — ein Zeichen, das man sich verdient, nicht kauft.", lt: "Geležinis kryžius ir vilkas raudona akimi — ženklas, kurį užsitarnauji, o ne nusiperki.", et: "Raudrist ja punase silmaga hunt — märk, mis teenitakse välja, mitte ei osteta.", no: "Jernkorset og ulven med det røde øyet — et merke du gjør deg fortjent til, ikke kjøper.", fr: "La croix de fer et le loup à l'œil rouge : un signe qui se mérite, pas qui s'achète." } },
  { year: "2026", sample: false,
    title: { lv: "Biedrība WBMC", en: "WBMC association", ru: "Общество WBMC", de: "Verein WBMC", lt: "Asociacija WBMC", et: "Ühing WBMC", no: "Foreningen WBMC", fr: "Association WBMC" },
    text: { lv: "12. maijā klubs reģistrēts kā biedrība WBMC (reģ. nr. 40008360087).", en: "On 12 May the club was registered as the WBMC association (reg. no. 40008360087).", ru: "12 мая клуб зарегистрирован как общество WBMC (рег. № 40008360087).", de: "Am 12. Mai wurde der Club als Verein WBMC eingetragen (Reg.-Nr. 40008360087).", lt: "Gegužės 12 d. klubas įregistruotas kaip asociacija WBMC (reg. Nr. 40008360087).", et: "12. mail registreeriti klubi ühinguna WBMC (reg-nr 40008360087).", no: "12. mai ble klubben registrert som foreningen WBMC (reg.nr. 40008360087).", fr: "Le 12 mai, le club a été enregistré comme association WBMC (n° 40008360087)." } },
  { year: { lv: "Šodien", en: "Today", ru: "Сегодня", de: "Heute", lt: "Šiandien", et: "Täna", no: "I dag", fr: "Aujourd'hui" }, sample: true,
    title: { lv: "Brālība uz ceļa", en: "Brotherhood on the road", ru: "Братство в пути", de: "Bruderschaft auf der Straße", lt: "Brolija kelyje", et: "Vennaskond teel", no: "Brorskap på veien", fr: "La fraternité sur la route" },
    text: { lv: "Kopīgi braucieni pa visu Latviju un tālāk, piemiņas dienas, labdarība un savējie, kas vienmēr atbrauc palīgā.", en: "Rides across Latvia and beyond, memorial days, charity — and brothers who always come to help.", ru: "Поездки по всей Латвии и дальше, дни памяти, благотворительность — и свои, которые всегда приедут на помощь.", de: "Fahrten durch ganz Lettland und darüber hinaus, Gedenktage, Wohltätigkeit — und Brüder, die immer zur Hilfe kommen.", lt: "Važiavimai po visą Latviją ir toliau, atminimo dienos, labdara — ir savi, kurie visada atvažiuoja padėti.", et: "Sõidud üle Läti ja kaugemale, mälestuspäevad, heategevus — ja omad, kes alati appi tulevad.", no: "Turer over hele Latvia og videre, minnedager, veldedighet — og brødre som alltid kommer for å hjelpe.", fr: "Des balades à travers la Lettonie et au-delà, des jours de mémoire, de la solidarité — et des frères qui viennent toujours aider." } }
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
  iban: "", bank: "", bic: "",      // piem. "LV00HABA0000000000000", "Swedbank", "HABALV22"
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
