# install-commands.ps1 — Copy skills to Claude Code and OpenCode
# Usage: powershell -File install-commands.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== LLM Wiki Portable — Install Commands ===" -ForegroundColor Cyan

# Claude Code
$ClaudeDir = "$env:USERPROFILE\.claude\commands"
New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null
Copy-Item "$ScriptDir\commands\install-portable-wiki.md" $ClaudeDir
Copy-Item "$ScriptDir\commands\llm-dashboard.md" $ClaudeDir
Write-Host "[OK] Claude Code commands installed:" -ForegroundColor Green
Write-Host "     /install-portable-wiki"
Write-Host "     /llm-dashboard"

# OpenCode
$OpenCodeDir = "$env:USERPROFILE\.config\opencode\commands"
New-Item -ItemType Directory -Force -Path $OpenCodeDir | Out-Null
Copy-Item "$ScriptDir\templates\.opencode\commands\install-portable-wiki.md" $OpenCodeDir
Copy-Item "$ScriptDir\templates\.opencode\commands\llm-dashboard.md" $OpenCodeDir
Write-Host "[OK] OpenCode commands installed" -ForegroundColor Green

# RTFM MCP
$rtfmInstalled = pip show rtfm-ai 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] rtfm-ai already installed" -ForegroundColor Green
} else {
    Write-Host "[..] Installing rtfm-ai..."
    pip install rtfm-ai
    Write-Host "[OK] rtfm-ai installed" -ForegroundColor Green
}

# MCP config
$McpFile = "$env:USERPROFILE\.claude\mcp.json"
if (Test-Path $McpFile) {
    $mcpContent = Get-Content $McpFile -Raw
    if ($mcpContent -match '"rtfm"') {
        Write-Host "[OK] RTFM MCP already configured" -ForegroundColor Green
    } else {
        Write-Host "[..] Adding RTFM MCP to mcp.json..."
        $mcp = Get-Content $McpFile -Raw | ConvertFrom-Json
        if (-not $mcp.mcpServers) { $mcp | Add-Member -NotePropertyName mcpServers -NotePropertyValue @{} }
        $mcp.mcpServers | Add-Member -NotePropertyName "rtfm" -NotePropertyValue @{command="python";args=@("-m","rtfm.mcp")} -Force
        $mcp | ConvertTo-Json -Depth 5 | Set-Content $McpFile
        Write-Host "[OK] RTFM MCP configured" -ForegroundColor Green
    }
} else {
    '{"mcpServers":{"rtfm":{"command":"python","args":["-m","rtfm.mcp"]}}}' | Set-Content $McpFile
    Write-Host "[OK] mcp.json created with RTFM MCP" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Cyan
Write-Host "Open Claude Code and run: /install-portable-wiki"
