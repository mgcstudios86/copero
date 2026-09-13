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
#   - Caso lineage-ref (PR #642, MGC-56): exit code == 0 con warnings
#     por fetch transitorio, NO fabricación.
#   - Caso fabricación verdadera (PR fabricacion): exit code != 0 con
#     "sha=<X>∉PR.commits".
#
# Uso: ./test-sha-citation.sh [negative|positive|lineage|fabrication|all]
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

# Cuerpo PR por defecto: el sticky contiene la cita. Si la fixture
# tiene `pr_body_sha_citations`, las añadimos al body para que el
# script las detecte como citas del PR (no sólo del sticky).
build_pr_body() {
  local fixture_path="$1"
  python3 - "$fixture_path" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as fh:
    fixture = json.load(fh)
sticky_cited = fixture['latest_sticky_comment']['cited_sha']
sticky_run = fixture['latest_sticky_comment']['cited_run_id']
body_lines = [f"SHA: `{sticky_cited}` run {sticky_run}"]
for sha in fixture.get('pr_body_sha_citations', []):
    body_lines.append(f"Referencia: `{sha}`")
print('\n'.join(body_lines))
PYEOF
}

run_case() {
  local case_name="$1"
  local expected_verdict="$2"
  local fixture_file="$3"
  local pr_number="$4"

  echo "=== Caso: $case_name (PR #$pr_number) ==="
  local fixture_path="${SCRIPT_DIR}/${fixture_file}"
  [[ -f "$fixture_path" ]] || { echo "::error::fixture ausente: $fixture_path" >&2; return 1; }

  local port mock_log mock_pid pr_body current_run_id
  port="$(pick_port)"
  mock_log="$(mktemp)"
  pr_body="$(build_pr_body "$fixture_path")"
  current_run_id="$(python3 - "$fixture_path" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as fh:
    fixture = json.load(fh)
print(fixture.get('current_run_id', ''))
PYEOF
)"

  # Arrancar mock como subproceso, esperar puerto abierto.
  # El mock implementa:
  #   - Conteo de requests por SHA para simular fallas transitorias
  #     según `historical_fetch_failures` (503 N veces, luego 200).
  #   - Para el run citado, si `current_run_api_errors > 0`,
  #     devuelve 503 tantas veces y luego head_sha válido.
  #   - Si cited_run_id == current_run_id, devuelve head_sha del
  #     fixture.pr_head_sha.
  python3 -c "
import json, sys
from http.server import HTTPServer, BaseHTTPRequestHandler

port = int(sys.argv[1])
fixture_path = sys.argv[2]
pr_number = sys.argv[3]
pr_body = sys.argv[4]

with open(fixture_path) as fh:
    fixture = json.load(fh)

sticky = fixture['latest_sticky_comment']
comments = json.dumps([{'user': {'login': 'github-actions[bot]'}, 'body': sticky['body']}]).encode()
green_set = set(fixture.get('green_sha_set', []))
historical_green_shas = set(fixture.get('historical_green_shas', []))
pr_commits = fixture.get('pr_commits', [])
pr_head_sha = fixture['pr_head_sha']
historical_failures = fixture.get('historical_fetch_failures', {})
current_run_id = str(fixture.get('current_run_id', ''))
current_run_api_errors = int(fixture.get('current_run_api_errors', 0))
run_api_attempts = {}
sha_attempts = {}

