@echo off
title TrackOps Production v1.0
echo ========================================================
echo Starting TrackOps Production v1.0 Server (Port 5000)...
echo Environment: PRODUCTION
echo Database: trackops_prod
echo ========================================================
echo.
cd /d "%~dp0"
wsl -u root -d Ubuntu -e service postgresql status >nul 2>&1 || wsl -u root -d Ubuntu -e service postgresql start
start http://localhost:5000
npm run start
pause
