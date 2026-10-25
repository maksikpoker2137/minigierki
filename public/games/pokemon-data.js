// Pokémon do gry „Paczki kart” – wspólna lista dla serwera (require) i przeglądarki (<script>).
// Dane pochodzą z tabeli (ID, nazwa, typy, min. poziom, ewolucja). Żeby dodać kolejne Pokémony, dopisz wiersz do RAW.
// Format: [nr w Pokédeksie, nazwa, [typy], min. poziom, rarity, id obrazka w PokeAPI (gdy inne niż nr)]
// Rzadkość: c = zwykła (1 pkt), u = niezwykła (2), r = rzadka (4), e = Mega (8), l = Gigantamax (15).
(function (root) {
  const RARITY = {
    c: { id: 'c', name: 'Zwykła',      pts: 1,  color: '#9aa3c7', stars: 1 },
    u: { id: 'u', name: 'Niezwykła',   pts: 2,  color: '#4cc9f0', stars: 2 },
    r: { id: 'r', name: 'Rzadka',      pts: 4,  color: '#ffd166', stars: 3 },
    e: { id: 'e', name: 'Mega',        pts: 8,  color: '#b86bff', stars: 4 },
    l: { id: 'l', name: 'Gigantamax',  pts: 15, color: '#ff5d8f', stars: 5 }
  };

  const TYPES = {
    grass:  { name: 'Roślinny',   icon: '🌿', color: '#4caf50' },
    poison: { name: 'Trujący',    icon: '☠️', color: '#a24dbd' },
    fire:   { name: 'Ogień',      icon: '🔥', color: '#f0642d' },
    flying: { name: 'Latający',   icon: '🪽', color: '#7fa6e8' },
    water:  { name: 'Woda',       icon: '💧', color: '#3d8bf0' },
    bug:    { name: 'Robak',      icon: '🐛', color: '#8cb62a' },
    normal: { name: 'Normalny',   icon: '⚪', color: '#a8a590' },
    dragon: { name: 'Smok',       icon: '🐉', color: '#6a5bd6' },
    electric:{ name: 'Elektryczny',icon: '⚡', color: '#f5c518' },
    ground: { name: 'Ziemny',     icon: '🏜️', color: '#c9a15a' },
    fairy:  { name: 'Wróżka',     icon: '🧚', color: '#f58fc4' },
    fighting:{ name: 'Walczący',   icon: '🥊', color: '#c0392b' }
  };

  const RAW = [
    [1,  'Bulbasaur',           ['grass', 'poison'],  1,  'c'],
    [2,  'Ivysaur',             ['grass', 'poison'],  16, 'u'],
    [3,  'Venusaur',            ['grass', 'poison'],  32, 'r'],
    [3,  'Mega Venusaur',       ['grass', 'poison'],  32, 'e', 10033],
    [3,  'Gigantamax Venusaur', ['grass', 'poison'],  32, 'l', 10195],
    [4,  'Charmander',          ['fire'],             1,  'c'],
    [5,  'Charmeleon',          ['fire'],             16, 'u'],
    [6,  'Charizard',           ['fire', 'flying'],   36, 'r'],
    [6,  'Mega Charizard X',    ['fire', 'dragon'],   36, 'e', 10034],
    [6,  'Mega Charizard Y',    ['fire', 'flying'],   36, 'e', 10035],
    [6,  'Gigantamax Charizard',['fire', 'flying'],   36, 'l', 10196],
    [7,  'Squirtle',            ['water'],            1,  'c'],
    [8,  'Wartortle',           ['water'],            16, 'u'],
    [9,  'Blastoise',           ['water'],            36, 'r'],
    [9,  'Mega Blastoise',      ['water'],            36, 'e', 10036],
    [9,  'Gigantamax Blastoise',['water'],            36, 'l', 10197],
    [10, 'Caterpie',            ['bug'],              1,  'c'],
    [11, 'Metapod',             ['bug'],              7,  'u'],
    [12, 'Butterfree',          ['bug', 'flying'],    10, 'r'],
    [12, 'Gigantamax Butterfree',['bug', 'flying'],   10, 'l', 10198],
    [13, 'Weedle',              ['bug', 'poison'],    1,  'c'],
    [14, 'Kakuna',              ['bug', 'poison'],    7,  'u'],
    [15, 'Beedrill',            ['bug', 'poison'],    10, 'r'],
    [15, 'Mega Beedrill',       ['bug', 'poison'],    10, 'e', 10090],
    [16, 'Pidgey',              ['normal', 'flying'], 1,  'c'],
    [17, 'Pidgeotto',           ['normal', 'flying'], 18, 'u'],
    [18, 'Pidgeot',             ['normal', 'flying'], 36, 'r'],
    [18, 'Mega Pidgeot',        ['normal', 'flying'], 36, 'e', 10073],
    [19, 'Rattata',             ['normal'],           1,  'c'],
    [20, 'Raticate',            ['normal'],           20, 'u'],
    [21, 'Spearow',             ['normal', 'flying'], 1,  'c'],
    [22, 'Fearow',              ['normal', 'flying'], 20, 'u'],
    [23, 'Ekans',               ['poison'],           1,  'c'],
    [24, 'Arbok',               ['poison'],           22, 'u'],
    [25, 'Pikachu',             ['electric'],         12, 'u'],
    [25, 'Gigantamax Pikachu',  ['electric'],         12, 'l', 10199],
    [26, 'Raichu',              ['electric'],         25, 'r'],
    [27, 'Sandshrew',           ['ground'],           1,  'c'],
    [28, 'Sandslash',           ['ground'],           22, 'u'],
    [29, 'Nidoran ♀',           ['poison'],           1,  'c'],
    [30, 'Nidorina',            ['poison'],           16, 'u'],
    [31, 'Nidoqueen',           ['poison', 'ground'], 32, 'r'],
    [32, 'Nidoran ♂',           ['poison'],           1,  'c'],
    [33, 'Nidorino',            ['poison'],           16, 'u'],
    [34, 'Nidoking',            ['poison', 'ground'], 32, 'r'],
    [35, 'Clefairy',            ['fairy'],            12, 'c'],
    [36, 'Clefable',            ['fairy'],            25, 'u'],
    [37, 'Vulpix',              ['fire'],             1,  'c'],
    [38, 'Ninetales',           ['fire'],             16, 'u'],
    [39, 'Jigglypuff',          ['normal', 'fairy'],  12, 'c'],
    [40, 'Wigglytuff',          ['normal', 'fairy'],  25, 'u'],
    [41, 'Zubat',               ['poison', 'flying'], 1,  'c'],
    [42, 'Golbat',              ['poison', 'flying'], 22, 'u'],
    [43, 'Oddish',              ['grass', 'poison'],  1,  'c'],
    [44, 'Gloom',               ['grass', 'poison'],  21, 'u'],
    [45, 'Vileplume',           ['grass', 'poison'],  40, 'r'],
    [46, 'Paras',               ['bug', 'grass'],     1,  'c'],
    [47, 'Parasect',            ['bug', 'grass'],     24, 'u'],
    [48, 'Venonat',             ['bug', 'poison'],    1,  'c'],
    [49, 'Venomoth',            ['bug', 'poison'],    31, 'u'],
    [50, 'Diglett',             ['ground'],           1,  'c'],
    [51, 'Dugtrio',             ['ground'],           26, 'u'],
    [52, 'Meowth',              ['normal'],           1,  'c'],
    [52, 'Gigantamax Meowth',   ['normal'],           1,  'l', 10200],
    [53, 'Persian',             ['normal'],           28, 'u'],
    [54, 'Psyduck',             ['water'],            1,  'c'],
    [55, 'Golduck',             ['water'],            33, 'u'],
    [56, 'Mankey',              ['fighting'],         1,  'c'],
    [57, 'Primeape',            ['fighting'],         28, 'u'],
    [58, 'Growlithe',           ['fire'],             1,  'c'],
    [59, 'Arcanine',            ['fire'],             25, 'r'],
    [60, 'Poliwag',             ['water'],            1,  'c']
  ];

  // każda karta ma unikalne "id" (kolejny numer na liście) – nr Pokédeksu się powtarza (Mega, Gigantamax)
  const CARDS = RAW.map((r, i) => ({ id: i, dex: r[0], name: r[1], types: r[2], lvl: r[3], rarity: r[4], img: r[5] || r[0] }));
  const byRarity = {}; Object.keys(RARITY).forEach(k => { byRarity[k] = CARDS.filter(c => c.rarity === k).map(c => c.id); });

  // sprite pobierany w przeglądarce z PokeAPI; gdy się nie załaduje, karta pokazuje emoji typu
  const artUrl = c => 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + c.img + '.png';

  // rodzaje paczek: mieszana + po jednej na każdy typ, który ma co najmniej 3 karty
  const PACK_NAME = { grass: 'Roślinna', poison: 'Trująca', fire: 'Ognista', flying: 'Latająca', water: 'Wodna', bug: 'Robacza', normal: 'Normalna', electric: 'Elektryczna', ground: 'Ziemna', fairy: 'Wróżek', dragon: 'Smocza' };
  const PACKS = [{ id: 'mixed', name: 'Mieszana', icon: '🎴', ids: CARDS.map(c => c.id) }];
  Object.keys(TYPES).forEach(t => {
    const ids = CARDS.filter(c => c.types.includes(t)).map(c => c.id);
    if (ids.length >= 3) PACKS.push({ id: t, name: PACK_NAME[t] || TYPES[t].name, icon: TYPES[t].icon, ids });
  });
  const pack = id => PACKS.find(p => p.id === id) || PACKS[0];

  // ---- walka: statystyki i tabela skuteczności typów (wspólne dla serwera i przeglądarki) ----
  const POWER = { c: 40, u: 60, r: 85, e: 115, l: 145 };
  const stats = (c, holo) => { // c = karta z CARDS; karta holo ma o 15% wyższe statystyki
    const pw = POWER[c.rarity] + c.lvl * 0.5, m = holo ? 1.15 : 1;
    return { hp: Math.round((50 + pw * 1.5) * m), atk: Math.round((20 + pw * 0.6) * m), def: Math.round((15 + pw * 0.4) * m), spd: Math.round((30 + pw * 0.5 + c.dex % 7) * m) };
  };
  // CHART[typ ataku][typ obrońcy] = mnożnik (brak wpisu = 1)
  const CHART = {
    normal:   {},
    fire:     { grass: 2, bug: 2, fire: .5, water: .5, dragon: .5 },
    water:    { fire: 2, ground: 2, water: .5, grass: .5, dragon: .5 },
    electric: { water: 2, flying: 2, electric: .5, grass: .5, dragon: .5, ground: 0 },
    grass:    { water: 2, ground: 2, fire: .5, grass: .5, poison: .5, flying: .5, bug: .5, dragon: .5 },
    fighting: { normal: 2, poison: .5, flying: .5, bug: .5, fairy: .5 },
    poison:   { grass: 2, fairy: 2, poison: .5, ground: .5 },
    ground:   { fire: 2, electric: 2, poison: 2, grass: .5, bug: .5, flying: 0 },
    flying:   { grass: 2, fighting: 2, bug: 2, electric: .5 },
    bug:      { grass: 2, fire: .5, fighting: .5, poison: .5, flying: .5, fairy: .5 },
    dragon:   { dragon: 2, fairy: 0 },
    fairy:    { fighting: 2, dragon: 2, fire: .5, poison: .5 }
  };
  const eff = (at, defTypes) => defTypes.reduce((m, d) => m * (CHART[at] && CHART[at][d] !== undefined ? CHART[at][d] : 1), 1);
  // najlepszy atak: z dwóch typów atakującego wybieramy skuteczniejszy; gdy oba nie działają – „Szamotanina” (×0,5)
  const bestMove = (atkTypes, defTypes) => {
    let best = { type: atkTypes[0], eff: eff(atkTypes[0], defTypes) };
    atkTypes.forEach(t => { const e = eff(t, defTypes); if (e > best.eff) best = { type: t, eff: e }; });
    return best.eff === 0 ? { type: 'normal', eff: .5, struggle: true } : best;
  };

  const api = { RARITY, TYPES, CARDS, byRarity, artUrl, PACKS, pack, stats, eff, bestMove, TEAM: 3, POWER_ORDER: c => POWER[CARDS[c.id].rarity] * (c.holo ? 1.15 : 1) + CARDS[c.id].lvl * 0.5 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PokeData = api;
})(typeof window !== 'undefined' ? window : globalThis);
