@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b)
if not exist node_modules call npm install
start "Desktop Pet" /min cmd /c "npm start -- --reset"
