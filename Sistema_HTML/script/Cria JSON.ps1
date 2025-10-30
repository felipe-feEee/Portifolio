function Get-XmlValue {
    param (
        [xml]$xml,
        [string]$tagName
    )
    $node = $xml.SelectSingleNode("//*[local-name() = '$tagName']")
    return $node?.InnerText
}

function Get-XmlAttribute {
    param (
        [xml]$xml,
        [string]$elementName,
        [string]$attributeName
    )
    $node = $xml.SelectSingleNode("//*[local-name() = '$elementName']")
    return $node?.GetAttribute($attributeName)
}

Write-Host "Inicia sistema"

$sourceFolder = "\\snbrcampmix005.la.corp.cargill.com\vs02_INT_NEOGRID_PD\JDEPROD\NFE\BKP\BKP_NFE_EMIS"
$outputFile = Join-Path -Path $PSScriptRoot -ChildPath "file_data.json"
$batchSize = 5000

$files = Get-ChildItem -Path $sourceFolder -Filter *.xml -Recurse -ErrorAction SilentlyContinue
$total = $files.Count
$counter = 0
$batch = @()
$firstBlock = $true

# Inicia o arquivo JSON
"[" | Out-File -FilePath $outputFile -Encoding UTF8

foreach ($file in $files) {
    $counter++
    $fullPath = $file.FullName
    $modified = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
    $serie = ""
    $nNF = ""
    $infNFeId = ""

    try {
        $xmlContent = Get-Content -Path $fullPath -Raw
        $xmlContent = $xmlContent -replace 'xmlns(:\w+)?="[^"]+"', ''
        $xml = [xml]$xmlContent

        $serieNode = $xml.SelectSingleNode("//*[local-name()='serie']")
        if ($serieNode) { $serie = $serieNode.InnerText }

        $nNFNode = $xml.SelectSingleNode("//*[local-name()='nNF']")
        if ($nNFNode) { $nNF = $nNFNode.InnerText }

        $infNFeNode = $xml.SelectSingleNode("//*[local-name()='infNFe']")
        if ($infNFeNode) { $infNFeId = $infNFeNode.GetAttribute("Id") }

        if ([string]::IsNullOrWhiteSpace($infNFeId)) {
            continue
        }

        $batch += [PSCustomObject]@{
            filename = $fullPath
            modified_date = $modified
            serie = $serie
            nNF = $nNF
            infNFe_Id = $infNFeId
        }

    } catch {
        Write-Host "Erro ao processar: $fullPath"
        try {
            $raw = Get-Content -Path $fullPath -Raw -ErrorAction Stop
            Write-Host "Conteudo lido:"
            Write-Host $raw.Substring(0, [Math]::Min(1000, $raw.Length))
        } catch {
            Write-Host "Nao foi possivel ler o conteudo do arquivo."
        }
    }

    if ($counter % $batchSize -eq 0 -or $counter -eq $total) {
        if ($batch.Count -gt 0) {
            $json = $batch | ConvertTo-Json -Depth 3
            $jsonTrimmed = $json.TrimStart('[').TrimEnd(']')

            if (-not $firstBlock) {
                Add-Content -Path $outputFile -Value ","
            }

            Add-Content -Path $outputFile -Value $jsonTrimmed
            $batch = @()
            $firstBlock = $false
        }

        Write-Host "$counter arquivos processados de $total"
        [System.GC]::Collect()
    }
}

"]" | Add-Content -Path $outputFile -Encoding UTF8

Write-Host "Processamento finalizado. Arquivo JSON gerado: $outputFile"