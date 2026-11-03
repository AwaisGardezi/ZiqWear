@echo off
setlocal EnableExtensions
title ZIQWEAR - Build client package
cd /d "%~dp0"

cls
echo.
echo   ============================================================
echo      ZIQWEAR   ^|   Build a clean folder for the client
echo   ============================================================
echo.

if not exist "index.html" (
  echo   ERROR: index.html was not found next to this file.
  echo.
  pause
  exit /b 1
)
if not exist "server.ps1" (
  echo   ERROR: server.ps1 was not found next to this file.
  echo.
  pause
  exit /b 1
)

set "OUT=ziqwear-client"
set "ZIP=ziqwear-client.zip"

echo   Cleaning previous build...
if exist "%OUT%" rmdir /s /q "%OUT%"
if exist "%ZIP%" del /q "%ZIP%"

echo   Copying the website...
rem Only these items are copied - the pages, the assets folder, the launcher
rem and the server. Anything else that happens to sit in this folder is
rem ignored, so the client always receives the site and nothing more.
robocopy "%~dp0." "%OUT%" *.html /LEV:1 /NFL /NDL /NJH /NJS /NP >nul
robocopy "%~dp0assets" "%OUT%\assets" /E /NFL /NDL /NJH /NJS /NP >nul
copy /y "RUN-ZIQWEAR.bat" "%OUT%\" >nul
copy /y "server.ps1" "%OUT%\" >nul

rem The local copy keeps test orders from mailing the shop. The client copy must
rem send them, so clear that switch in the packaged launcher.
powershell -NoProfile -Command "((Get-Content -LiteralPath '%OUT%\RUN-ZIQWEAR.bat' -Raw) -replace 'ZIQ_MAIL_OFF=1','ZIQ_MAIL_OFF=') | Set-Content -LiteralPath '%OUT%\RUN-ZIQWEAR.bat' -Encoding ASCII -NoNewline"

rem Ship the env template only - real credentials live in .env, which stays on this machine.
if exist ".env.example" copy /y ".env.example" "%OUT%\" >nul

if not exist "%OUT%\index.html" (
  echo.
  echo   ERROR: the copy failed. Close any open files and try again.
  echo.
  pause
  exit /b 1
)

echo   Zipping...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Compress-Archive -Path '%OUT%\*' -DestinationPath '%ZIP%' -CompressionLevel Optimal -Force"

if not exist "%ZIP%" (
  echo.
  echo   The folder was built at "%OUT%" but zipping failed.
  echo   You can still send that folder as it is.
  echo.
  pause
  exit /b 1
)

echo.
echo   ============================================================
echo      Done.
echo      Folder : %OUT%\
echo      Zip    : %ZIP%
echo   ============================================================
echo.
echo   Send either one to the client. Both contain the website,
echo   the launcher and the server - nothing else.
echo.
pause
