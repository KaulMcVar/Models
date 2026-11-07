@echo off
cd /d "%~dp0"
if not exist node_modules call npm install --no-audit --no-fund
call npm run build || (echo Build failed & pause & exit /b 1)
start "" http://127.0.0.1:4321
node server.js
pause
