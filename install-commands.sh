#!/usr/bin/env bash
# install-commands.sh — Bootstrap di LLM Wiki Portable.
#
# Installa SOLO le skill e i comandi, senza creare la wiki: da qui in poi
# la skill /llm-wiki-setup fa il resto (e sa aggiornare le versioni vecchie).
#
# Per installare direttamente la wiki, salta questo script:
#   python3 install.py --mode local --target ~/wiki --template general

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== LLM Wiki Portable — bootstrap ==="

install_into() {
  local base="$1" skills_sub="$2" commands_sub="$3" label="$4"

  mkdir -p "$base/$skills_sub" "$base/$commands_sub"

  for skill in "$SCRIPT_DIR"/skills/*/; do
    [ -d "$skill" ] || continue
    local name
    name="$(basename "$skill")"
    rm -rf "$base/$skills_sub/$name"
    cp -r "$skill" "$base/$skills_sub/$name"
  done

  for cmd in "$SCRIPT_DIR"/commands/*.md; do
    case "$cmd" in *-hermes.md) continue ;; esac
    cp "$cmd" "$base/$commands_sub/"
  done

  echo "[OK] $label: skill llm-wiki, llm-wiki-setup + comandi"
}

install_into "$HOME/.claude"          "skills"  "commands" "Claude Code"
install_into "$HOME/.config/opencode" "skill"   "command"  "OpenCode"

if [ -d "$HOME/.hermes" ] || command -v hermes >/dev/null 2>&1; then
  mkdir -p "$HOME/.hermes/skills/llm-dashboard"
  cp "$SCRIPT_DIR/commands/llm-dashboard-hermes.md" \
     "$HOME/.hermes/skills/llm-dashboard/SKILL.md"
  echo "[OK] Hermes Agent: skill /llm-dashboard"
fi

if command -v python3 >/dev/null 2>&1; then
  echo "[OK] Python: $(python3 --version 2>&1)"
elif command -v python >/dev/null 2>&1; then
  echo "[OK] Python: $(python --version 2>&1)"
else
  echo "[!!] Python non trovato — serve Python 3.8+ per sync, ricerca e lint"
fi

if command -v git >/dev/null 2>&1; then
  echo "[OK] git: $(git --version 2>&1)"
else
  echo "[!!] git non trovato — la wiki non avra' versionamento automatico"
fi

cat <<'MSG'

=== Fatto ===
Apri Claude Code o OpenCode e scrivi:

    /install-portable-wiki      (oppure semplicemente: "installa la wiki")

Ti verra' chiesto dove metterla (cartella locale, USB o cartella cloud) e quale
template usare. Se hai gia' una wiki, viene rilevata e aggiornata senza toccare
i tuoi dati.
MSG
