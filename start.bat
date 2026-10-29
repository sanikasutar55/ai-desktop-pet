@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download it from https://nodejs.org , install it, then double-click this file again. & pause & exit /b)
if not exist node_modules (echo First run: installing, please wait... & call npm install)
start "Desktop Pet" /min cmd /c "npm start"
