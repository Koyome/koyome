@echo off
rem ============================================
rem  Koyome.me - one-click site update push
rem  Double-click: detect changes, commit, push.
rem  Success: window closes itself in 10 seconds.
rem  Failure: window STAYS OPEN with the reason.
rem  Keep this file ASCII-only. Logic: tools/push-update.js
rem ============================================
chcp 65001 >nul
title Koyome One-Click Push
cd /d "%~dp0"

set "NODE="
where node >nul 2>&1
if %errorlevel%==0 set "NODE=node"
if not defined NODE if exist "C:\Users\Public\koyome-node\node.exe" set "NODE=C:\Users\Public\koyome-node\node.exe"
if not defined NODE for /d %%D in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do if exist "%%D\node.exe" set "NODE=%%D\node.exe"

if not defined NODE (
  echo [ERROR] Node.js not found on this computer.
  echo Please install Node.js, or restore C:\Users\Public\koyome-node.
  echo.
  pause
  exit /b 1
)

"%NODE%" "tools\push-update.js" %*

if %errorlevel%==0 (
  echo.
  echo --------------------------------------------
  echo  SUCCESS - this window closes by itself.
  echo --------------------------------------------
  timeout /t 10 >nul 2>&1
  exit /b 0
) else (
  echo.
  echo --------------------------------------------
  echo  FAILED - read the reason and advice above.
  echo  This window stays open for review.
  echo --------------------------------------------
  pause
  exit /b 1
)
