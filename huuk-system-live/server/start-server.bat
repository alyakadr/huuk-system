@echo off
echo Starting Huuk System Server with increased memory...
cd /d "C:\Users\nural\huuk-system\server"
node --max-old-space-size=4096 app.js
pause
