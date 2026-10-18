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

## Wordle (wyścig)
Wszyscy w pokoju zgadują to samo 5-literowe słowo (6 prób, 5 rund). Kto pierwszy je odgadnie, wygrywa rundę i runda się kończy. Rywale widzą tylko kolory Twoich prób, nie litery.
Lista haseł jest w `games/wordle.js`. Domyślnie wolno wpisać dowolne 5 liter; jeśli położysz obok plik `games/wordle-dict.txt` (jedno słowo na linię), próby spoza słownika będą odrzucane.

## UNO
2–8 graczy, talia 108 kart, po 7 na start. Kolor lub wartość musi pasować, dzikie karty pasują zawsze; +2 i +4 się nie kumulują. Po dobraniu można zagrać tylko dobraną kartę albo spasować. Przy dwóch graczach zmiana kierunku działa jak stop.
Przy 1–2 kartach trzeba nacisnąć **UNO!** – kto zostanie z jedną kartą bez tego, może zostać złapany przez innych (+2 karty), zanim następny gracz wykona ruch. Tura trwa 40 s (`TURN_MS` w `games/uno.js`), potem serwer dobiera kartę za gracza. Wygrany rozdaniem +1 pkt, „Kolejna runda” zachowuje punkty.

## Szachy
Dwóch graczy, pełne zasady: roszada, bicie w przelocie, promocja (wybierasz figurę), szach, mat, pat, remis przez trzykrotne powtórzenie, 50 ruchów i za mało materiału. Można zaproponować remis (drugi gracz przyjmuje lub odrzuca) i poddać partię. Ruch: kliknij swoją figurę, potem pole docelowe. Zapis partii jest w notacji polskiej (S skoczek, G goniec, W wieża, H hetman, K król). Kolory zamieniają się w każdej kolejnej partii. Zegara nie ma.

## Arena Lawy
Strzelanka z widokiem z góry dla 2–4 graczy, gra na żywo (serwer liczy całą fizykę, tak jak w Pongu). Wygrywa ten, kto pierwszy zdobędzie 5 fragmentów.
Na mapie są dwa jeziora lawy – lawa parzy (32 obr./s), ale **kamienie** na niej są bezpieczne, a **unik** (spacja / prawy przycisk myszy, odnawia się co ~2 s) pozwala przeskoczyć kawałek lawy bez obrażeń. Głazy na lądzie blokują ruch i pociski.
Bronie leżą na mapie i pojawiają się co kilka sekund: pistolet (start, nieskończona amunicja), pistolet maszynowy, strzelba, snajperka (widoczny laser!) i wyrzutnia rakiet (obszar rażenia + odrzut, który może wrzucić w lawę). Są też apteczki (+40 HP), tarcze (+50) i przyspieszenie. Zabity gracz upuszcza broń i wraca po 3 s z chwilową nietykalnością. Kto wpadnie w lawę zaraz po postrzeleniu, zalicza fragment strzelcowi.
Sterowanie: WASD / strzałki – ruch, myszka – celowanie, lewy przycisk – strzał, spacja lub prawy przycisk – unik. Klawisz **V** (lub przycisk pod planszą) przełącza widok: *cała plansza* albo *tylko przed sobą* – wtedy widzisz tylko stożek 90° przed postacią (zasięg 900) i **głazy zasłaniają widok**, więc nie widać przez nie przeciwników, pocisków ani przedmiotów. Na telefonie: lewy kciuk steruje ruchem, prawy celuje i strzela, przycisk „Unik” pod planszą.
**Mapy:** 6 map (Dwa jeziora, Lawowa rzeka, Fosa, Archipelag, Głazowisko, Szachownica) – co rundę losowana jest inna niż poprzednia. Mapy to dane na początku `public/games/arena-map.js` (jeziora lawy, mosty, kamienie, głazy, miejsca startu i przedmiotów), więc łatwo dopisać kolejną.
**Bronie:** pistolet, pistolet maszynowy, karabin, rewolwer, strzelba, minigun, miotacz ognia, snajperka i wyrzutnia rakiet. Snajperka trafia **natychmiast** (promień, bez lotu pocisku); głazy go zatrzymują.
**Dźwięk:** strzały, trafienie wroga, oberwanie, śmierć, frag, wybuchy i zbieranie przedmiotów (syntezowane w przeglądarce); wyłączasz przyciskiem „Dźwięk” lub klawiszem M.
**Kolory:** przycisk 🎨 w nagłówku – paleta (albo własny kolor) dla tła strony oraz ziemi i lawy w arenie.
**Ranking:** w poczekalni widać ranking wygranych całego serwera (zapis w `data/wins.json`, liczony po nicku).
Stałe do dostrojenia (obrażenia, tempo strzałów, ilość amunicji, czas respawnu) są na początku `games/arena.js`, a kształt mapy w `public/games/arena-map.js` (ten plik czyta i serwer, i przeglądarka).
