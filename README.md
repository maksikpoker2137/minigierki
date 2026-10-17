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