def check_runs_for(sha):
    if sha in green_set:
        return json.dumps({'check_runs': [
            {'name': 'lint (eslint)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
            {'name': 'typecheck (tsc --noEmit)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
            {'name': 'test web (vitest)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
            {'name': 'build web (expo export --platform web)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
            {'name': 'devops-comment (gate §8.1)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
            {'name': 'sha-citation (ADR-0029 Capa 3)', 'conclusion': 'success', 'completed_at': '2026-09-10T14:00:00Z'},
        ]}).encode()
    if sha in historical_green_shas:
        # SHA histórico del PR con check-runs mayormente CANCELLED pero
        # con Playwright (o un base check) SUCCESS en una corrida previa.
        # Simula la realidad de PR #642: 44914fc y 85067487 tuvieron
        # Playwright verde antes de ser superseded.
        return json.dumps({'check_runs': [
            {'name': 'Playwright (web, headless)', 'conclusion': 'success', 'completed_at': '2026-09-13T05:41:55Z'},
            {'name': 'detect changed paths', 'conclusion': 'success', 'completed_at': '2026-09-13T05:40:12Z'},
            {'name': 'lint (eslint)', 'conclusion': 'cancelled', 'completed_at': '2026-09-13T06:15:33Z'},
            {'name': 'sha-citation (ADR-0029 Capa 3)', 'conclusion': 'cancelled', 'completed_at': '2026-09-13T06:15:33Z'},
        ]}).encode()
    return json.dumps({'check_runs': [
        {'name': 'lint (eslint)', 'conclusion': 'failure', 'completed_at': '2026-09-10T14:00:00Z'},
    ]}).encode()

class H(BaseHTTPRequestHandler):
    def log_message(self, *a, **kw):
        return
    def do_GET(self):
        path = self.path
        # HEAD del PR (PR #N) — body con citas extraídas por fixture.
        if path == f'/repos/mgcstudios/copero/pulls/{pr_number}':
            body = json.dumps({
                'head': {'sha': fixture['pr_head_sha']},
                'body': pr_body,
            }).encode()
        # Lista de commits del PR.
        elif path.startswith(f'/repos/mgcstudios/copero/pulls/{pr_number}/commits'):
            body = json.dumps([{'sha': s} for s in pr_commits]).encode()
        # Check-runs de un commit específico. HEAD nunca falla (es
        # local y estable). Otros commits pueden tener fallas
        # transitorias según historical_fetch_failures.
        elif '/check-runs' in path:
            sha = path.split('/commits/')[1].split('/check-runs')[0]
            if sha == pr_head_sha:
                # HEAD siempre verde para el mock (es la fuente local).
                body = check_runs_for(sha)
            else:
                fail_count = historical_failures.get(sha, 0)
                attempts = sha_attempts.get(sha, 0) + 1
                sha_attempts[sha] = attempts
                if attempts <= fail_count:
                    self.send_response(503)
                    self.send_header('Content-Type', 'text/plain')
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                body = check_runs_for(sha)
        elif path == f'/repos/mgcstudios/copero/issues/{pr_number}/comments?per_page=100':
            body = comments
        elif path.startswith('/repos/mgcstudios/copero/actions/runs/'):
            run_id = path.split('/actions/runs/')[1]
            attempts = run_api_attempts.get(run_id, 0) + 1
            run_api_attempts[run_id] = attempts
            # Si el run citado es el current_run_id, devolver
            # head_sha del PR_HEAD para que la verificación pase
            # tras los retries (auto-referencia).
            if run_id == current_run_id:
                if attempts <= current_run_api_errors:
                    self.send_response(503)
                    self.send_header('Content-Type', 'text/plain')
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                body = json.dumps({
                    'head_sha': pr_head_sha,
                    'conclusion': 'success',
                }).encode()
            else:
                body = json.dumps({
                    'head_sha': sticky['cited_sha'],
                    'conclusion': 'success' if green_set else 'failure',
                }).encode()
        else:
            self.send_response(404); self.end_headers(); return
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

HTTPServer(('127.0.0.1', port), H).serve_forever()
" "$port" "$fixture_path" "$pr_number" "$pr_body" &> "$mock_log" &
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
         GITHUB_RUN_ID="$current_run_id" \
         PAPERCLIP_PRE_MERGE_LOG="$scratch/waivers.log" \
         "$PRE_MERGE" --pr "$pr_number" 2>&1)"
  exit_code=$?
  set -e

  kill "$mock_pid" 2>/dev/null || true
  wait "$mock_pid" 2>/dev/null || true

  echo "$out" | tail -25

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
  lineage)
    if run_case "lineage-ref-pr642" PASS "sha-citation-lineage-ref-pr642.json" 642; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    ;;
  fabrication)
    if run_case "fabrication-pr-fabrication" FAIL "sha-citation-pr-fabrication.json" 999; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    ;;
  all|"")
    if run_case "negative-pr612" FAIL "sha-citation-negative-pr612.json" 612; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    echo
    if run_case "positive-pr625" PASS "sha-citation-positive-pr625.json" 625; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    echo
    if run_case "lineage-ref-pr642" PASS "sha-citation-lineage-ref-pr642.json" 642; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    echo
    if run_case "fabrication-pr-fabrication" FAIL "sha-citation-pr-fabrication.json" 999; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
    ;;
  *)
    echo "Uso: $0 [negative|positive|lineage|fabrication|all]" >&2
    exit 2
    ;;
esac

echo
echo "Resumen: $PASS pass, $FAIL fail"
exit $FAIL
