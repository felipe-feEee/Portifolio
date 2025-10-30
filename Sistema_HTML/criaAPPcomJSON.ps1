# Caminhos
$baseJsPath = Join-Path -Path $PSScriptRoot -ChildPath "base_app.js"           # Arquivo com o código JS base
$jsonPath = Join-Path -Path $PSScriptRoot -ChildPath "script\file_data.json" # Caminho do JSON
$outputJsPath = Join-Path -Path $PSScriptRoot -ChildPath "app.js"              # Arquivo final gerado

# Lê o código base
$baseCode = Get-Content -Path $baseJsPath -Raw

# Lê e converte o JSON para string JS
$jsonContent = Get-Content -Path $jsonPath -Raw
$jsonAsJs = "`nfileData = $jsonContent;`n"

# Junta tudo e escreve no app.js
$finalCode = $baseCode + $jsonAsJs
Set-Content -Path $outputJsPath -Value $finalCode -Encoding UTF8

Write-Host "Arquivo app.js gerado com sucesso com os dados embutidos."