$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeDir = "C:\Program Files\nodejs"
$npm = Join-Path $nodeDir "npm.cmd"
$node = Join-Path $nodeDir "node.exe"

if (-not (Test-Path $node)) {
    throw "Node.js was not found at $node. Install Node.js for Windows first, then rerun this script."
}

$env:PATHEXT = ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL"
$env:Path = "$nodeDir;$env:APPDATA\npm;$env:LOCALAPPDATA\Programs\Python\Python312\Scripts;$env:Path"

Set-Location $repoRoot

Write-Host "Repo: $repoRoot"
Write-Host "Node:" (& $node -v)
Write-Host "npm:" (& $npm -v)

Write-Host "Installing RMS dependencies..."
& $npm install

Write-Host "Compiling RMS Frida agent..."
& $npm run compile

Write-Host ""
Write-Host "Setup complete."
Write-Host "Start RMS with:"
Write-Host "  cd $repoRoot"
Write-Host "  `$env:Path = '$nodeDir;' + `$env:Path"
Write-Host "  `$env:PATHEXT = '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL'"
Write-Host "  node rms.js --port 5491"
