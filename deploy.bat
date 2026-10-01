@echo off
setlocal
REM =====================================================================
REM  StockEz - Deploy to production (Contabo Mumbai, Docker)
REM
REM  Replaces the pre-July script, which targeted the deleted Hetzner box
REM  (178.105.190.214) and assumed /var/www + systemd. Neither exists now:
REM  the app runs as docker compose, frontend served from inside the
REM  stockez-web container. Old copy kept as deploy.bat.old-hetzner.
REM
REM  Builds happen ON THE SERVER inside Docker, so no local npm/maven run.
REM =====================================================================
set SERVER=root@62.72.42.174
set ROOT=C:\Users\Kathiravan\Desktop\StockEz
set REMOTE=/opt/stockez
set COMPOSE=-f docker-compose.prod.yml -f docker-compose.tuning.yml

echo.
echo =========================================
echo   StockEz - Deploy to %SERVER%
echo =========================================

echo.
echo [1/6] Tagging current images for rollback...
ssh %SERVER% "TS=$(date +%%Y%%m%%d-%%H%%M); for s in stockez-api stockez-web; do docker tag $(docker inspect --format '{{.Config.Image}}' $s) rollback-$s:$TS; done; echo $TS > %REMOTE%/.last-rollback-tag; echo tagged $TS"
if errorlevel 1 (echo TAGGING FAILED & pause & exit /b 1)

echo.
echo [2/6] Packaging source...
cd /d "%ROOT%"
tar czf "%TEMP%\stockez-deploy.tar.gz" --exclude=.git --exclude=node_modules --exclude=target --exclude=dist --exclude=deploy/logs --exclude=deploy/nginx-logs --exclude=deploy/certs --exclude=deploy/.env stockez-api stockez-web stockez-common Dockerfile Dockerfile.web pom.xml deploy/nginx.prod.conf deploy/docker-compose.prod.yml deploy/docker-compose.tuning.yml
if errorlevel 1 (echo PACKAGING FAILED & pause & exit /b 1)

echo.
echo [3/6] Uploading...
scp -O "%TEMP%\stockez-deploy.tar.gz" %SERVER%:/tmp/
if errorlevel 1 (echo UPLOAD FAILED & pause & exit /b 1)

echo.
echo [4/6] Extracting ^(.env and certs preserved^)...
ssh %SERVER% "cd %REMOTE% && cp -a deploy/.env /tmp/env.keep && tar xzf /tmp/stockez-deploy.tar.gz -C %REMOTE% && cp -a /tmp/env.keep deploy/.env && chmod 600 deploy/.env && rm -f /tmp/env.keep && chown -R root:root %REMOTE% && docker exec stockez-web nginx -t"
if errorlevel 1 (echo EXTRACT OR NGINX CONFIG FAILED & pause & exit /b 1)

echo.
echo [5/6] Building images ^(site stays up during this^)...
ssh %SERVER% "cd %REMOTE%/deploy && docker compose %COMPOSE% build"
if errorlevel 1 (echo BUILD FAILED - nothing deployed, site untouched & pause & exit /b 1)

echo.
echo [6/6] Swapping containers ^(~60s API downtime, Flyway runs^)...
ssh %SERVER% "cd %REMOTE%/deploy && docker compose %COMPOSE% up -d --force-recreate"
if errorlevel 1 (echo SWAP FAILED & pause & exit /b 1)

echo.
echo Verifying...
ssh %SERVER% "sleep 25; curl -sk -o /dev/null -w 'health: %%{http_code}\n' https://localhost/actuator/health; docker compose -f %REMOTE%/deploy/docker-compose.prod.yml ps --format '{{.Name}}: {{.Status}}'"

echo.
echo =========================================
echo   Deploy complete.
echo   Rollback:  ssh %SERVER%
echo              TS=$(cat %REMOTE%/.last-rollback-tag)
echo              docker tag rollback-stockez-api:$TS stockez-stockez-api:latest
echo              docker tag rollback-stockez-web:$TS stockez-stockez-web:latest
echo              cd %REMOTE%/deploy ^&^& docker compose %COMPOSE% up -d
echo =========================================
pause
