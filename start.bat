@echo off
title DistroIQ Launcher

echo.
echo  =========================================
echo   DistroIQ - Starting Services
echo  =========================================
echo.

:: Kill anything on port 8080
echo  Clearing port 8080...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Kill any leftover Java processes from previous run
taskkill /IM java.exe /F >nul 2>&1

echo  Starting Backend  (port 8080)...
start "DistroIQ Backend" cmd /k "cd /d C:\Users\Kathiravan\Desktop\distroiq\distroiq-api && echo Backend starting... && .\mvnw.cmd spring-boot:run -Dspring-boot.run.jvmArguments="-Xms128m -Xmx384m""

echo  Waiting 5 seconds before starting frontend...
timeout /t 5 /nobreak >nul

echo  Starting Frontend (port 5173)...
start "DistroIQ Frontend" cmd /k "cd /d C:\Users\Kathiravan\Desktop\distroiq\distroiq-web && echo Frontend starting... && npm run dev"

echo.
echo  =========================================
echo   Services are starting in new windows
echo  =========================================
echo.
echo  BACKEND  window : Wait for this line:
echo    "Started DistroIQApplication in XX seconds"
echo.
echo  FRONTEND window : Wait for this line:
echo    "Local: http://localhost:5173/"
echo.
echo  Then open browser: http://localhost:5173
echo.
echo  Login:
echo    Username : 9876543210
echo    Password : Admin@1234
echo.
echo  If backend fails, copy the RED error line and report it.
echo.
pause
