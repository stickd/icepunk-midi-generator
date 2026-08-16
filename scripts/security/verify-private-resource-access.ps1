param(
  [string]$ApiBase = "http://localhost:8081",
  [Parameter(Mandatory = $true)][string]$UserAToken,
  [Parameter(Mandatory = $true)][string]$UserBToken,
  [Parameter(Mandatory = $true)][string]$PrivatePackId,
  [Parameter(Mandatory = $true)][string]$PrivateItemId,
  [Parameter(Mandatory = $true)][string]$DifferentPackId,
  [Parameter(Mandatory = $true)][string]$UnsignedMinioUrl,
  [Parameter(Mandatory = $true)][string]$SignedMinioUrl
)

$ErrorActionPreference = "Stop"
$failures = 0
function Assert-Status([string]$Name, [int]$Expected, [scriptblock]$Request) {
  try { $response = & $Request; $actual = [int]$response.StatusCode } catch {
    $actual = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode.value__ } else { 0 }
  }
  if ($actual -eq $Expected) { Write-Host "PASS $Name" -ForegroundColor Green } else { Write-Host "FAIL $Name expected=$Expected actual=$actual" -ForegroundColor Red; $script:failures++ }
}
function Invoke-Check([string]$Path, [string]$Token) {
  $headers = if ($Token) { @{ Authorization = "Bearer $Token" } } else { @{} }
  Invoke-WebRequest -UseBasicParsing -Uri "$ApiBase$Path" -Headers $headers
}
function Assert-NoRawStorageDetails([string]$Name, $Response) {
  if ($Response.Content -notmatch '(?i)(objectKey|s3ObjectKey|zipObjectKey|minio|http://minio|https://minio)') {
    Write-Host "PASS $Name" -ForegroundColor Green
  } else {
    Write-Host "FAIL $Name response exposes storage details" -ForegroundColor Red
    $script:failures++
  }
}
function Assert-Header([string]$Name, $Response, [string]$Header, [string]$Expected) {
  if ($Response.Headers[$Header] -eq $Expected) { Write-Host "PASS $Name" -ForegroundColor Green } else { Write-Host "FAIL $Name expected $Header=$Expected actual=$($Response.Headers[$Header])" -ForegroundColor Red; $script:failures++ }
}

 $ownerPack = Invoke-Check "/generated-packs/$PrivatePackId" $UserAToken
if ([int]$ownerPack.StatusCode -eq 200) { Write-Host 'PASS owner private pack' -ForegroundColor Green } else { Write-Host "FAIL owner private pack expected=200 actual=$($ownerPack.StatusCode)" -ForegroundColor Red; $failures++ }
Assert-NoRawStorageDetails 'private pack metadata hides raw storage keys' $ownerPack
Assert-Status 'User B private pack concealed' 404 { Invoke-Check "/generated-packs/$PrivatePackId" $UserBToken }
Assert-Status 'anonymous private pack concealed' 404 { Invoke-Check "/generated-packs/$PrivatePackId" $null }
Assert-Status 'User B private pack download URL concealed' 404 { Invoke-Check "/generated-packs/$PrivatePackId/download-url" $UserBToken }
Assert-Status 'anonymous private pack download URL concealed' 404 { Invoke-Check "/generated-packs/$PrivatePackId/download-url" $null }
Assert-Status 'User B private item preview URL concealed' 404 { Invoke-Check "/generated-packs/$PrivatePackId/items/$PrivateItemId/preview-url" $UserBToken }
Assert-Status 'anonymous private item preview URL concealed' 404 { Invoke-Check "/generated-packs/$PrivatePackId/items/$PrivateItemId/preview-url" $null }
Assert-Status 'User B private item download URL concealed' 404 { Invoke-Check "/generated-packs/$PrivatePackId/items/$PrivateItemId/download-url" $UserBToken }
Assert-Status 'item from another pack concealed' 404 { Invoke-Check "/generated-packs/$DifferentPackId/items/$PrivateItemId/preview-url" $UserAToken }

$ownerPackUrl = Invoke-Check "/generated-packs/$PrivatePackId/download-url" $UserAToken
$ownerPreviewUrl = Invoke-Check "/generated-packs/$PrivatePackId/items/$PrivateItemId/preview-url" $UserAToken
$ownerItemUrl = Invoke-Check "/generated-packs/$PrivatePackId/items/$PrivateItemId/download-url" $UserAToken
foreach ($response in @($ownerPackUrl, $ownerPreviewUrl, $ownerItemUrl)) {
  Assert-Header 'signed URL Cache-Control' $response 'Cache-Control' 'no-store'
  Assert-Header 'signed URL Pragma' $response 'Pragma' 'no-cache'
  if ($response.Content -match '"url"' -and $response.Content -match '"expiresAt"') { Write-Host 'PASS signed URL payload' -ForegroundColor Green } else { Write-Host 'FAIL signed URL payload' -ForegroundColor Red; $failures++ }
}
Assert-Status 'unsigned direct MinIO GET denied' 403 { Invoke-WebRequest -UseBasicParsing -Uri $UnsignedMinioUrl }
Assert-Status 'signed direct MinIO GET allowed' 200 { Invoke-WebRequest -UseBasicParsing -Uri $SignedMinioUrl }
if ($failures) { exit 1 }
