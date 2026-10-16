@echo off
chcp 65001 >nul
echo ============================================================
echo   กำลังเริ่มต้นระบบทั้งหมด (DB + Backend + Frontend) ด้วย Docker...
echo ============================================================
echo.
docker compose up -d --build
echo.
echo ============================================================
echo   ระบบพร้อมใช้งาน:
echo   - Frontend: http://localhost:5173
echo   - Backend API: http://localhost:5000
echo   - Database: localhost:5432
echo ============================================================
pause
