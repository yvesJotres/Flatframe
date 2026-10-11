@echo off
REM ------------------------------------------------
REM Launch Flatframe: starts the game server and opens it in the browser.
REM Phones can join via the links printed below.
REM ------------------------------------------------
title Flatframe server
cd /d "%~dp0"

echo Flatframe is starting...
echo.
echo   This PC:          http://localhost:8080
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo   Phone / network:  http://%%b:8080
)
echo.
echo Keep this window open while playing. Close it to stop the server.
echo ------------------------------------------------
echo.

REM live-server opens the browser itself; host 0.0.0.0 lets phones connect
call npx live-server --port=8080 --host=0.0.0.0

echo.
echo ------------------------------------------------
echo Server stopped or crashed.
pause
