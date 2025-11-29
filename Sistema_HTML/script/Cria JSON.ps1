# ===== Config paths =====
$root        = "\\snbrcampmix005.la.corp.cargill.com\\vs02_INT_NEOGRID_PD\\JDEPROD\\NFE\\BKP"
$scriptDir   = $PSScriptRoot
$finalFile   = Join-Path $scriptDir "file_data.json"
$lastRunFile = Join-Path $scriptDir "last_run.txt"

# ===== Config =====
$batchSize = 5000   # quantidade de registros por bloco
$rootDepth = ($root.Split([IO.Path]::DirectorySeparatorChar)).Count

# ===== Helpers =====
function Read-LastRun {
    if (Test-Path $lastRunFile) {
        try {
            $txt = Get-Content -Path $lastRunFile -Raw
            if ($txt) { return [datetime]::ParseExact($txt.Trim(), "yyyy-MM-dd HH:mm:ss", $null) }
        } catch {}
    }
    return [datetime]::Parse("2000-01-01 00:00:00")
}

function Write-LastRun($scanStart) {
    $now = $scanStart.ToString("yyyy-MM-dd HH:mm:ss")
    Set-Content -Path $lastRunFile -Value $now -Encoding UTF8
    return $now
}

function Get-MetaFast {
    param([string]$content)

    $pattern = '<infNFe[^>]*Id="(?<infNFeId>[^"]+)"|' +
               '<chNFe>(?<chNFe>[^<]+)</chNFe>|' +
               '<nNFIni>(?<nNFIni>\d+)</nNFIni>|' +
               '<nNFFin>(?<nNFFin>\d+)</nNFFin>|' +
               '<nNF>(?<nNF>\d+)</nNF>|' +
               '<serie>(?<serie>\d+)</serie>|' +
               '<descEvento>(?<descEvento>[^<]+)</descEvento>'

    $matches = [regex]::Matches($content, $pattern, 'IgnoreCase')

    $serie = ""
    $nNF = ""
    $infNFeId = ""
    $ini = ""
    $fin = ""

    foreach ($m in $matches) {
        if ($m.Groups['serie'].Success) { $serie = $m.Groups['serie'].Value }
        if ($m.Groups['nNF'].Success)   { $nNF   = $m.Groups['nNF'].Value }

        if ($m.Groups['infNFeId'].Success) {
            $infNFeId = $m.Groups['infNFeId'].Value
            # Remover prefixo "NFe" se presente
            $infNFeId = $infNFeId -replace '^NFe', ''
            continue
        }
        if ($m.Groups['chNFe'].Success)    { $infNFeId = $m.Groups['chNFe'].Value; continue }

        # Eventos
        if ($m.Groups['descEvento'].Success) {
            $desc = $m.Groups['descEvento'].Value.Trim()
            if ($desc -match 'Cancelamento') {
                $nNF = "s1"
                $serie = "s1"
            } else {
                $nNF = "s2"
                $serie = "s2"
            }
            break
        }

        # Inutilização (só se não houver chave/evento)
        if (-not $infNFeId -and $m.Groups['nNFIni'].Success) {
            $ini = $m.Groups['nNFIni'].Value
            $fin = $m.Groups['nNFFin'].Value
            $infNFeId = "s3"
            if ($ini -eq $fin -or -not $fin) { $nNF = $ini } else { $nNF = "$ini-$fin" }
            break
        }
    }

    if ([string]::IsNullOrWhiteSpace($infNFeId)) { return $null }

    return @{ serie = $serie; nNF = $nNF; infNFe_Id = $infNFeId }
}

