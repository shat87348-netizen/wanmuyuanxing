@echo off
title Frontend Dev Server

cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] node_modules not found, running npm install...
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check Node.js installation.
        pause
        exit /b 1
    )
)

echo [INFO] Starting Vite dev server -^> http://localhost:5173
npm run dev
pause
