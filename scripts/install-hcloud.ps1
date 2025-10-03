# Manual Hetzner CLI Installation Script for Windows
# Run this in PowerShell as Administrator

Write-Host "Installing Hetzner CLI (hcloud)..." -ForegroundColor Green

# Create directory for CLI tools
$installDir = "C:\Program Files\hcloud"
if (!(Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# Download latest version
$latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/hetznercloud/cli/releases/latest"
$downloadUrl = ($latestRelease.assets | Where-Object { $_.name -like "*windows-amd64.zip" }).browser_download_url

Write-Host "Downloading from: $downloadUrl" -ForegroundColor Yellow

$zipPath = "$env:TEMP\hcloud.zip"
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

# Extract
Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\hcloud-extract" -Force
$exePath = Get-ChildItem -Path "$env:TEMP\hcloud-extract" -Name "hcloud.exe" -Recurse | Select-Object -First 1
Copy-Item "$env:TEMP\hcloud-extract\$exePath" "$installDir\hcloud.exe" -Force

# Add to PATH
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "Machine")
if ($currentPath -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$installDir", "Machine")
    Write-Host "Added to system PATH. Please restart PowerShell." -ForegroundColor Green
}

# Cleanup
Remove-Item $zipPath -Force
Remove-Item "$env:TEMP\hcloud-extract" -Recurse -Force

Write-Host "Installation complete! Restart PowerShell and run 'hcloud version'" -ForegroundColor Green