# ===== Main =====
Write-Host ("Inicio do processamento em {0}" -f (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
$scanStart = Get-Date
$lastRun = Read-LastRun
Write-Host ("Coletando arquivos alterados desde {0}" -f $lastRun.ToString("yyyy-MM-dd HH:mm:ss"))

# 1) Mapear subpastas até 1 nível
$subfolders = Get-ChildItem -Path $root -Directory -Recurse | Where-Object {
    ($_.FullName.Split([IO.Path]::DirectorySeparatorChar).Count -le ($rootDepth + 1))
}

$folderMap = @{}
$folderMap["0"] = $root
$index = 1
foreach ($sf in $subfolders) { $folderMap["$index"] = $sf.FullName; $index++ }

# Criar mapa inverso para lookup rápido
$pathToIndex = @{}
foreach ($kv in $folderMap.GetEnumerator()) { $pathToIndex[$kv.Value] = $kv.Key }

# 2) Abrir arquivo existente e verificar estrutura
$prefix = "fileData = ["
if (Test-Path $finalFile) {
    $raw = Get-Content -Path $finalFile -Raw
    $validStart = $raw.TrimStart().StartsWith("fileData = [")
    $validEnd   = ($raw -match "];\s*fileData_lastUpdate\s*=")

    if ($validStart -and $validEnd) {
        $posEnd = $raw.LastIndexOf("]")
        $prefix = $raw.Substring(0, $posEnd)
        Write-Host "Estrutura válida encontrada. Incrementando."
    } else {
        # Estrutura inválida → renomear arquivo antigo
        $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
        $backupFile = [System.IO.Path]::Combine($scriptDir, "file_data_$timestamp.json")
        Rename-Item -Path $finalFile -NewName $backupFile -Force
        Write-Host "Estrutura inválida. Arquivo renomeado para $backupFile. Criando novo."
        $prefix = "fileData = ["
    }
} else {
    Write-Host "Arquivo não encontrado. Criando novo."
}

# 3) Writer
$writer = [System.IO.StreamWriter]::new($finalFile, $false, [System.Text.Encoding]::UTF8)
$writer.WriteLine($prefix.TrimEnd())

$processed = 0
$buffer = @()
$firstWrite = -not $prefix.TrimEnd().EndsWith("[")

# 4) Varrer arquivos XML até 1 nível
$files = Get-ChildItem -Path $root -Filter *.xml -Recurse | Where-Object {
    ($_.FullName.Split([IO.Path]::DirectorySeparatorChar).Count -le ($rootDepth + 1))
}

foreach ($f in $files) {
    if ($f.LastWriteTime -le $lastRun) { continue }

    $rawFile = $null
    try { $rawFile = Get-Content -Path $f.FullName -Raw -ErrorAction Stop } catch { continue }
    if (-not $rawFile) { continue }

    $meta = Get-MetaFast -content $rawFile
    if (-not $meta) { continue }

    $parentPath = $f.Directory.FullName
    $folderIndex = $pathToIndex[$parentPath]
    if (-not $folderIndex) { $folderIndex = "0" }

    $obj = [PSCustomObject]@{
    "1" = "$folderIndex\\$($f.Name)"
    "2" = $f.LastWriteTime.ToString("yyyyMMddTHHmmss")
    "3" = $meta.serie
    "4" = $meta.nNF
    "5" = $meta.infNFe_Id
    }


    $jsonLine = ($obj | ConvertTo-Json -Compress)
    if ($firstWrite) {
        $buffer += "," + $jsonLine
    } else {
        $buffer += $jsonLine
        $firstWrite = $true
    }

    $processed++

    if ($processed % $batchSize -eq 0) {
        $writer.Write([string]::Join("", $buffer))
        $buffer = @()
        Write-Host ("{0} registros incrementados... {1}" -f $processed, (Get-Date).ToString("HH:mm:ss"))
    }
}

# Escreve o restante do buffer
if ($buffer.Count -gt 0) {
    $writer.Write([string]::Join("", $buffer))
}

# Fecha array e escreve lastUpdate + folderMap
$writer.WriteLine("];")
$updateTime = Write-LastRun $scanStart
$writer.WriteLine("fileData_lastUpdate = '$updateTime';")

# Grava também o folderMap com caminhos completos
$mapJson = ($folderMap | ConvertTo-Json -Compress)
$writer.WriteLine("folderMap = $mapJson;")

$writer.Flush()
$writer.Dispose()

Write-Host ("Concluido. Registros incrementados: {0}" -f $processed)
Write-Host ("Base atualizada em {0}" -f $updateTime)

