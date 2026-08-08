# Test Connectiqo push notification
# Usage:
#   .\scripts\test-push-notification.ps1 -UserId "mentor-uuid-here"
#   .\scripts\test-push-notification.ps1 -BookingId "booking-uuid-here"

param(
  [string]$UserId = "",
  [string]$BookingId = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path .env)) {
  Write-Error ".env not found"
}

$url = ""
$anon = ""
Get-Content .env | ForEach-Object {
  if ($_ -match '^SUPABASE_URL=(.*)$') { $url = $Matches[1].Trim().Trim('"') }
  if ($_ -match '^SUPABASE_ANON_KEY=(.*)$') { $anon = $Matches[1].Trim().Trim('"') }
}

if (-not $url -or -not $anon) {
  Write-Error "SUPABASE_URL / SUPABASE_ANON_KEY missing in .env"
}

if (-not $UserId -and -not $BookingId) {
  Write-Host @"
Pass either:
  -UserId   <mentor profile uuid>   (sends a test push)
  -BookingId <booking uuid>         (sends the real 'New session booked' push)

Example:
  .\scripts\test-push-notification.ps1 -UserId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
"@
  exit 1
}

$headers = @{
  apikey          = $anon
  Authorization   = "Bearer $anon"
  "Content-Type"  = "application/json"
}

if ($UserId) {
  $body = @{ test = $true; userId = $UserId } | ConvertTo-Json
  Write-Host "Sending TEST push to userId=$UserId ..."
} else {
  $body = @{ bookingId = $BookingId } | ConvertTo-Json
  Write-Host "Sending booking push for bookingId=$BookingId ..."
}

try {
  $res = Invoke-RestMethod `
    -Uri "$url/functions/v1/notify-new-booking" `
    -Method POST `
    -Headers $headers `
    -Body $body `
    -TimeoutSec 45
  Write-Host "Response:" ($res | ConvertTo-Json -Compress)
  if ($res.skipped) {
    Write-Host "SKIPPED:" $res.reason -ForegroundColor Yellow
    if ($res.hint) { Write-Host $res.hint -ForegroundColor Yellow }
  } elseif ($res.success) {
    Write-Host "OK — check the mentor phone for the popup." -ForegroundColor Green
  }
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $txt = $reader.ReadToEnd()
    Write-Host "HTTP $([int]$resp.StatusCode): $txt" -ForegroundColor Red
  } else {
    Write-Host $_.Exception.Message -ForegroundColor Red
  }
  exit 1
}
