@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo  ============================================
echo   签到控制台 · 一键部署到 Cloudflare
echo  ============================================
echo.
echo  需要先准备一个 Cloudflare API Token：
echo    https://dash.cloudflare.com/profile/api-tokens
echo    模板选 "Edit Cloudflare Workers" 即可
echo.
echo  接下来会问你两件事：Token、登录密码。其余全自动。
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
if errorlevel 1 (
  echo.
  echo  [失败] 上面有报错信息，按提示处理后重跑本文件。
) else (
  echo.
  echo  [完成] 地址、密码、MASTER_KEY 都在上面，记得存好 MASTER_KEY。
)
echo.
pause
