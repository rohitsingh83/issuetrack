@echo off
title IssueTrack — Jira-Style Issue Tracker
color 0B

echo =====================================================================
echo             ISSUETRACK — JIRA-STYLE ISSUE ^& BUG TRACKER
echo =====================================================================
echo.
echo Starting IssueTrack Full-Stack Application:
echo   [1] Frontend (React + Vite + Tailwind)  -^> http://localhost:5173
echo   [2] Backend API (Node + Express + Mongo) -^> http://localhost:4000
echo.
echo Database:
echo   - Automatic Persistence: Embedded MongoDB (Zero Setup Required)
echo   - Real MongoDB Atlas/Local supported via server/.env
echo.
echo Seeded Demo Accounts (Password: Password123!):
echo   - Owner:  owner@demo.dev
echo   - Admin:  admin@demo.dev
echo   - Member: member@demo.dev
echo   - Viewer: viewer@demo.dev
echo.
echo Press Ctrl+C at any time to stop both servers.
echo =====================================================================
echo.

:: Automatically open browser after 4 seconds
start "" powershell -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:5173'"

:: Run both client and server concurrently
npm run dev

