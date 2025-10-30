@echo off
echo Executando Cria JSON.ps1...
powershell -NoProfile -ExecutionPolicy Bypass -File "\\snbrcampmix005.la.corp.cargill.com\vs02_INT_NEOGRID_PD\Sistema_HTML\script\Cria JSON.ps1"

echo.
echo Cria JSON.ps1 finalizado. Executando criaAPPcomJSON.ps1...
powershell -NoProfile -ExecutionPolicy Bypass -File "\\snbrcampmix005.la.corp.cargill.com\vs02_INT_NEOGRID_PD\Sistema_HTML\criaAPPcomJSON.ps1"

exit