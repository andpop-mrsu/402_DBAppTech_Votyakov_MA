@echo off
chcp 65001 >nul

set DB_FILE=self-logger.db
set PROGRAM=self-logger.bat

:: Create DB and table if not exists
if not exist %DB_FILE% (
    sqlite3 %DB_FILE% "CREATE TABLE logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, datetime TEXT);"
)

:: Insert current launch info
for /f "tokens=2 delims==" %%U in ('wmic computersystem get username /value ^| findstr "Username"') do set USERNAME=%%U
for /f "tokens=1-3 delims=./- " %%a in ("%date%") do (
    set YYYY=%%c
    set MM=%%b
    set DD=%%a
)
set CURDATE=%YYYY%.%MM%.%DD%
set CURTIME=%time:~0,5%
set DATETIME=%CURDATE% %CURTIME%

sqlite3 %DB_FILE% "INSERT INTO logs (user, datetime) VALUES ('%USERNAME%', '%DATETIME%');"

:: Display statistics
echo Имя программы: %PROGRAM%

for /f "tokens=*" %%A in ('sqlite3 %DB_FILE% "SELECT COUNT(*) FROM logs;"') do set COUNT=%%A
echo Количество запусков: %COUNT%

for /f "tokens=*" %%A in ('sqlite3 %DB_FILE% "SELECT datetime FROM logs ORDER BY id ASC LIMIT 1;"') do set FIRST=%%A
echo Первый запуск: %FIRST%

echo ---------------------------------------------
echo User      ^| Date
echo ---------------------------------------------

:: Display all records
for /f "tokens=1,2 delims=|" %%A in ('sqlite3 %DB_FILE% "SELECT user, datetime FROM logs;"') do (
    echo %%A    ^| %%B
)

echo ---------------------------------------------

:: Check for /silent parameter
if /i "%1"=="/silent" (
    exit /b 0
) else (
    pause
)