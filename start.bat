@echo off
title StockEz Launcher

echo.
echo  =========================================
echo   StockEz - Starting Services
echo  =========================================
echo.

:: Kill anything on port 8080
echo  Clearing port 8080...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo  Starting Backend  (port 8080)...
start "StockEz Backend" cmd /k "cd /d C:\Users\Kathiravan\Desktop\StockEz\stockez-api && .\mvnw.cmd spring-boot:run"

echo  Waiting 5 seconds before starting frontend...
timeout /t 5 /nobreak >nul

echo  Starting Frontend (port 5173)...
start "StockEz Frontend" cmd /k "cd /d C:\Users\Kathiravan\Desktop\StockEz\stockez-web && npm run dev"

echo.
echo  =========================================
echo   Services are starting in new windows
echo  =========================================
echo.
echo  BACKEND  window : Wait for "Started StockEzApplication in XX seconds"
echo  FRONTEND window : Wait for "Local: http://localhost:5173/"
echo.
echo  Then open: http://localhost:5173
echo.
echo  Login:
echo    Username : 9876543210
echo    Password : Admin@1234
echo.
pause
