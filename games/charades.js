// Kalambury: rysujesz hasło, reszta zgaduje na czacie. Rysunek leci osobnym kanałem "relay" (patrz server.js).
const DRAW_MS = 80000, REVEAL_MS = 5000, CYCLES = 2, CHAT_MAX = 40;
const WORDS = {
  'Zwierzęta': ['KOT','PIES','ŻYRAFA','SŁOŃ','PINGWIN','REKIN','MOTYL','WĄŻ','KROKODYL','PAJĄK','KROWA','ŚWINIA','KOŃ','ŻABA','ŻÓŁW','DELFIN','WIEWIÓRKA','PSZCZOŁA','KANGUR','KOALA','MAŁPA','LEW','ZEBRA','NIEDŹWIEDŹ','SOWA','ORZEŁ','KRAB','OŚMIORNICA','ŚLIMAK','JEŻ','FLAMING','WIELBŁĄD','NOSOROŻEC','HIPOPOTAM','DZIĘCIOŁ','BIEDRONKA','PAPUGA','KRET','WILK','LIS','MRÓWKA','KACZKA','ZAJĄC','KURA','FOKA'],
  'Jedzenie': ['PIZZA','BANAN','HAMBURGER','LODY','ARBUZ','SPAGHETTI','JAJECZNICA','POPCORN','PIEROGI','NALEŚNIKI','KANAPKA','FRYTKI','MARCHEWKA','KUKURYDZA','JABŁKO','TRUSKAWKA','ANANAS','CYTRYNA','SER','CHLEB','ZUPA','SUSHI','KEBAB','HOT DOG','CZEKOLADA','PĄCZEK','BROKUŁ','CEBULA','TORT','MALINY','WINOGRONA','ZAPIEKANKA','MAKARON','RAMEN','KARMEL','WATA CUKROWA','KISZONY OGÓREK','POMIDOR'],
  'Przedmioty': ['PARASOL','OKULARY','ROWER','KLUCZ','ŻARÓWKA','NOŻYCZKI','ZEGAR','GITARA','LATARKA','MŁOTEK','DRABINA','KOMPAS','LUPA','WALIZKA','PORTFEL','BUDZIK','ŚWIECA','DZBANEK','KUBEK','SZCZOTKA','GRZEBIEŃ','MAPA','TELESKOP','KOŁDRA','PODUSZKA','WIADRO','ŁOPATA','PIŁA','ŚRUBOKRĘT','NAMIOT','LATAWIEC','KALENDARZ','KOSZ NA ŚMIECI','SPINACZ','KLEJ','SZKLANKA','PARKOMAT','TERMOS'],
  'Czynności': ['PŁYWANIE','TAŃCZENIE','SPANIE','GOTOWANIE','WSPINACZKA','JAZDA NA ROWERZE','MYCIE ZĘBÓW','ŚPIEWANIE','PŁACZ','ŚMIECH','BIEGANIE','SKAKANIE','PISANIE','CZYTANIE','MALOWANIE','PRANIE','SPRZĄTANIE','WĘDKOWANIE','FOTOGRAFOWANIE','ZAKUPY','JAZDA NA NARTACH','PRASOWANIE','KICHANIE','NURKOWANIE','KOPANIE','PRZYTULANIE','KLASKANIE','GRA W SZACHY','BUDOWANIE ZAMKU Z PIASKU','OPALANIE','WYPIEK CIASTA','SKŁADANIE PAPIEROWEGO SAMOLOTU','PODLEWANIE KWIATÓW'],
  'Miejsca': ['PLAŻA','SZKOŁA','LOTNISKO','ZAMEK','KOSMOS','ZOO','WULKAN','SZPITAL','KINO','BIBLIOTEKA','CYRK','LUNAPARK','KOŚCIÓŁ','DWORZEC','FARMA','JASKINIA','LATARNIA MORSKA','WIEŻOWIEC','SKLEP','BASEN','STADION','MUZEUM','PIEKARNIA','SUPERMARKET','MOST','PLAC ZABAW','KOPALNIA','RYNEK','PARKING','STACJA BENZYNOWA','PORT','AKWARIUM'],
  'Zawody': ['STRAŻAK','PILOT','LEKARZ','KUCHARZ','ASTRONAUTA','POLICJANT','FRYZJER','LISTONOSZ','NAUCZYCIEL','MALARZ','KIEROWCA','ROLNIK','DENTYSTA','FOTOGRAF','DYRYGENT','ARCHITEKT','SĘDZIA','KLAUN','MAGIK','GÓRNIK','MARYNARZ','WETERYNARZ','PIEKARZ','HYDRAULIK','DETEKTYW','KELNER','ARCHEOLOG','ASTRONOM','RZEŹNIK','SPRZEDAWCA','PROGRAMISTA','PIELĘGNIARKA','TŁUMACZ','BIBLIOTEKARZ','RATOWNIK','KAMIENIARZ'],
  'Sport': ['PIŁKA NOŻNA','KOSZYKÓWKA','SIATKÓWKA','TENIS','TENIS STOŁOWY','BOKS','GOLF','NARTY','SNOWBOARD','ŁYŻWY','SKOK W DAL','SKOK Z TYCZKĄ','KAJAKI','SURFING','KARATE','JUDO','SZERMIERKA','ŁUCZNICTWO','RZUT OSZCZEPEM','WIOŚLARSTWO','JOGA','HOKEJ','BADMINTON','KRĘGLE','BILARD','SKOKI NARCIARSKIE','WSPINACZKA SPORTOWA','PŁYWANIE SYNCHRONICZNE','PING PONG','RZUT DYSKIEM','PODNOSZENIE SZTANGI','PIŁKA RĘCZNA','KOLARSTWO'],
  'Bajki i filmy': ['KOPCIUSZEK','ŚNIEŻKA','KRÓL LEW','SHREK','TITANIC','HARRY POTTER','PIOTRUŚ PAN','ALADYN','SYRENKA','KRAINA LODU','GWIEZDNE WOJNY','JURAJSKI PARK','KUBUŚ PUCHATEK','SZCZENIĘCY PATROL','PIRACI Z KARAIBÓW','MYSZKA MIKI','KOT W BUTACH','CZERWONY KAPTUREK','JAŚ I MAŁGOSIA','BATMAN','SUPERMAN','TOY STORY','WIEDŹMIN','REKSIO','MAŁY KSIĄŻĘ','KUNG FU PANDA','NEMO','WALL-E','COCO','MOANA','RATATUJ','HOBBIT'],
  'Natura i pogoda': ['TĘCZA','BURZA','ŚNIEG','PIORUN','TORNADO','POWÓDŹ','WODOSPAD','GÓRA','LAS','PUSTYNIA','WYSPA','JEZIORO','RZEKA','MORZE','MGŁA','DESZCZ','SŁOŃCE','KSIĘŻYC','GWIAZDA','KOMETA','LODOWIEC','ZORZA POLARNA','SŁONECZNIK','KAKTUS','GRZYB','RÓŻA','DRZEWO','PALMA','TULIPAN','ZAĆMIENIE','LAWINA','TRZĘSIENIE ZIEMI','OAZA','GEJZER','KANION','BAGNO','POLANA','WSCHÓD SŁOŃCA'],
  'Transport': ['SAMOLOT','STATEK','HELIKOPTER','TRAMWAJ','METRO','ŁÓDŹ PODWODNA','HULAJNOGA','BALON','ROLKI','TRAKTOR','KARETA','CIĘŻARÓWKA','AUTOBUS','POCIĄG','MOTOCYKL','RAKIETA','TAKSÓWKA','DESKOROLKA','SANIE','AMBULANS','WÓZ STRAŻACKI','STATEK KOSMICZNY','PROM','RIKSZA','LOTNIA','SKUTER','WÓZ KONNY','KOLEJKA GÓRSKA','KOLEJKA LINOWA','CZOŁG','BUS'],
  'Dom i kuchnia': ['LODÓWKA','MIKROFALÓWKA','PRALKA','ŻELAZKO','ODKURZACZ','LUSTRO','ŁÓŻKO','FOTEL','FIRANKA','KOMODA','CZAJNIK','PATELNIA','DESKA DO PRASOWANIA','WANNA','PRYSZNIC','KANAPA','ZLEW','TOSTER','BLENDER','SZAFA','DYWAN','ŻYRANDOL','SCHODY','KOMIN','DRZWI','OKNO','TOALETA','WIDELEC','ŁYŻKA','NÓŻ','TALERZ','KRZESŁO','STÓŁ','FILIŻANKA','PÓŁKA','NOCNA LAMPKA','KLAMKA','ŚMIETNIK','ZMYWARKA','PIEKARNIK','MISKA'],
  'Ubrania': ['SKARPETKA','CZAPKA','KURTKA','BUTY','SPÓDNICA','KRAWAT','SZALIK','RĘKAWICZKI','PIŻAMA','KOSZULA','SUKIENKA','KAPELUSZ','PASEK','PLECAK','GOGLE','KLAPKI','OBCASY','KALOSZE','FARTUCH','STRÓJ KĄPIELOWY','SPODNIE','BLUZA','KORONA','MASKA','DŻINSY','TRAMPKI','RĘKAWICE BOKSERSKIE','SZLAFROK','KOMBINEZON','OPASKA','KAMIZELKA','BIKINI','PŁASZCZ'],
  'Technologia': ['KOMPUTER','TELEFON','ROBOT','DRON','SŁUCHAWKI','KLAWIATURA','MYSZKA KOMPUTEROWA','WIFI','SELFIE','KAMERA','TELEWIZOR','DRUKARKA','ŁADOWARKA','LAPTOP','KONSOLA','JOYSTICK','GŁOŚNIK','APARAT','INTERNET','BATERIA','ROUTER','SMARTWATCH','PENDRIVE','KABEL','HAKER','GPS','KOD QR','TABLET'],
  'Święta i zabawa': ['CHOINKA','PREZENT','FAJERWERKI','TORT URODZINOWY','BALONIK','PISANKA','BAŁWAN','MIKOŁAJ','DYNIA','PIŃATA','KARNAWAŁ','URODZINY','DYSKOTEKA','KARAOKE','ŻYCZENIA','KONFETTI','ZAPROSZENIE','MASKARADA','PIKNIK','OGNISKO','KOLĘDY','ANIOŁEK','DZIEŃ DZIECKA','WIGILIA','ŚMIGUS-DYNGUS','WALENTYNKI','PRZEBRANIE','BAL','LAMPKI CHOINKOWE','GRA PLANSZOWA','QUIZ','LOTERIA','ZABAWA W CHOWANEGO'],
  'Fantasy i potwory': ['SMOK','WAMPIR','DUCH','CZAROWNICA','SYRENA','WILKOŁAK','ZOMBIE','ELF','KRASNAL','JEDNOROŻEC','PIRAT','RYCERZ','SUPERBOHATER','NINJA','KOSMITA','MUMIA','FRANKENSTEIN','TROLL','CZARODZIEJ','KRÓLEWNA','KRÓL','WRÓŻKA','OLBRZYM','YETI','GOLEM','SZKIELET','DIABEŁ','MINOTAUR','FENIKS','HYDRA','KRAKEN','GARGULEC','OGR','LEPRECHAUN'],
  'Szkoła i nauka': ['TABLICA','ZESZYT','LINIJKA','LEKCJA','DZWONEK','MIKROSKOP','TERMOMETR','GLOBUS','CYRKIEL','KALKULATOR','PLASTELINA','KREDKI','KLASÓWKA','PRACA DOMOWA','PRZERWA','ŚWIADECTWO','ATLAS','TORNISTER','TEMPERÓWKA','GUMKA','BIURKO'],
  'Ciało i zdrowie': ['ZĄB','OKO','PALEC','SERCE','KOLANO','UCHO','KATAR','KASZEL','GIPS','PLASTER','STRZYKAWKA','STETOSKOP','MIĘSIEŃ','BRODA','WĄSY','WŁOSY','JĘZYK','NOS','PLECY','STOPA','PIEGI','KULE'],
  'Muzyka': ['PIANINO','SKRZYPCE','BĘBNY','TRĄBKA','FLET','SAKSOFON','HARFA','MIKROFON','AKORDEON','GITARA ELEKTRYCZNA','WIOLONCZELA','KLARNET','TAMBURYN','DUDY','GRAMOFON','NUTY','KONCERT','ORKIESTRA'],
  'Zabytki i świat': ['WIEŻA EIFFLA','PIRAMIDY','KOLOSEUM','STATUA WOLNOŚCI','WIELKI MUR','PAŁAC KULTURY','SYRENKA WARSZAWSKA','KRZYWA WIEŻA W PIZIE','TAJ MAHAL','BIG BEN','MOUNT EVEREST','OPERA W SYDNEY','SMOK WAWELSKI','BRAMA BRANDENBURSKA','SFINKS','STONEHENGE','MORSKIE OKO']
};
const norm = t => String(t).toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/\s+/g, ' ').trim();
const say = (s, text, name) => { s.chat.push({ name: name || null, text }); if (s.chat.length > CHAT_MAX) s.chat.shift(); };

