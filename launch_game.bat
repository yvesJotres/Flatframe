@echo off
REM ------------------------------------------------
REM Launch Flatframe (npm)
REM ------------------------------------------------

REM 1. Change to the project folder
cd /d "%~dp0"
echo Changed directory to: %cd%
echo.

REM 2. Run the npm script
REM Removed the && so that 'pause' runs even if npm fails
npm start

REM 3. This will now stay open so you can read the error
echo.
echo ------------------------------------------------
echo Process finished or crashed.
pause
exit
