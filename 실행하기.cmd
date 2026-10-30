@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem 현재 폴더에서만 실행하며 외부 배포를 수행하지 않습니다.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 이상을 먼저 설치해 주세요.
  pause
  exit /b 1
)
node scripts\check-running.cjs
if errorlevel 42 (
  echo 이미 실행 중인 로컬 베이킹랩을 엽니다.
  start "" "http://127.0.0.1:3210"
  exit /b 0
)
if not exist node_modules\playwright-core\package.json (
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm run db:setup
if errorlevel 1 (
  pause
  exit /b 1
)
echo.
echo 우리집 베이킹랩 주소: http://127.0.0.1:3210
echo 이 창을 닫거나 Ctrl+C를 누르면 로컬 서버가 종료됩니다.
echo.
call npm run dev:local
pause
