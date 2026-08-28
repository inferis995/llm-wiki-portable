# install-commands.ps1 — Bootstrap di LLM Wiki Portable (Windows).
#
# Installa SOLO le skill e i comandi, senza creare la wiki: da qui in poi
# la skill /llm-wiki-setup fa il resto (e sa aggiornare le versioni vecchie).
#
# Per installare direttamente la wiki:
#   python install.py --mode local --target C:/wiki --template general

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== LLM Wiki Portable — bootstrap ===" -ForegroundColor Cyan

function Install-Into {
    param([string]$Base, [string]$SkillsSub, [string]$CommandsSub, [string]$Label)

    New-Item -ItemType Directory -Force -Path "$Base\$SkillsSub" | Out-Null
    New-Item -ItemType Directory -Force -Path "$Base\$CommandsSub" | Out-Null

    Get-ChildItem "$ScriptDir\skills" -Directory | ForEach-Object {
        $dest = Join-Path "$Base\$SkillsSub" $_.Name
        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
        Copy-Item $_.FullName $dest -Recurse
    }

    Get-ChildItem "$ScriptDir\commands" -Filter *.md |
        Where-Object { $_.Name -notlike "*-hermes.md" } |
        ForEach-Object { Copy-Item $_.FullName "$Base\$CommandsSub" -Force }

    Write-Host "[OK] ${Label}: skill llm-wiki, llm-wiki-setup + comandi" -ForegroundColor Green
}

Install-Into "$env:USERPROFILE\.claude"          "skills" "commands" "Claude Code"
Install-Into "$env:USERPROFILE\.config\opencode" "skill"  "command"  "OpenCode"

if (Test-Path "$env:USERPROFILE\.hermes") {
    $hermesSkill = "$env:USERPROFILE\.hermes\skills\llm-dashboard"
    New-Item -ItemType Directory -Force -Path $hermesSkill | Out-Null
    Copy-Item "$ScriptDir\commands\llm-dashboard-hermes.md" "$hermesSkill\SKILL.md" -Force
    Write-Host "[OK] Hermes Agent: skill /llm-dashboard" -ForegroundColor Green
}

$py = Get-Command python3 -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python -ErrorAction SilentlyContinue }
if ($py) {
    Write-Host "[OK] Python: $(& $py.Source --version 2>&1)" -ForegroundColor Green
} else {
    Write-Host "[!!] Python non trovato — serve Python 3.8+ per sync, ricerca e lint" -ForegroundColor Yellow
}

if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host "[OK] git: $(git --version 2>&1)" -ForegroundColor Green
} else {
    Write-Host "[!!] git non trovato — la wiki non avra' versionamento automatico" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Fatto ===" -ForegroundColor Cyan
Write-Host @"
Apri Claude Code o OpenCode e scrivi:

    /install-portable-wiki      (oppure semplicemente: "installa la wiki")

Ti verra' chiesto dove metterla (cartella locale, USB o cartella cloud) e quale
template usare. Se hai gia' una wiki, viene rilevata e aggiornata senza toccare
i tuoi dati.
"@
