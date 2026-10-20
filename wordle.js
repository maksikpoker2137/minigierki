// Wordle – wyścig dla 2–8 graczy. 5 rund, w każdej wszyscy zgadują TO SAMO słowo (5 liter, 6 prób).
// Kto pierwszy je odgadnie, wygrywa rundę (+1 pkt) i runda od razu się kończy.
// Fazy: countdown -> play -> results -> (następna runda) -> over.
// Hasło zna tylko serwer. Rywale widzą wyłącznie kolory prób (bez liter) – do końca rundy.
const fs = require('fs');
const path = require('path');

const WORDS = `
AKTOR ARENA ATLAS BAGNO BALON BANAN BANDA BARAN BAZAR BIAŁY BIEDA BLADY BRAMA BRODA BRYKA BUDYŃ BUTLA
CEGŁA CENNY CHATA CHLEB CHORY CHUDY CIAŁO CISZA CUDNY CYFRA CZAPA CZARY CZOŁO DANIE DESKA DOBRY DOLAR
DOLNY DRZWI DUSZA DYNIA DZIAD DZIEŃ EKRAN FARBA FINAŁ FIRMA FLAGA FLAKI FLOTA FOTEL FRAZA GAŁĄŹ GARAŻ
GĘSTY GŁOWA GŁUPI GÓRAL GÓRKA GRACZ GRZYB GRYPA HASŁO HOTEL IKONA JAJKO JASNY JEDEN KABEL KADRA KARTA
KASZA KAWAŁ KLASA KLUCZ KOBRA KOCYK KOGUT KOLOR KOMIN KONIK KORAL KOSZT KRATA KREDA KROWA KRZAK KUFEL
KULKA KWIAT LAMPA LEKKI LINIA LISTA LOKAL ŁADNY ŁAWKA ŁĄCZE ŁÓDKA MAGIA MALEC MAMUT MANGO MAPKA MASŁO
MEBLE MELON MIARA MIECZ MLEKO MŁODY MODEL MOCNY MUCHA NABÓJ NIEBO NOCNY NOTES OBRAZ OBUWIE OCEAN OGIEŃ
OGRÓD OPERA ORZEŁ OSIOŁ OSOBA OWOCE PALEC PANEL PASTA PERŁA PIŁKA PIRAT PLAMA PLAŻA PŁYTA POKÓJ POWÓD
PRASA PRAWO PUSTY PYTON RADIO RAMKA RANEK REGAŁ REKIN RESZTA ROBOT ROWER RYBAK RYBKA RZEKA SALON SANKI
SCENA SERCE SERIA SKARB SKUTER SŁOIK SŁOWO SOKÓŁ SPORT STADO STARY STRAŻ STRÓJ SZAFA SZKŁO SZLAK TABLET
TARAS TAŚMA TEATR TEMAT TEREN TORBA TRAWA TUNEL TWARZ UCZEŃ ULICA UWAGA WAGON WALIZA WANNA WĄSY WIATR
WIDOK WINDA WYSPA ZAMEK ZEBRA ZEGAR ZIMNO ZŁOTO ŻABKA ŻAGIEL ŻÓŁTY ADRES AKCJA ALBUM ANIOŁ APTEKA BAJKA
BANKI BARWA BASEN BIURO BLACHA BOCZEK BOHATER BRZEG BUDKA BUKIET CIOCIA CUKIER CZAJNIK DELFIN DOMEK DROGA DRUGI
DRZEWO DUMNY DYWAN DZBAN DZIURA FABRYKA FIGURA FIOŁEK FOLIA FORMA GARNEK GLINA GMINA GNIAZDO GOŁĄB GRANIT GRUBY
GRZEJNIK GWIAZDA HAKER HALKA HAMAK HARFA HEROIN HURTOWNIA IGŁA INDYK JABŁKO JAGODA JASKINIA JEZIORO JEŻYK JODŁA KACZKA
KAKAO KALKA KAMIEŃ KANAŁ KARAFKA KAWIOR KIEŁBASA KILKA KLAMRA KLEJ KLOCEK KŁODA KOLANO KOMAR KONTO KOPIA KORBA
KOSTKA KOTEK KOZAK KRAWAT KROPLA KRUCZEK KRYSZTAŁ KUBEK KUCYK KURCZAK KUROPATWA LALKA LATAWIEC LENIWIEC LIMONKA LODÓWKA LUKRECJA
ŁABĘDŹ ŁAPKA ŁOPATA ŁÓŻKO MAKIETA MAKARON MAKOWIEC MALARZ MAŁPA MANDARYNKA MARCHEW MASKA MATKA MEDAL MENU MIEDŹ MIKSER
MISKA MOMENT MONETA MORZE MOTYL MUZYKA MYDŁO MYSZKA NAPÓJ NARTY NAUKA NIEMY NOGAWKA NUDNY OBIAD OBRUS OKRĄG
OLEJ ORKIESTRA OSTRY PACZKA PAJĄK PALMA PAMIĘĆ PANDA PAPUGA PARASOL PĄCZEK PEJZAŻ PIASEK PIECZEŃ PIEROG PIESEK PIOSENKA
PIWKO PLECAK PŁOMIEŃ PŁUCA PODIUM POLANA POMOC POPIÓŁ PORADA PORTAL POSIŁEK POTOK PROSTY PUCHAR PUDEŁKO PUDEL PULPIT
PUNKT PUZZLE RAJSTOPY RAKIETA RAMIĘ RATUNEK REKORD RODEO ROLKI ROMAN ROZUM RUMIANEK RURKA RYCERZ RYSUNEK RYTM SAŁATA
SAMBA SAMOTNY SARNA SEJF SERNIK SIANO SIEDEM SKALA SKRZAT SKRZYNIA SKÓRA SŁOMA SŁOŃCE SMYCZ SOKÓŁ SOSNA SPACER
SPODNIE SPÓŁKA STAWY STEMPEL STOPA STÓŁ STRACH STRUMIEŃ STUDNIA SUKNIA SZAFKA SZALIK SZARFA SZCZUR SZKOŁA SZPILKA SZTUKA
ŚLIMAK ŚNIEG ŚWIAT ŚWIECA TACKA TAJNY TANGO TARCZA TEKST TELEFON TĘCZA TORT TRAMWAJ TULIPAN TURBINA TYGRYS UCHWYT
UŚMIECH WAFEL WAHADŁO WATA WIEŚ WIEŻA WIKING WILGOĆ WIOSNA WIRUS WOREK WRÓBEL WULKAN WYCIECZKA WYNIK ZABAWA ZAGADKA
ZAMEK ZASADA ZAWÓD ZEGAREK ZIARNO ZIEMIA ZIELONY ZIMOWY ZŁODZIEJ ZMIANA ZŁOTY ŻÓŁW ŻYRAFA
`;
const OK_WORD = /^[A-ZĄĆĘŁŃÓŚŹŻ]{5}$/;
const ANSWERS = [...new Set(WORDS.split(/\s+/).map(w => w.trim().normalize('NFC').toLocaleUpperCase('pl')).filter(w => OK_WORD.test(w)))];

