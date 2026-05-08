# install-commands.ps1 — Copy commands to Claude Code and OpenCode
# Usage: powershell -File install-commands.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== LLM Wiki Portable — Install Commands ===" -ForegroundColor Cyan

# ── Claude Code commands ──────────────────────────────────────────────────────
$ClaudeDir = "$env:USERPROFILE\.claude\commands"
New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null
Copy-Item "$ScriptDir\commands\install-portable-wiki.md" $ClaudeDir -Force
Copy-Item "$ScriptDir\commands\llm-dashboard.md" $ClaudeDir -Force
Write-Host "[OK] Claude Code commands: /install-portable-wiki  /llm-dashboard" -ForegroundColor Green

# ── OpenCode commands ──────────────────────────────────────────────────────────
$OpenCodeDir = "$env:USERPROFILE\.config\opencode\commands"
New-Item -ItemType Directory -Force -Path $OpenCodeDir | Out-Null
Copy-Item "$ScriptDir\commands\install-portable-wiki.md" $OpenCodeDir -Force
Copy-Item "$ScriptDir\commands\llm-dashboard.md" $OpenCodeDir -Force
Write-Host "[OK] OpenCode commands: /install-portable-wiki  /llm-dashboard" -ForegroundColor Green

# ── Python check (needed for sync.py) ─────────────────────────────────────────
$PyFound = $false
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pyVersion = & python3 --version 2>&1
    Write-Host "[OK] Python: $pyVersion" -ForegroundColor Green
    $PyFound = $true
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pyVersion = & python --version 2>&1
    Write-Host "[OK] Python: $pyVersion" -ForegroundColor Green
    $PyFound = $true
}

if (-not $PyFound) {
    Write-Host "[!!] Python non trovato — installa Python 3.8+ per usare sync.py e la dashboard" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Cyan
Write-Host "Open Claude Code and run: /install-portable-wiki"
