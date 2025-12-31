@echo off
chcp 65001
echo ==========================================
echo      欧玛机械企业网站 - 自动启动脚本
echo ==========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境！
    echo 请先安装 Node.js (https://nodejs.org/) 后再运行此脚本。
    pause
    exit /b
)

echo [1/3] 检测到 Node.js，准备启动...
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo [2/3] 首次运行，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败，请检查网络或 npm 配置。
        pause
        exit /b
    )
    echo 依赖安装完成。
) else (
    echo [2/3] 依赖已安装，跳过。
)

echo.
echo [3/3] 正在启动服务器...
echo 访问地址: http://localhost:3000
echo 管理后台: http://localhost:3000/admin
echo.

call npm start
pause
