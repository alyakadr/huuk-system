@echo off
echo ========================================
echo HUUK System Quick Deployment Script
echo ========================================
echo.

echo Step 1: Building React Frontend...
cd client
call npm install
call npm run build
cd ..

echo.
echo Step 2: Frontend built successfully!
echo Build files are in: client/build/
echo.

echo Step 3: Next steps:
echo 1. Push code to GitHub
echo 2. Deploy backend to Railway
echo 3. Upload frontend to Ruzentra FTP
echo.

echo ========================================
echo Deployment files ready!
echo Check deploy-now.md for detailed steps
echo ========================================
pause