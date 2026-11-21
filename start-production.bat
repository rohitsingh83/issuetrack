@echo off
title IssueTrack — Production Mode
color 0A

echo =====================================================================
echo         ISSUETRACK — PRODUCTION SINGLE-PORT FULL-STACK SERVER
echo =====================================================================
echo.
echo Building latest production assets...
call npm run build
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Build failed. Please check errors above.
  pause
  exit /b %errorlevel%
)

echo.
echo Starting Production Server on port 4000:
echo   - Full-Stack URL: http://localhost:4000
echo   - API Health:    http://localhost:4000/api/health
echo.
echo Demo Accounts (Password: Password123!):
echo   - Owner:  owner@demo.dev
echo   - Admin:  admin@demo.dev
echo   - Member: member@demo.dev
echo   - Viewer: viewer@demo.dev
echo.
echo Press Ctrl+C to terminate the server.
echo =====================================================================
echo.

:: Automatically open browser after 3 seconds
start "" powershell -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:4000'"

:: Start the production server
npm start

