@echo off
chcp 65001 >nul
cls
echo.
echo ========================================
echo   ServisDrama - Server Baslatiliyor
echo ========================================
echo.

REM Python kontrol et
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo HATA: Python yuklenmemis!
    echo.
    echo Lutfen Python 3 indirin: https://www.python.org
    echo.
    pause
    exit /b 1
)

echo Python bulundu. Server baslatiliyor...
echo.
echo localhost:8000 adresinde acilacak...
echo.

cd /d "%~dp0"

REM Port 8000'i kes (eger baskas tarafından kullaniliyorsa)
netstat -ano | findstr :8000 >nul 2>&1
if not errorlevel 1 (
    echo Port 8000 mesgul, baskas bir uygulamadan kilitlenmis.
    echo.
    echo Lütfen tarayiciyi kapat veya bu coğ penceresini kapat sonra tekrar dene.
    pause
    exit /b 1
)

REM Tarayicida aç (optional)
timeout /t 1 /nobreak >nul 2>&1

REM Server basla
echo.
echo Server basliyor... (Cıkış için CTRL+C basın)
echo.

python -m http.server 8000

pause
