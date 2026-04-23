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
pyinstaller --add-data "templates;templates" --add-data "static;static" --add-data "config.json;." --add-data "questions;questions" --add-data "data;data" --onefile --name "数王荣耀" --icon="icon.ico" app.py

echo.
echo ============================================
echo   打包完成！
echo   可执行文件位于 dist\数王荣耀.exe
echo   请将 exe 复制到项目根目录后运行
echo ============================================
echo.
pause
