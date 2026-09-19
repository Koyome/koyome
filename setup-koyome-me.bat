@echo off
rem ============================================================
rem  Koyome.me - one-time setup
rem  1) Maps Koyome.me to this computer (127.0.0.1) in hosts.
rem  2) Adds Koyome.me to the browser proxy bypass list, so the
rem     address still opens directly when a system proxy is on.
rem  Double-click: it will ask for administrator rights (UAC).
rem  You only need to run this ONCE.
rem ============================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator rights...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

findstr /i "Koyome.me" "%SystemRoot%\System32\drivers\etc\hosts" >nul 2>&1
if %errorlevel% neq 0 (
  echo.>> "%SystemRoot%\System32\drivers\etc\hosts"
  echo 127.0.0.1 Koyome.me>> "%SystemRoot%\System32\drivers\etc\hosts"
  echo 127.0.0.1 www.Koyome.me>> "%SystemRoot%\System32\drivers\etc\hosts"
  echo [OK] Koyome.me added to the hosts file.
) else (
  echo [OK] Koyome.me is already in the hosts file.
)

rem ---- proxy bypass (per-user, no harm if no proxy is used) ----
set "PO="
for /f "tokens=2,*" %%a in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyOverride 2^>nul ^| findstr /i "ProxyOverride"') do set "PO=%%b"
echo %PO% | findstr /i "Koyome.me" >nul 2>&1
if %errorlevel% neq 0 (
  if defined PO (set "PO=%PO%;Koyome.me;*.koyome.me") else (set "PO=Koyome.me;*.koyome.me;<local>")
  reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyOverride /t REG_SZ /d "%PO%" /f >nul
  echo [OK] Koyome.me added to the proxy bypass list.
) else (
  echo [OK] Proxy bypass already covers Koyome.me.
)

ipconfig /flushdns >nul
echo.
echo Done. Now start the website with start-koyome.bat
echo and open http://Koyome.me in your browser.
echo.
pause
