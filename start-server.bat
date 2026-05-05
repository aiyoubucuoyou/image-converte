@echo off
REM 图片压缩工具 - 本地服务器启动脚本 (Windows)
REM 此脚本会自动启动一个本地 HTTP 服务器

echo.
echo ========================================
echo   图片压缩工具 - 本地服务器
echo ========================================
echo.

REM 检查 Python 是否安装
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] 检测到 Python，启动服务器...
    echo.
    echo 服务器地址: http://localhost:8000
    echo 按 Ctrl+C 停止服务器
    echo.
    python -m http.server 8000
    goto end
)

REM 检查 Node.js 是否安装
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] 检测到 Node.js，启动服务器...
    echo.
    echo 首先检查 http-server 是否已安装...
    npm list -g http-server >nul 2>&1
    if %errorlevel% equ 0 (
        echo [✓] http-server 已安装
        echo.
        echo 服务器地址: http://localhost:8080
        echo 按 Ctrl+C 停止服务器
        echo.
        http-server
        goto end
    ) else (
        echo [!] http-server 未安装，正在安装...
        npm install -g http-server
        echo.
        echo 服务器地址: http://localhost:8080
        echo 按 Ctrl+C 停止服务器
        echo.
        http-server
        goto end
    )
)

REM 检查 PHP 是否安装
php --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] 检测到 PHP，启动服务器...
    echo.
    echo 服务器地址: http://localhost:8000
    echo 按 Ctrl+C 停止服务器
    echo.
    php -S localhost:8000
    goto end
)

REM 如果都没有安装
echo [✗] 未检测到 Python、Node.js 或 PHP
echo.
echo 请安装以下任意一个：
echo   1. Python (https://www.python.org)
echo   2. Node.js (https://nodejs.org)
echo   3. PHP (https://www.php.net)
echo.
echo 或者直接在浏览器中打开 index.html 文件
echo.

:end
pause