// Opcjonalny słownik dozwolonych prób: jeśli obok jest plik wordle-dict.txt (jedno słowo na linię),
// to próby spoza słownika i spoza listy haseł są odrzucane. Bez pliku wolno wpisać dowolne 5 liter.
let VALID = null;
try {
  const set = new Set(fs.readFileSync(path.join(__dirname, 'wordle-dict.txt'), 'utf8').split(/\r?\n/)
    .map(w => w.trim().normalize('NFC').toLocaleUpperCase('pl')).filter(w => OK_WORD.test(w)));
  if (set.size) VALID = set;
} catch (e) { /* brak pliku = brak słownika */ }

const ROUNDS = 5, TRIES = 6, COUNT_MS = 3500, PLAY_MS = 150000, RESULT_MS = 7000;

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 2 = dobra litera na dobrym miejscu, 1 = jest w haśle, ale gdzie indziej, 0 = brak (poprawnie liczy powtórzone litery)
function score(guess, answer) {
  const g = [...guess], a = [...answer], res = Array(5).fill('0'), left = {};
  for (let i = 0; i < 5; i++) { if (g[i] === a[i]) res[i] = '2'; else left[a[i]] = (left[a[i]] || 0) + 1; }
  for (let i = 0; i < 5; i++) { if (res[i] !== '2' && left[g[i]] > 0) { res[i] = '1'; left[g[i]]--; } }
  return res.join('');
}

