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