function pick(s) {
  // najpierw losujemy kategorię (żeby duże nie przykrywały małych), potem hasło, które jeszcze nie padło
  const free = Object.entries(WORDS).map(([c, ws]) => [c, ws.filter(w => !s.used.includes(w))]).filter(([, ws]) => ws.length);
  if (!free.length) { s.used = []; return pick(s); }
  const [c, ws] = free[Math.floor(Math.random() * free.length)];
  const w = ws[Math.floor(Math.random() * ws.length)];
  s.used.push(w); return [c, w];
}
function startTurn(s) {
  const [c, w] = pick(s);
  s.category = c; s.word = w; s.phase = 'draw'; s.solved = []; s.seq++;
  s.endsAt = Date.now() + DRAW_MS; say(s, `${s.names[s.drawer]} rysuje!`);
  return s;
}
function toReveal(s) { s.phase = 'reveal'; s.endsAt = Date.now() + REVEAL_MS; say(s, `Hasło: ${s.word}`); return s; }
function nextTurn(s) {
  s.turnNo++;
  if (s.turnNo >= s.totalTurns) { s.phase = 'over'; s.endsAt = null; s.word = null; return s; }
  s.drawer = (s.drawer + 1) % s.names.length;
  return startTurn(s);
}
function create(names) {
  return startTurn({ names, scores: names.map(() => 0), chat: [], used: [], seq: 0, turnNo: 0, totalTurns: names.length * CYCLES, drawer: 0 });
}

