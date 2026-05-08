#!/usr/bin/env bash
# install-commands.sh — Copy commands to Claude Code and OpenCode
# Usage: bash install-commands.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== LLM Wiki Portable — Install Commands ==="

# ── Claude Code commands ──────────────────────────────────────────────────────
CLAUDE_DIR="$HOME/.claude/commands"
mkdir -p "$CLAUDE_DIR"
cp "$SCRIPT_DIR/commands/install-portable-wiki.md" "$CLAUDE_DIR/"
cp "$SCRIPT_DIR/commands/llm-dashboard.md" "$CLAUDE_DIR/"
echo "[OK] Claude Code commands: /install-portable-wiki  /llm-dashboard"

# ── OpenCode commands ──────────────────────────────────────────────────────────
OPENCODE_DIR="$HOME/.config/opencode/commands"
mkdir -p "$OPENCODE_DIR"
cp "$SCRIPT_DIR/commands/install-portable-wiki.md" "$OPENCODE_DIR/"
cp "$SCRIPT_DIR/commands/llm-dashboard.md" "$OPENCODE_DIR/"
echo "[OK] OpenCode commands: /install-portable-wiki  /llm-dashboard"

# ── Python check (needed for sync.py) ─────────────────────────────────────────
if command -v python3 &>/dev/null; then
  echo "[OK] Python: $(python3 --version 2>&1)"
elif command -v python &>/dev/null; then
  echo "[OK] Python: $(python --version 2>&1)"
else
  echo "[!!] Python non trovato — installa Python 3.8+ per usare sync.py e la dashboard"
fi

echo ""
echo "=== Done! ==="
echo "Open Claude Code and run: /install-portable-wiki"
