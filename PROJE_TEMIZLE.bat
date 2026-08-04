@echo off
REM Bu dosyayi proje ana klasorunde bir kez calistirin.
REM Calisan uygulama dosyalarina dokunmaz; sadece paketlenmemesi gereken yedek/yerel dosyalari temizler.
if exist ".git" rmdir /s /q ".git"
if exist "node_modules" rmdir /s /q "node_modules"
if exist ".env" del /q ".env"
if exist "servisdrama.db" del /q "servisdrama.db"
if exist "admin.js.bak" del /q "admin.js.bak"
if exist "admin-v22.js" del /q "admin-v22.js"
if exist "tech-v22.js" del /q "tech-v22.js"
if exist "data-v22.js" del /q "data-v22.js"
if exist "email-template-v22.js" del /q "email-template-v22.js"
if exist "companies-v22.js" del /q "companies-v22.js"
if exist "numune-v22.js" del /q "numune-v22.js"
if exist "enhancements-v22.js" del /q "enhancements-v22.js"
if exist "style-v22.css" del /q "style-v22.css"
echo Gereksiz yerel ve yedek dosyalar temizlendi.
pause
