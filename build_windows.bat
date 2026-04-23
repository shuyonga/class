@echo off
chcp 65001 >nul
echo ============================================
echo   数王荣耀 - Windows 一键打包脚本
echo ============================================
echo.

echo [1/3] 正在升级 pip...
python -m pip install --upgrade pip

echo.
echo [2/3] 正在安装依赖...
pip install flask requests "qrcode[pil]" pyinstaller

echo.
echo [3/3] 正在打包（这可能需要几分钟）...
pyinstaller --add-data "templates;templates" --add-data "static;static" --onefile --name "shuwangrongyao" --icon="icon.ico" app.py

echo.
echo ============================================
echo   打包完成！
echo   可执行文件位于 dist\shuwangrongyao.exe
echo   请将 exe 复制到项目根目录后运行
echo   首次运行会自动在 exe 同级目录生成 config.json
echo   并自动创建 data\ 和 questions\ 目录
echo ============================================
echo.
pause
