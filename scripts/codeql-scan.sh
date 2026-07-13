#!/usr/bin/env bash
#
# Auditoria de segurança na PROFUNDIDADE DO CODEQL, localmente — espelha o check
# do GitHub na sua máquina, sem CI. Baixa a CodeQL CLI (bundle oficial) se
# necessário, cria o banco do código e roda o mesmo suite `security-extended`.
#
# Uso:  yarn security:deep
# 1ª execução baixa ~500MB (uma vez, cacheado em ~/.codeql-bundle) e construir o
# banco leva alguns minutos — é pesado de propósito (é o motor completo do CodeQL).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_DIR="${ROOT}/.codeql-db"
SARIF="${ROOT}/codeql.sarif"
CODEQL_HOME="${CODEQL_HOME:-$HOME/.codeql-bundle}"
SUITE="codeql/javascript-queries:codeql-suites/javascript-security-extended.qls"

log() { printf '\033[1;35m[codeql]\033[0m %s\n' "$*"; }

# 1) Resolve a CLI do CodeQL: PATH → extensão `gh codeql` → download do bundle.
resolve_codeql() {
  if command -v codeql >/dev/null 2>&1; then CODEQL="codeql"; return; fi
  if command -v gh >/dev/null 2>&1 && gh codeql version >/dev/null 2>&1; then
    CODEQL="gh codeql"
    return
  fi
  local bin="${CODEQL_HOME}/codeql/codeql"
  if [ ! -x "$bin" ]; then
    local asset
    case "$(uname -s)" in
      Linux) asset="codeql-bundle-linux64.tar.gz" ;;
      Darwin) asset="codeql-bundle-osx64.tar.gz" ;;
      *)
        echo "SO não suportado por este script — instale o CodeQL CLI manualmente." >&2
        exit 2
        ;;
    esac
    log "Baixando o CodeQL bundle (uma vez) em ${CODEQL_HOME}…"
    mkdir -p "$CODEQL_HOME"
    curl -fsSL "https://github.com/github/codeql-action/releases/latest/download/${asset}" |
      tar -xz -C "$CODEQL_HOME"
  fi
  CODEQL="$bin"
}

resolve_codeql
log "CLI: $($CODEQL version --format=terse 2>/dev/null || echo "$CODEQL")"

# 2) Cria o banco (JS/TS é "no-build": só extração). Ignora node_modules/dist.
rm -rf "$DB_DIR"
log "Construindo o banco de código…"
LGTM_INDEX_FILTERS=$'exclude:**/node_modules/**\nexclude:**/dist/**' \
  $CODEQL database create "$DB_DIR" \
  --language=javascript-typescript \
  --source-root "$ROOT" \
  --overwrite >/dev/null

# 3) Analisa com o mesmo suite do GitHub (security-extended).
log "Analisando (security-extended)…"
$CODEQL database analyze "$DB_DIR" "$SUITE" \
  --format=sarif-latest \
  --output="$SARIF" \
  --sarif-add-snippets >/dev/null

# 4) Resumo legível + código de saída (≠0 se houver alerta).
node -e '
  const fs = require("fs");
  const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const out = [];
  for (const run of s.runs || []) {
    for (const res of run.results || []) {
      const loc = res.locations?.[0]?.physicalLocation;
      out.push({
        rule: res.ruleId,
        level: res.level || "warning",
        msg: (res.message?.text || "").split("\n")[0],
        file: loc?.artifactLocation?.uri || "?",
        line: loc?.region?.startLine || 0,
      });
    }
  }
  if (out.length === 0) {
    console.log("\x1b[32m✓ CodeQL: nenhum alerta de segurança.\x1b[0m");
    process.exit(0);
  }
  console.log(`\x1b[31m✗ CodeQL: ${out.length} alerta(s):\x1b[0m`);
  for (const r of out) console.log(`  • [${r.level}] ${r.rule}\n    ${r.file}:${r.line} — ${r.msg}`);
  console.log(`\nSARIF completo: ${process.argv[1]}`);
  process.exit(1);
' "$SARIF"
