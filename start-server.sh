#!/bin/bash

# 图片压缩工具 - 本地服务器启动脚本 (Linux/Mac)
# 此脚本会自动启动一个本地 HTTP 服务器

echo ""
echo "========================================"
echo "  图片压缩工具 - 本地服务器"
echo "========================================"
echo ""

# 检查 Python 是否安装
if command -v python3 &> /dev/null; then
    echo "[✓] 检测到 Python3，启动服务器..."
    echo ""
    echo "服务器地址: http://localhost:8000"
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python3 -m http.server 8000
    exit 0
elif command -v python &> /dev/null; then
    echo "[✓] 检测到 Python，启动服务器..."
    echo ""
    echo "服务器地址: http://localhost:8000"
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python -m SimpleHTTPServer 8000
    exit 0
fi

# 检查 Node.js 是否安装
if command -v node &> /dev/null; then
    echo "[✓] 检测到 Node.js，启动服务器..."
    echo ""
    
    # 检查 http-server 是否已安装
    if npm list -g http-server &> /dev/null; then
        echo "[✓] http-server 已安装"
        echo ""
        echo "服务器地址: http://localhost:8080"
        echo "按 Ctrl+C 停止服务器"
        echo ""
        http-server
        exit 0
    else
        echo "[!] http-server 未安装，正在安装..."
        npm install -g http-server
        echo ""
        echo "服务器地址: http://localhost:8080"
        echo "按 Ctrl+C 停止服务器"
        echo ""
        http-server
        exit 0
    fi
fi

# 检查 PHP 是否安装
if command -v php &> /dev/null; then
    echo "[✓] 检测到 PHP，启动服务器..."
    echo ""
    echo "服务器地址: http://localhost:8000"
    echo "按 Ctrl+C 停止服务器"
    echo ""
    php -S localhost:8000
    exit 0
fi

# 如果都没有安装
echo "[✗] 未检测到 Python、Node.js 或 PHP"
echo ""
echo "请安装以下任意一个："
echo "  1. Python (https://www.python.org)"
echo "  2. Node.js (https://nodejs.org)"
echo "  3. PHP (https://www.php.net)"
echo ""
echo "或者直接在浏览器中打开 index.html 文件"
echo ""
