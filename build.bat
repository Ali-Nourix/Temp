@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found.
    echo Install the LTS version from https://nodejs.org and run build.bat again.
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install
if errorlevel 1 goto :failed

echo.
echo Building the Windows app...
call npm run build
if errorlevel 1 goto :failed

echo.
echo Done. The installer and the portable exe are in the dist folder.
pause
exit /b 0

:failed
echo.
echo The build failed. Read the messages above for the reason.
pause
exit /b 1
