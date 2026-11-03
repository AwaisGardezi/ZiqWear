@echo off
setlocal EnableExtensions
title ZIQWEAR - run the whole platform
cd /d "%~dp0"

cls
echo.
echo   ==========================================================
echo      ZIQWEAR  ^|  Zenith In Quality Wear
echo      One launcher for the whole platform
echo   ==========================================================
echo.
echo     Each service runs in its own window.
echo     Close that window to stop that service.
echo     Nothing here touches the database schema.
echo.

:: ---------------------------------------------------------------- settings
:: Test orders on the local static server would otherwise email the shop for
:: real, using the SMTP credentials in .env. Delete this line to switch mail back on.
set "ZIQ_MAIL_OFF=1"

set "API_PORT=4000"
set "SITE_PORT=8777"
set "SHOP_PORT=3000"
set "ADMIN_PORT=3001"

set "STARTED="
set "MISSING="

:: ---------------------------------------------------------------- backend
if not exist "backend\package.json" goto backend_skip
if not exist "backend\.env" if exist ".env.example" (
    echo [setup] Creating backend\.env from .env.example - edit it to add secrets.
    copy /y ".env.example" "backend\.env" >nul
)
if not exist "backend\node_modules" (
    echo [setup] Installing backend dependencies, this runs once...
    pushd "%~dp0backend"
    call npm install --no-audit --no-fund
    popd
)
if not exist "backend\node_modules\.prisma" (
    echo [setup] Generating the Prisma client...
    pushd "%~dp0backend"
    call npx prisma generate
    popd
)
echo [1/4] Starting the API on port %API_PORT% ...
pushd "%~dp0backend"
start "ZIQWEAR API %API_PORT%" cmd /k npm run dev
popd
set "STARTED=%STARTED% API"
:backend_skip

:: ------------------------------------------------- static storefront site
if not exist "server.ps1" goto site_skip
if not exist "index.html" goto site_skip
echo [2/4] Starting the static storefront on port %SITE_PORT% ...
start "ZIQWEAR Static %SITE_PORT%" cmd /k powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %SITE_PORT%
set "STARTED=%STARTED% Static"
:site_skip

:: ------------------------------------------------------ React storefront
if not exist "frontend\package.json" goto shop_skip
if not exist "frontend\node_modules" (
    echo [setup] Installing storefront dependencies, this runs once...
    pushd "%~dp0frontend"
    call npm install --no-audit --no-fund
    popd
)
echo [3/4] Starting the React storefront on port %SHOP_PORT% ...
pushd "%~dp0frontend"
start "ZIQWEAR Storefront %SHOP_PORT%" cmd /k npm run dev
popd
set "STARTED=%STARTED% Storefront"
:shop_skip

:: -------------------------------------------------------- React admin panel
if not exist "admin-dashboard\package.json" goto admin_skip
if not exist "admin-dashboard\node_modules" (
    echo [setup] Installing admin dependencies, this runs once...
    pushd "%~dp0admin-dashboard"
    call npm install --no-audit --no-fund
    popd
)
echo [4/4] Starting the admin dashboard on port %ADMIN_PORT% ...
pushd "%~dp0admin-dashboard"
start "ZIQWEAR Admin %ADMIN_PORT%" cmd /k npm run dev
popd
set "STARTED=%STARTED% Admin"
:admin_skip

:: ---------------------------------------------------------------- wait up
echo.
echo     Waiting for the services to answer...
if exist "backend\package.json" call :wait %API_PORT% /health
if exist "server.ps1" call :wait %SITE_PORT% /index.html
if exist "frontend\package.json" call :wait %SHOP_PORT% /
if exist "admin-dashboard\package.json" call :wait %ADMIN_PORT% /

:: ---------------------------------------------------------------- summary
echo.
echo   ---------------------------------------------------------
if not "%STARTED%"=="" echo     Running:%STARTED%
echo   ---------------------------------------------------------
echo.
if exist "index.html" echo     Static storefront    http://localhost:%SITE_PORT%/index.html
if exist "wardrobe.html" echo     The 3D rail          http://localhost:%SITE_PORT%/wardrobe.html
if exist "backend\package.json" echo     Storefront via API   http://localhost:%API_PORT%/legacy/index.html
if exist "frontend\package.json" echo     React storefront     http://localhost:%SHOP_PORT%/
if exist "admin-dashboard\package.json" echo     Admin dashboard      http://localhost:%ADMIN_PORT%/
if exist "backend\package.json" echo     Health check         http://localhost:%API_PORT%/health
echo.
if "%ZIQ_MAIL_OFF%"=="1" (
    echo     Mail is OFF for test orders. Remove the ZIQ_MAIL_OFF
    echo     line in this file to send real order emails while testing.
) else (
    echo     Mail is ON: a test order emails the shop for real.
)
echo.
echo     An order placed on the static site is mirrored into the API
echo     database as well, so it shows in the admin dashboard.
echo.
echo     Close a service window to stop that service.
echo.

if /i "%~1"=="open" (
    if exist "index.html" start "" "http://localhost:%SITE_PORT%/index.html"
    if exist "frontend\package.json" start "" "http://localhost:%SHOP_PORT%/"
    if exist "admin-dashboard\package.json" start "" "http://localhost:%ADMIN_PORT%/"
)
goto :eof


:: ------------------------------------------------------------------ helper
:wait
set /a tries=0
:wait_loop
curl -s -f -o nul --max-time 2 http://localhost:%1%2
if not errorlevel 1 goto wait_done
set /a tries+=1
if %tries% lss 45 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)
echo       note: port %1 did not answer yet - check that service window
goto :eof
:wait_done
echo       ok - port %1 answered
goto :eof
