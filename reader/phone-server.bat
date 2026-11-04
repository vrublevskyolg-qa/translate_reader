@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  Книжка для телефона. Відкрийте на iPhone (та сама Wi-Fi мережа):
for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi*','Ethernet*' -PrefixOrigin Dhcp -ErrorAction SilentlyContinue).IPAddress"`) do echo      http://%%a:8000
echo.
echo  Поки це вікно відкрите - книжка доступна. Щоб зупинити, закрийте вікно.
echo.
python -m http.server 8000
pause
