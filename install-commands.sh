#!/usr/bin/env bash
# install-commands.sh — Copy commands to Claude Code and OpenCode, install rtfm-ai
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

# ── Python detection ───────────────────────────────────────────────────────────
PY_CMD=""
PIP_CMD=""
if command -v python3 &>/dev/null; then
  PY_CMD="python3"
  PIP_CMD="pip3"
elif command -v python &>/dev/null; then
  PY_CMD="python"
  PIP_CMD="pip"
fi

if [ -z "$PY_CMD" ]; then
  echo "[!!] Python non trovato — installa Python 3.8+ e riesegui"
  echo "     Poi installa manualmente: pip install 'rtfm-ai[embeddings]'"
  echo ""
  echo "=== Done (parziale) ==="
  echo "Open Claude Code and run: /install-portable-wiki"
  exit 0
fi

echo "[OK] Python: $($PY_CMD --version 2>&1)"

# ── rtfm-ai with embeddings ───────────────────────────────────────────────────
EMBEDDINGS_OK=false
if $PY_CMD -c "import rtfm; import fastembed" 2>/dev/null; then
  EMBEDDINGS_OK=true
  echo "[OK] rtfm-ai + fastembed già installati"
fi

if [ "$EMBEDDINGS_OK" = false ]; then
  echo "[..] Installazione rtfm-ai[embeddings]..."
  $PIP_CMD install "rtfm-ai[embeddings]" || {
    echo "[!!] Installazione fallita con pip standard. Provo con --user..."
    $PIP_CMD install --user "rtfm-ai[embeddings]"
  }

  # Verify
  if $PY_CMD -c "import rtfm; import fastembed" 2>/dev/null; then
    echo "[OK] rtfm-ai[embeddings] installato (fastembed ONNX)"
  else
    echo "[!!] fastembed non disponibile — la ricerca semantica non funzionerà"
    echo "     Prova: $PIP_CMD install fastembed"
  fi
fi

echo ""
echo "=== Done! ==="
echo "Open Claude Code and run: /install-portable-wiki"
