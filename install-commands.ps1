# install-commands.ps1 — Copy commands to Claude Code and OpenCode, install rtfm-ai
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
Copy-Item "$ScriptDir\commands\llm-dashboard.md" $OpenCodeDir -Force
Write-Host "[OK] OpenCode commands: /llm-dashboard" -ForegroundColor Green

# ── Python detection ───────────────────────────────────────────────────────────
$PyCmd = $null
$PipCmd = $null

if (Get-Command python3 -ErrorAction SilentlyContinue) {
    $PyCmd = "python3"
    $PipCmd = "pip3"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $PyCmd = "python"
    $PipCmd = "pip"
}

if (-not $PyCmd) {
    Write-Host "[!!] Python non trovato — installa Python 3.8+ e riesegui" -ForegroundColor Yellow
    Write-Host "     Poi installa manualmente: pip install 'rtfm-ai[embeddings]'"
    Write-Host ""
    Write-Host "=== Done (parziale) ===" -ForegroundColor Cyan
    Write-Host "Open Claude Code and run: /install-portable-wiki"
    exit 0
}

$pyVersion = & $PyCmd --version 2>&1
Write-Host "[OK] Python: $pyVersion" -ForegroundColor Green

# ── rtfm-ai with embeddings ───────────────────────────────────────────────────
$embeddingsOk = $false
try {
    & $PyCmd -c "import rtfm; import fastembed" 2>$null
    if ($LASTEXITCODE -eq 0) { $embeddingsOk = $true }
} catch {}

if ($embeddingsOk) {
    Write-Host "[OK] rtfm-ai + fastembed già installati" -ForegroundColor Green
} else {
    Write-Host "[..] Installazione rtfm-ai[embeddings]..."
    try {
        & $PipCmd install "rtfm-ai[embeddings]"
    } catch {
        Write-Host "[..] Provo con python -m pip..."
        & $PyCmd -m pip install "rtfm-ai[embeddings]"
    }

    # Verify
    try {
        & $PyCmd -c "import rtfm; import fastembed" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] rtfm-ai[embeddings] installato (fastembed ONNX)" -ForegroundColor Green
        } else {
            Write-Host "[!!] fastembed non disponibile — la ricerca semantica non funzionerà" -ForegroundColor Yellow
            Write-Host "     Prova: $PipCmd install fastembed"
        }
    } catch {
        Write-Host "[!!] Verifica fallita — controlla l'installazione manualmente" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Cyan
Write-Host "Open Claude Code and run: /install-portable-wiki"