function startRound(s) {
  s.phase = 'countdown'; s.answer = s.words[s.idx];
  s.guesses = s.names.map(() => []); s.done = s.names.map(() => null);
  s.winner = null; s.result = null; s.startedAt = null; s.endsAt = Date.now() + COUNT_MS;
  return s;
}
function create(names, wins, round) {
  return startRound({ names, wins, round, idx: 0, words: shuffle([...ANSWERS]).slice(0, ROUNDS), scores: names.map(() => 0) });
}
function toResults(s) {
  if (s.winner !== null) s.scores[s.winner] += 1;
  s.phase = 'results'; s.endsAt = Date.now() + RESULT_MS;
  return s;
}
function finish(s) {
  s.phase = 'over'; s.endsAt = null;
  const best = Math.max(...s.scores);
  if (best > 0) s.scores.forEach((v, i) => { if (v === best) s.wins[i]++; });
  return s;
}

module.exports = {
  meta: { id: 'wordle', name: 'Wordle – wyścig', icon: '🟩', desc: 'Wszyscy zgadują to samo słowo. Kto pierwszy je odgadnie, wygrywa rundę.', min: 2, max: 8 },

  init: players => create(players.map(p => p.name), players.map(() => 0), 0),

  move(s, me, d) {
    if (d.type !== 'guess') return { error: 'Nieznany ruch.' };
    if (s.phase === 'countdown') return { error: 'Zaczekaj na start rundy.' };
    if (s.phase !== 'play' || Date.now() > s.endsAt) return s; // spóźniona próba – ignorujemy po cichu
    if (s.done[me]) return s;
    const mine = s.guesses[me];
    if (d.n !== undefined && d.n !== mine.length) return s; // ta próba już została przyjęta (podwójny Enter)
    const word = String(d.word || '').normalize('NFC').toLocaleUpperCase('pl');
    if (!OK_WORD.test(word)) return { error: 'Wpisz dokładnie 5 polskich liter.' };
    if (VALID && !VALID.has(word) && !ANSWERS.includes(word)) return { error: 'Nie znam takiego słowa.' };
    const pat = score(word, s.answer);
    mine.push({ word, pat });
    if (word === s.answer) {
      s.done[me] = 'won'; s.winner = me;
      s.result = { name: s.names[me], tries: mine.length, t: Date.now() - s.startedAt };
      return toResults(s); // pierwszy wygrywa i kończy rundę
    }
    if (mine.length >= TRIES) {
      s.done[me] = 'lost';
      if (s.done.every(Boolean)) return toResults(s);
    }
    return s;
  },

  tick(s) {
    if (s.phase === 'countdown') { s.phase = 'play'; s.startedAt = Date.now(); s.endsAt = s.startedAt + PLAY_MS; return s; }
    if (s.phase === 'play') return toResults(s);
    if (s.phase === 'results') { if (s.idx + 1 >= ROUNDS) return finish(s); s.idx++; return startRound(s); }
    s.endsAt = null; return s;
  },

  // własne próby widać z literami, cudze tylko jako kolory; po rundzie wszystko jest jawne
  view(s, me) {
    const reveal = s.phase === 'results' || s.phase === 'over';
    return {
      names: s.names, scores: s.scores, wins: s.wins, round: s.round, phase: s.phase, idx: s.idx,
      rounds: ROUNDS, tries: TRIES, done: s.done, winner: s.winner, result: s.result,
      answer: reveal ? s.answer : null,
      guesses: s.guesses.map((g, i) => g.map(x => ({ pat: x.pat, word: (i === me || reveal) ? x.word : null }))),
      msLeft: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : 0
    };
  },

  rematch(s) { return s.phase === 'over' ? create(s.names, s.wins, s.round + 1) : s; },

  onLeave(s, idx) {
    s.names.splice(idx, 1); s.scores.splice(idx, 1); s.wins.splice(idx, 1);
    if (s.names.length < 2) return null;
    if (s.phase === 'over') return s;
    s.guesses.splice(idx, 1); s.done.splice(idx, 1);
    if (s.winner === idx) s.winner = null; else if (s.winner !== null && s.winner > idx) s.winner--;
    if (s.phase === 'play' && s.done.every(Boolean)) return toResults(s);
    return s;
  },

  _test: { score, ANSWERS }
};
