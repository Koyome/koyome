@echo off
rem ============================================
rem  Koyome.me - start the site server (port 80)
rem  Double-click, keep the window open, then
rem  visit http://Koyome.me in your browser.
rem ============================================
cd /d "C:\Users\Public\koyome-site"
set PORT=80
echo ----------------------------------------
echo   Koyome.me is starting...
echo   Open:  http://Koyome.me
echo   Admin: http://Koyome.me/admin.html
echo   Keep this window open while using the site.
echo ----------------------------------------
"C:\Users\Public\koyome-node\node.exe" server.js
pause
