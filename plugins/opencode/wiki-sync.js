/**
 * wiki-sync.js — Plugin OpenCode di LLM Wiki Portable.
 *
 * Gemello degli hook di Claude Code:
 *  - session start  -> inietta indice + log recente
 *  - tool.execute.after su write/edit dentro wiki/ -> lancia sync.py
 *
 * Installato in ~/.config/opencode/plugin/ dall'installer.
 * Il path della wiki arriva da LLM_WIKI_ROOT o dal registro ~/.llm-wiki/roots.json.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEBOUNCE_MS = 3000;
let lastSync = 0;

function resolveRoot() {
  const fromEnv = process.env.LLM_WIKI_ROOT;
  if (fromEnv && existsSync(join(fromEnv, ".llmwiki-root"))) return fromEnv;

  try {
    const registry = JSON.parse(
      readFileSync(join(homedir(), ".llm-wiki", "roots.json"), "utf8"),
    );
    for (const entry of registry.roots || []) {
      if (entry.path && existsSync(join(entry.path, ".llmwiki-root"))) {
        return entry.path;
      }
    }
  } catch {
    // registro assente o illeggibile: nessuna wiki configurata
  }
  return null;
}

function python() {
  return process.platform === "win32" ? "python" : "python3";
}

function run(script, args, root) {
  return new Promise((resolve) => {
    execFile(
      python(),
      [join(root, "tools", script), ...args],
      { timeout: 60000, cwd: root },
      (err, stdout) => resolve(err ? "" : stdout),
    );
  });
}

export const WikiSync = async ({ $ }) => {
  const root = resolveRoot();
  if (!root) return {};

  const wikiDir = join(root, "wiki");

  return {
    /** Contesto iniziale: l'agente parte sapendo cosa c'e' nella wiki. */
    "chat.params": async (input, output) => {
      if (output.__wikiPrimed) return;
      output.__wikiPrimed = true;

      const index = join(wikiDir, "index.md");
      if (!existsSync(index)) return;

      const log = await run("log.py", ["--root", root, "--tail", "8"], root);
      const preamble = [
        `# LLM Wiki Portable attiva — ${root}`,
        "",
        "Consulta la wiki prima di rispondere su argomenti che potrebbe gia' coprire,",
        "e salvaci la conoscenza durevole prima di chiudere.",
        "",
        "```bash",
        `${python()} ${root}/tools/search.py --query "<termini>" --top 5`,
        `${python()} ${root}/tools/search.py --list-pages`,
        "```",
        "",
        readFileSync(index, "utf8").slice(0, 3000),
        "",
        log,
      ].join("\n");

      output.system = [...(output.system || []), preamble];
    },

    /** Auto-sync: l'agente non deve ricordarsi di lanciare sync.py. */
    "tool.execute.after": async (input, output) => {
      if (!["write", "edit", "patch"].includes(input.tool)) return;

      const path =
        output?.args?.filePath || output?.args?.path || input?.args?.filePath;
      if (!path || !String(path).startsWith(wikiDir)) return;

      const now = Date.now();
      if (now - lastSync < DEBOUNCE_MS) return;
      lastSync = now;

      await run("sync.py", ["--root", root, "--quiet"], root);
    },
  };
};

export default WikiSync;
