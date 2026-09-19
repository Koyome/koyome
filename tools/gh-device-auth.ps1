# gh-device-auth.ps1 — GitHub OAuth device flow for pushing to Koyome/koyome.github.io.
# Usage: powershell -ExecutionPolicy Bypass -File tools\gh-device-auth.ps1 [-Scope 'repo admin:public_key']
# Prints a user code; user opens https://github.com/login/device and enters it.
# On success writes the token to tools\gh-token.txt (gitignored). Token is never printed.
param([string]$Scope = 'repo')
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$tokenFile = Join-Path $root 'tools\gh-token.txt'
$clientId = '178c6fc778ccc68e1d6a'  # GitHub CLI public client id
$headers = @{ Accept = 'application/json'; 'User-Agent' = 'koyome-deploy' }

function Post-Json($url, $obj, $tries = 40) {
  $body = $obj | ConvertTo-Json
  for ($i = 1; $i -le $tries; $i++) {
    try {
      return Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType 'application/json' -Headers $headers -TimeoutSec 25
    } catch {
      Write-Host ("request attempt {0} failed, retrying..." -f $i)
      Start-Sleep -Seconds 3
    }
  }
  throw "giving up after $tries attempts: $url"
}

Write-Host 'Requesting device code from GitHub...'
$dc = Post-Json 'https://github.com/login/device/code' @{ client_id = $clientId; scope = $Scope }
Write-Host ''
Write-Host '============================================================'
Write-Host ('  1. Open in your browser:  {0}' -f $dc.verification_uri)
Write-Host ('  2. Log in and enter code: {0}' -f $dc.user_code)
Write-Host ('  3. Click Authorize. Code expires in {0} s.' -f $dc.expires_in)
Write-Host '============================================================'
Write-Host 'Waiting for authorization (polling)...'

$deadline = (Get-Date).AddSeconds($dc.expires_in - 30)
$interval = [Math]::Max(5, [int]$dc.interval)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds $interval
  try {
    $r = Invoke-RestMethod -Uri 'https://github.com/login/oauth/access_token' -Method Post `
      -Body (@{ client_id = $clientId; device_code = $dc.device_code; grant_type = 'urn:ietf:params:oauth:grant-type:device_code' } | ConvertTo-Json) `
      -ContentType 'application/json' -Headers $headers -TimeoutSec 25
    if ($r.access_token) {
      [System.IO.File]::WriteAllText($tokenFile, $r.access_token)
      $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers @{ Authorization = "Bearer $($r.access_token)"; 'User-Agent' = 'koyome-deploy' } -TimeoutSec 25
      Write-Host ("OK - authorized as @{0}. Token saved to tools\gh-token.txt (gitignored)." -f $me.login)
      exit 0
    }
    if ($r.error -eq 'slow_down') { $interval += 5 }
    if ($r.error -eq 'expired_token') { Write-Host 'Device code expired. Re-run this script.'; exit 1 }
  } catch { Write-Host 'poll request failed, retrying...' }
}
Write-Host 'Timed out waiting for authorization. Re-run this script.'
exit 1
