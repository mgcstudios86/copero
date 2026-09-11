#!/usr/bin/env bash
# test-sha-citation.sh — Fixture test runner para ADR-0029 Capa 3.
#
# Lanza un mock server (python http.server con handler inline) que sirve
# los fixtures y ejecuta pre-merge-check.sh contra él. Valida que:
#
#   - Caso negativo (PR #612): exit code != 0 y el log menciona
#     "ADR-0029 Capa 3 bloqueada" o "verdict=FAIL".
#   - Caso positivo (PR #625): exit code == 0 y el log menciona
#     "verdict=PASS" o "capa3=ok".
#
# Uso: ./test-sha-citation.sh [negative|positive|all]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
PRE_MERGE="${REPO_ROOT}/paperclip/runtime/pre-merge-check.sh"

if [[ ! -x "$PRE_MERGE" ]]; then
  echo "::error::pre-merge-check.sh no ejecutable: $PRE_MERGE" >&2
  exit 2
fi

# Puerto disponible aleatorio para evitar colisiones con otros tests.
pick_port() {
  python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()'
}

run_case() {
  local case_name="$1"
  local expected_verdict="$2"
  local fixture_file="$3"
  local pr_number="$4"

  echo "=== Caso: $case_name (PR #$pr_number) ==="
  local fixture_path="${SCRIPT_DIR}/${fixture_file}"
  [[ -f "$fixture_path" ]] || { echo "::error::fixture ausente: $fixture_path" >&2; return 1; }

  local port mock_log mock_pid
  port="$(pick_port)"
  mock_log="$(mktemp)"

  # Arrancar mock como subproceso, esperar puerto abierto.
  python3 -c "
import json, sys
from http.server import HTTPServer, BaseHTTPRequestHandler

port = int(sys.argv[1])
fixture_path = sys.argv[2]
pr_number = sys.argv[3]

with open(fixture_path) as fh:
    fixture = json.load(fh)

sticky = fixture['latest_sticky_comment']
comments = json.dumps([{'user': {'login': 'github-actions[bot]'}, 'body': sticky['body']}]).encode()

def check_runs_for(sha):
    if sha in fixture.get('green_sha_set', []):
        return json.dumps({'check_runs': [
            {'name': 'lint (eslint)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
            {'name': 'typecheck (tsc --noEmit)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
            {'name': 'test web (vitest)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
            {'name': 'build web (expo export --platform web)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
            {'name': 'devops-comment (gate §8.1)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
        ]}).encode()
    return json.dumps({'check_runs': [
        {'name': 'lint (eslint)', 'conclusion': 'failure', 'completed_at': '2026-09-10T14:00:00Z'},
    ]}).encode()

class H(BaseHTTPRequestHandler):
    def log_message(self, *a, **kw):
        return
    def do_GET(self):
        path = self.path
        if path == f'/repos/mgcstudios/copero/pulls/{pr_number}':
            body = json.dumps({
                'head': {'sha': fixture['pr_head_sha']},
                'body': f\"SHA: \`{sticky['cited_sha']}\` run {sticky['cited_run_id']}\",
            }).encode()
        elif path.startswith(f'/repos/mgcstudios/copero/pulls/{pr_number}/commits'):
            body = json.dumps([{'sha': s} for s in fixture['pr_commits']]).encode()
        elif '/check-runs' in path:
            sha = path.split('/commits/')[1].split('/check-runs')[0]
            body = check_runs_for(sha)
        elif path == f'/repos/mgcstudios/copero/issues/{pr_number}/comments?per_page=100':
            body = comments
        elif path.startswith('/repos/mgcstudios/copero/actions/runs/'):
            body = json.dumps({
                'head_sha': sticky['cited_sha'],
                'conclusion': 'failure' if not fixture.get('green_sha_set') else 'success',
            }).encode()
        else:
            self.send_response(404); self.end_headers(); return
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

HTTPServer(('127.0.0.1', port), H).serve_forever()
" "$port" "$fixture_path" "$pr_number" &> "$mock_log" &
  mock_pid=$!

  # Esperar puerto abierto (timeout 5s).
  local ready=0
  for _ in $(seq 1 50); do
    if (echo > /dev/tcp/127.0.0.1/$port) 2>/dev/null; then ready=1; break; fi
    sleep 0.1
  done
  if [[ $ready -ne 1 ]]; then
    kill "$mock_pid" 2>/dev/null || true
    echo "::error::mock no levantó puerto $port" >&2
    cat "$mock_log" >&2
    return 1
  fi

  # Ejecutar pre-merge-check con mock. Capturar exit + stdout/stderr.
  local out exit_code scratch
  scratch="$(mktemp -d)"
  set +e
  out="$(GITHUB_API_URL="http://127.0.0.1:$port" \
         GITHUB_TOKEN="mock-token" \
         PR_NUMBER="$pr_number" \
         PAPERCLIP_PRE_MERGE_LOG="$scratch/waivers.log" \
         "$PRE_MERGE" --pr "$pr_number" 2>&1)"
  exit_code=$?
  set -e

  kill "$mock_pid" 2>/dev/null || true
  wait "$mock_pid" 2>/dev/null || true

  echo "$out" | tail -20

  # Validación.
  local expectations_ok=0
  if [[ "$expected_verdict" == "FAIL" ]]; then
    if [[ $exit_code -ne 0 ]] \
      && echo "$out" | grep -q "ADR-0029 Capa 3 bloqueada"; then
      expectations_ok=1
    fi
  else
    if [[ $exit_code -eq 0 ]] \
      && grep -q "capa3=ok" "$scratch/waivers.log" 2>/dev/null; then
      expectations_ok=1
    fi
  fi

  rm -rf "$scratch"

  if [[ $expectations_ok -eq 1 ]]; then
    echo "[OK] caso $case_name (exit=$exit_code, verdict=$expected_verdict)"
    return 0
  fi
  echo "[FAIL] caso $case_name — exit=$exit_code (esperado verdict=$expected_verdict)" >&2
  echo "--- log del mock ---" >&2
  cat "$mock_log" >&2 || true
  return 1
}

PASS=0; FAIL=0
case "${1:-all}" in
  negative)
    if run_case "negative-pr612" FAIL "sha-citation-negative-pr612.json" 612; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    ;;
  positive)
    if run_case "positive-pr625" PASS "sha-citation-positive-pr625.json" 625; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    ;;
  all|"")
    if run_case "negative-pr612" FAIL "sha-citation-negative-pr612.json" 612; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    echo
    if run_case "positive-pr625" PASS "sha-citation-positive-pr625.json" 625; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    ;;
  *)
    echo "Uso: $0 [negative|positive|all]" >&2
    exit 2
    ;;
esac

echo
echo "Resumen: $PASS pass, $FAIL fail"
exit $FAIL