module.exports = {
  meta: { id: 'charades', name: 'Kalambury', icon: '🎨', desc: 'Rysuj hasło, a reszta zgaduje na czacie.', min: 2, max: 8 },

  init: players => create(players.map(p => p.name)),

  move(s, me, d) {
    if (d.type !== 'guess') return { error: 'Nieznany ruch.' };
    if (s.phase !== 'draw') return { error: 'Runda się skończyła.' };
    if (me === s.drawer) return { error: 'Rysujący nie zgaduje.' };
    if (s.solved.includes(me)) return { error: 'Już odgadłeś hasło.' };
    const text = String(d.text || '').trim().slice(0, 60);
    if (!text) return { error: 'Wpisz odpowiedź.' };
    if (norm(text) === norm(s.word)) {
      const left = Math.max(0, s.endsAt - Date.now());
      s.solved.push(me);
      s.scores[me] += 20 + Math.ceil(80 * left / DRAW_MS);
      s.scores[s.drawer] += 10;
      say(s, `${s.names[me]} odgaduje hasło!`);
      if (s.solved.length >= s.names.length - 1) toReveal(s);
    } else say(s, text, s.names[me]);
    return s;
  },

  tick(s) { return s.phase === 'draw' ? toReveal(s) : s.phase === 'reveal' ? nextTurn(s) : s; },
  canRelay: (s, me) => s.phase === 'draw' && me === s.drawer,

  view(s, me) {
    const out = { ...s, used: undefined, msLeft: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0, drawMs: DRAW_MS };
    out.hint = s.word ? [...s.word].map(c => (c === ' ' ? ' ' : '_')).join('') : '';
    out.word = (s.phase !== 'draw' || me === s.drawer) ? s.word : null;
    return out;
  },

  rematch: s => (s.phase === 'over' ? create(s.names) : s),

  onLeave(s, idx) {
    const wasDrawer = idx === s.drawer;
    s.names.splice(idx, 1); s.scores.splice(idx, 1);
    const n = s.names.length; if (n < 2) return null;
    s.solved = s.solved.filter(i => i !== idx).map(i => (i > idx ? i - 1 : i));
    if (s.phase === 'over') return s;
    if (wasDrawer) {
      if (s.phase === 'draw') { s.drawer = idx % n; return startTurn(s); }
      s.drawer = (idx - 1 + n) % n; return s;
    }
    if (idx < s.drawer) s.drawer--;
    if (s.phase === 'draw' && s.solved.length >= n - 1) toReveal(s);
    return s;
  }
};
