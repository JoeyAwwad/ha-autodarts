# Start (or stop) the game screen demo from PowerShell: .\demo.ps1  /  .\demo.ps1 stop
# Your own pictures: $env:DARTS_ASSETS = "C:\path\to\folder" before starting.
param([string]$Action = "start")
$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot
try {
  $compose = @("compose", "--project-name", "darts_screen_demo", "--file", "compose.yaml")
  if ($Action -eq "reload") {
    docker @compose stop homeassistant | Out-Null
    $v = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    docker @compose run --rm --no-deps --entrypoint sh homeassistant -c "sed -i -E 's/autodarts-classic-card.js?v=[0-9]+/autodarts-classic-card.js?v=$v/' /config/.storage/lovelace_resources"
    docker @compose up --detach --wait homeassistant | Out-Null
    "Card reloaded: refresh the game screen."; return
  }
  docker @compose down --volumes --remove-orphans 2>$null | Out-Null
  if ($Action -eq "stop") { "Demo stopped."; return }
  docker @compose up --detach --wait --wait-timeout 300
  docker @compose exec -T homeassistant python3 /demo/setup.py
  if ($LASTEXITCODE -ne 0) { docker @compose logs --no-color --tail 200; throw "Setup failed" }
  ""
  "Game screen:     http://localhost:18125/darts-classic/game"
  "Dart simulator:  http://localhost:18126"
  "Home Assistant:  http://localhost:18125   (logs in by itself on this PC)"
  "Stop it:         .\demo.ps1 stop"
} finally { Pop-Location }
