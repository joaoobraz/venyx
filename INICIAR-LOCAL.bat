@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 22 LTS antes de iniciar o Fanlira.
  echo https://nodejs.org/
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo Falta o arquivo .env.local.
  echo Duplique .env.example, renomeie para .env.local e preencha os dados.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Preparando o Fanlira pela primeira vez...
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

echo Abrindo o Fanlira no navegador...
call npm run dev -- --open --host 127.0.0.1 --port 8080
pause
