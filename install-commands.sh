#!/usr/bin/env bash
# install-commands.sh — Copy skills to Claude Code and OpenCode
# Usage: bash install-commands.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== LLM Wiki Portable — Install Commands ==="

# Claude Code
CLAUDE_DIR="$HOME/.claude/commands"
mkdir -p "$CLAUDE_DIR"
cp "$SCRIPT_DIR/commands/install-portable-wiki.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/llm-dashboard.md" "$CLAUDE_DIR/"
echo "[OK] Claude Code commands installed:"
echo "     /install-portable-wiki"
echo "     /llm-dashboard"

# OpenCode
OPENCODE_DIR="$HOME/.config/opencode/commands"
mkdir -p "$OPENCODE_DIR"
cp "$SCRIPT_DIR/templates/.opencode/commands/install-portable-wiki.md" "$OPENCODE_DIR/"
cp "$SCRIPT_DIR/templates/.opencode/commands/llm-dashboard.md" "$OPENCODE_DIR/"
echo "[OK] OpenCode commands installed"

# RTFM MCP (optional)
if pip show rtfm-ai > /dev/null 2>&1; then
  echo "[OK] rtfm-ai already installed"
else
  echo "[..] Installing rtfm-ai..."
  pip install rtfm-ai
  echo "[OK] rtfm-ai installed"
fi

# MCP config
MCP_FILE="$HOME/.claude/mcp.json"
if [ -f "$MCP_FILE" ]; then
  if grep -q '"rtfm"' "$MCP_FILE" 2>/dev/null; then
    echo "[OK] RTFM MCP already configured"
  else
    echo "[..] Adding RTFM MCP to mcp.json..."
    python3 -c "
import json
with open('$MCP_FILE','r') as f: d=json.load(f)
d.setdefault('mcpServers',{})['rtfm']={'command':'python','args':['-m','rtfm.mcp']}
with open('$MCP_FILE','w') as f: json.dump(d,f,indent=2)
"
    echo "[OK] RTFM MCP configured"
  fi
else
  echo '{"mcpServers":{"rtfm":{"command":"python","args":["-m","rtfm.mcp"]}}}' > "$MCP_FILE"
  echo "[OK] mcp.json created with RTFM MCP"
fi

echo ""
echo "=== Done! ==="
echo "Open Claude Code and run: /install-portable-wiki"
