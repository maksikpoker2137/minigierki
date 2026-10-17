@echo off
title Gry ze znajomymi - serwer
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Nie znaleziono Node.js.
  echo Pobierz wersje LTS ze strony https://nodejs.org, zainstaluj i uruchom ten plik ponownie.
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo Pierwsze uruchomienie - instaluje potrzebne pakiety, chwila...
  call npm install
  if errorlevel 1 (
    echo.
    echo Instalacja sie nie udala. Sprawdz polaczenie z internetem.
    pause
    exit /b
  )
)

echo.
echo ============================================================
echo  Dla znajomych z TEJ SAMEJ sieci wi-fi (adres + :3000):
ipconfig | findstr /i "IPv4"
echo  Przyklad: jesli widzisz 192.168.0.15, znajomi wpisuja
echo  http://192.168.0.15:3000
echo ============================================================
echo.
echo Uruchamiam serwer. Nie zamykaj tego okna, dopoki gracie.
echo Aby wylaczyc serwer, zamknij okno lub nacisnij Ctrl+C.
echo.

start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
call npm start

echo.
echo Serwer zostal zatrzymany.
pause
