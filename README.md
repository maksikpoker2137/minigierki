# Gry ze znajomymi

## Uruchomienie
1. Zainstaluj Node.js (https://nodejs.org, wersja LTS).
2. W folderze projektu: `npm install`, potem `npm start`.
3. Otwórz http://localhost:3000. Znajomi w tej samej sieci wchodzą na `http://TWOJE-IP:3000`.
   Żeby grać przez internet, wrzuć projekt na hosting z Node.js (np. Render, Railway, Fly.io).

## Jak dodać nową grę
1. `games/nazwa.js` – logika serwera: `meta`, `init(players)`, `move(state, playerIndex, data)` (wzór: `tictactoe.js`).
2. `public/games/nazwa.js` – wygląd: `Games.nazwa = { render(el, state, me, send) }`.
3. W `server.js` dopisz grę do obiektu `games`, w `public/index.html` dodaj `<script>` z plikiem.
Pokoje, nicki, kody, poczekalnia i wyniki działają dla wszystkich gier automatycznie.

## Paczki kart Pokémon
2–6 graczy. W każdej rundzie każdy otwiera własną paczkę 5 kart (klikasz kartę albo „Odkryj wszystkie”). Punkty zależą od rzadkości: zwykła 1, niezwykła 2, rzadka 4, **Mega 8**, **Gigantamax 15**; karta **holo ✨** (12% szans) daje ×2. Ostatnie miejsce w paczce jest „rzadkie” (szansa na Mega i Gigantamax). Gospodarz wybiera 3, 5 lub 10 paczek oraz tryb: **wybierasz typ paczki** (mieszana albo np. roślinna, ogień, woda, robak, trujący, elektryczna… – widać, ile kart z danej paczki już masz) lub same mieszane; wygrywa najwięcej punktów łącznie. Każdy zbiera też kolekcję (30 kart) – widać ją pod planszą.
Karty to 72 Pokémony z tabeli (nr 1–60, z formami Mega i Gigantamax) – lista jest w `public/games/pokemon-data.js` (wspólna dla serwera i przeglądarki). Żeby dodać kolejne, dopisz wiersz do `RAW`: nr w Pokédeksie, nazwa, typy, min. poziom, rzadkość (`c`/`u`/`r`/`e`/`l`) i opcjonalnie nr obrazka z PokeAPI. Obrazki ładują się z internetu (PokeAPI na GitHubie); bez nich karta pokazuje ikonę typu. Zawartość zakrytych kart zna tylko serwer.

**⚔️ Walka drużyn** (opcja „Tryb gry” w poczekalni): paczki otwiera się tak samo, ale zamiast punktów liczy się to, co wylosujesz. Po ostatniej paczce każdy układa **drużynę 3 kart** ze swojej kolekcji (kolejność = kolejność wchodzenia do walki; wybory są ukryte, dopóki wszyscy nie skończą). Potem drużyny walczą **każda z każdą** i wygrywa najwięcej wygranych pojedynków (przy remisie – więcej pozostałego życia). Statystyki karty (❤ życie, ⚔ atak, 🛡 obrona, ⚡ szybkość) wynikają z jej rzadkości i poziomu, karta holo ma o 15% więcej. W pojedynku szybsza karta bije pierwsza, każda używa skuteczniejszego ze swoich typów, a tabela przewag (np. ogień bije roślinę, woda ogień, elektryczność wodę, ziemia nie dosięga latających) jest w `public/games/pokemon-data.js` (`CHART`). Wyniki liczy serwer, przeglądarka odtwarza przebieg; wyniki turnieju pokazują się po obejrzeniu pojedynków (albo przyciskiem „Pokaż wyniki”).

## Wordle (wyścig)
Wszyscy w pokoju zgadują to samo 5-literowe słowo (6 prób, 5 rund). Kto pierwszy je odgadnie, wygrywa rundę i runda się kończy. Rywale widzą tylko kolory Twoich prób, nie litery.
Lista haseł jest w `games/wordle.js`. Domyślnie wolno wpisać dowolne 5 liter; jeśli położysz obok plik `games/wordle-dict.txt` (jedno słowo na linię), próby spoza słownika będą odrzucane.

## UNO
2–8 graczy, talia 108 kart, po 7 na start. Kolor lub wartość musi pasować, dzikie karty pasują zawsze; +2 i +4 się nie kumulują. Po dobraniu można zagrać tylko dobraną kartę albo spasować. Przy dwóch graczach zmiana kierunku działa jak stop.
Przy 1–2 kartach trzeba nacisnąć **UNO!** – kto zostanie z jedną kartą bez tego, może zostać złapany przez innych (+2 karty), zanim następny gracz wykona ruch. Tura trwa 40 s (`TURN_MS` w `games/uno.js`), potem serwer dobiera kartę za gracza. Wygrany rozdaniem +1 pkt, „Kolejna runda” zachowuje punkty.

## Szachy
Dwóch graczy, pełne zasady: roszada, bicie w przelocie, promocja (wybierasz figurę), szach, mat, pat, remis przez trzykrotne powtórzenie, 50 ruchów i za mało materiału. Można zaproponować remis (drugi gracz przyjmuje lub odrzuca) i poddać partię. Ruch: kliknij swoją figurę, potem pole docelowe. Zapis partii jest w notacji polskiej (S skoczek, G goniec, W wieża, H hetman, K król). Kolory zamieniają się w każdej kolejnej partii. Zegara nie ma.

## Arena Lawy
Strzelanka z widokiem z góry dla 2–4 graczy, gra na żywo (serwer liczy całą fizykę, tak jak w Pongu). Wygrywa ten, kto pierwszy zdobędzie 5 fragmentów (w 2v2: drużyna, która pierwsza zdobędzie 10).

**Opcje pokoju** (gospodarz wybiera w poczekalni):
- **Mapa** – 🌋 Arena Lawy (dwa jeziora lawy, kamienie, unik przez lawę), pięć dodatkowych map lawowych: 🏞️ Lawowa rzeka, 🏰 Fosa, 🏝️ Archipelag, 🪨 Głazowisko i ♟️ Szachownica (każda ma własne kolory ziemi i lawy), 🌲 Zielona łąka (piniowe rzędy, ścieżki, staw, płotki – układ na wzór planszy z gry w stylu Pokémon), ❄️ Zimowe jezioro (śnieg i skute lodem oczko pośrodku). Drzewa i skały zatrzymują pociski, woda i płotki tylko blokują ruch (można strzelać przez nie).
- **Tryb** – każdy na każdego albo **2 na 2** (dokładnie 4 graczy; drużyny: czerwoni = gracze 1 i 3 z listy, niebiescy = 2 i 4; bez friendly fire, rakieta nie rani sojuszników). Wynik drużyn jest na górze ekranu.
- **Widzenie** – normalne albo **🔦 tylko przed sobą**: widzisz stożek 90° o małym zasięgu (plus maleńki krąg wokół siebie). Reszta mapy jest zaciemniona, a serwer w ogóle nie wysyła pozycji wrogów spoza stożka, więc nie da się oszukiwać w narzędziach przeglądarki. W 2v2 sojusznicy dzielą wzrok. Martwy gracz widzi całą mapę.
- **Wydarzenia co 30 s** – pierwsze zawsze to boss, kolejne losowe: 👹 **boss na środku** (pierścienie pocisków i salwy w najbliższego gracza; kto zada mu najwięcej obrażeń, zostaje **legendą aż do śmierci**: +25% obrażeń, +8% prędkości, +40 maks. życia, szybsze strzelanie i regeneracja – poziomy kumulują się do ★★★), ☄️ deszcz meteorów (czerwone kręgi ostrzegają ~1,3 s), 🔥 szał obrażeń ×2, ⚡ przyspieszenie, 📦 zrzut przedmiotów, 💖 fala uzdrawiająca. Doszedł też nowy przedmiot **rage** (podwójne obrażenia przez 8 s).

W prawym dolnym rogu widzisz aktualną broń i ile masz amunicji (miga na czerwono, gdy zostaje mało); w lewym dolnym – licznik do następnego wydarzenia i aktywne buffy.

Na mapie leżą bronie: pistolet (start, nieskończona amunicja), pistolet maszynowy, strzelba, snajperka (widoczny laser!) i wyrzutnia rakiet (obszar rażenia + odrzut, który może wrzucić w lawę). Dochodzą bronie: karabin, rewolwer, minigun i miotacz ognia (krótki zasięg, płomień gaśnie w locie). Są też apteczki (+40 HP), tarcze (+50) i przyspieszenie. Zabity gracz upuszcza broń i wraca po 3 s z chwilową nietykalnością.
Sterowanie: WASD / strzałki – ruch, myszka – celowanie, lewy przycisk – strzał, spacja lub prawy przycisk – unik, **M** – dźwięk wł./wył. Na telefonie: lewy kciuk steruje ruchem, prawy celuje i strzela, przycisk „Unik” pod planszą.

**Dostrajanie:** stałe (obrażenia, tempo strzałów, amunicja, respawn, `EVENT_EVERY`, `BOSS_MS`, zasięg stożka `FOG_R`) są na początku `games/arena.js`. Mapy to dane w `public/games/arena-map.js` (ten plik czyta i serwer, i przeglądarka) – żeby dodać nową, dopisz obiekt do `maps` (prostokąty `trees`/`water`/`fence`/`rock`, `spawns`, `boss`); `sym([...])` odbija układ o 180°, żeby mapa była uczciwa. Nowe opcje pokoju dopisujesz w `meta.options` gry – poczekalnia wyrenderuje je sama.

**Bronie:** pistolet, pistolet maszynowy, karabin, rewolwer, strzelba, minigun, miotacz ognia, snajperka (pocisk o dużej prędkości, widoczny laser) i wyrzutnia rakiet.
**Dźwięk:** strzały, trafienie wroga, oberwanie, śmierć, frag, wybuchy i zbieranie przedmiotów (syntezowane w przeglądarce, bez plików audio); wyłączasz przyciskiem „Dźwięk” pod planszą albo klawiszem M.
**Kolory:** przycisk 🎨 w nagłówku – paleta (albo własny kolor) dla tła strony oraz ziemi i lawy na mapach lawowych. Wybór zapamiętuje się w przeglądarce.
**Ranking:** w poczekalni widać ranking wygranych całego serwera (zapis w `data/wins.json`, liczony po nicku, folder `data` jest w `.gitignore`).

## Co nowego
- **Arena Lawy**: serwer nie wywraca się już przy błędzie w pętli gry (boss znika zamiast crashować proces), a rysowanie w przeglądarce nie „zamarza” po błędzie.
  Po wygranej pojawia się napis **WIN** z konfetti i **głosowanie na następną mapę** (20 s, wygrywa większość, remis losuje; „Start teraz” pomija czekanie).
  Trzy nowe **duże mapy** (3200×1800, kamera podąża za graczem, minimapa): **Wielki las**, **Miasto**, **Labirynt** – dużo ścian, każda sprawdzona pod kątem tego, że wszystkie spawny i boss są osiągalne.
- **Państwa-miasta**: gotowe kategorie do kliknięcia (np. Marki aut, Zawód, Rzeka…), gotowe zestawy i nadal możliwość wpisania własnych.
- **Statki**: kadłuby zamiast kwadratów, animacje pudła/trafienia/zatopienia oraz dźwięki (armata, plusk, wybuch, zatopienie, sonar, wygrana/przegrana), przycisk wyciszenia.
