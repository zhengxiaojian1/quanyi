@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node\node.exe" (
  echo 缺 node\node.exe —— 把便携版 node 放到这个文件夹的 node\ 下
  pause
  exit /b 1
)
if exist "..\..\钥匙.txt" set DEEPSEEK_KEY_FILE=%~dp0..\..\钥匙.txt
start "" http://127.0.0.1:8787
node\node.exe 服务.mjs
pause
