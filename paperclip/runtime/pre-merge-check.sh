#!/usr/bin/env bash
# pre-merge-check.sh — Capa 2 de ADR-0019.
#
# El merge sólo puede continuar cuando la Capa 1 (workflow
# `devops-comment gate §8.1`) terminó en `success` Y cada uno de los
# cuatro checks base (lint, typecheck, test-web, build-web) está en
# estado terminal válido: `success` o `skipped`. El `skipped` es legítimo
# cuando el filtro `needs.changes.outputs.X == 'true'` excluyó al job
# (PR docs-only, workflow-only, etc.); cualquier otro estado no terminal
# o de fallo aborta el merge. Este gate es binario y fail-closed.
# El waiver ADR-0011 sólo cubre la identidad compartida en la revisión;
# nunca permite continuar con un check de CI rojo.

set -euo pipefail

REPOSITORY="${GITHUB_REPOSITORY:-mgcstudios/copero}"
GITHUB_API="${GITHUB_API_URL:-https://api.github.com}"
PR_NUMBER="${PR_NUMBER:-}"
PR_HEAD_SHA="${PR_HEAD_SHA:-}"
RUN_SCRATCH_DIR="${PAPERCLIP_RUN_SCRATCH_DIR:-paperclip/monitoring}"
LOG_FILE="${PAPERCLIP_PRE_MERGE_LOG:-${RUN_SCRATCH_DIR}/pre-merge-waivers.log}"
ACTOR="${GITHUB_ACTOR:-mgcstudios86}"
API_ERROR=""
CHECKS_JSON=""

CHECK_KEYS=(lint typecheck test-web build-web)
CHECK_NAMES=(
  "lint (eslint)"
  "typecheck (tsc --noEmit)"
  "test web (vitest)"
  "build web (expo export --platform web)"
)
CHECK_RESULTS=()
# El gate de Capa 1 (workflow) encapsula el verdict combinado.
GATE_NAME="devops-comment (gate §8.1)"

usage() {
  printf 'Uso: %s --pr NUMERO [--sha SHA]\n' "$0" >&2
}

fail_invocation() {
  echo "::error title=Pre-merge gate inválido::$1" >&2
  exit 1
}

while (($# > 0)); do
  case "$1" in
    --pr)
      (($# >= 2)) || fail_invocation "--pr requiere un número"
      PR_NUMBER="$2"
      shift 2
      ;;
    --sha)
      (($# >= 2)) || fail_invocation "--sha requiere un SHA"
      PR_HEAD_SHA="$2"
      shift 2
      ;;
    --repo)
      (($# >= 2)) || fail_invocation "--repo requiere owner/repository"
      REPOSITORY="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      fail_invocation "argumento desconocido: $1"
      ;;
  esac
done

require_binary() {
  command -v "$1" >/dev/null 2>&1 || fail_invocation "binario requerido ausente: $1"
}

require_binary curl
require_binary jq

[[ -n "$PR_NUMBER" ]] || fail_invocation "falta PR_NUMBER o --pr"
[[ -n "${GITHUB_TOKEN:-}" ]] || fail_invocation "falta GITHUB_TOKEN para consultar GitHub"

fetch_json() {
  local url="$1"
  local temporary_file http_code body

  temporary_file="$(mktemp "${TMPDIR:-/tmp}/pre-merge-check.XXXXXX")"
  http_code="$(curl --silent --show-error --max-time "${PAPERCLIP_API_TIMEOUT:-15}" \
    --write-out '%{http_code}' \
    --output "$temporary_file" \
    -H "Authorization: Bearer ${GITHUB_TOKEN:-}" \
    -H 'Accept: application/vnd.github+json' \
    "$url" || true)"
  body="$(<"$temporary_file")"
  rm -f "$temporary_file"

  if [[ "$http_code" != "200" ]]; then
    API_ERROR="HTTP ${http_code:-000} al consultar GitHub"
    return 1
  fi

  printf '%s' "$body"
}

if [[ -z "$PR_HEAD_SHA" ]]; then
  pr_json=""
  if ! pr_json="$(fetch_json "${GITHUB_API}/repos/${REPOSITORY}/pulls/${PR_NUMBER}")"; then
    fail_invocation "no se pudo obtener el SHA del PR: ${API_ERROR}"
  fi
  if ! PR_HEAD_SHA="$(jq -er '.head.sha // empty' <<<"$pr_json")"; then
    fail_invocation "la API del PR no devolvió head.sha"
  fi
fi

if ! CHECKS_JSON="$(fetch_json "${GITHUB_API}/repos/${REPOSITORY}/commits/${PR_HEAD_SHA}/check-runs?per_page=100")"; then
  CHECKS_JSON='{"check_runs":[]}'
  echo "::warning title=Consulta de checks fallida::$API_ERROR; todos los checks quedan en missing" >&2
fi
if ! jq -e 'type == "object" and (.check_runs | type == "array")' >/dev/null 2>&1 <<<"$CHECKS_JSON"; then
  echo "::warning title=Respuesta de checks inválida::se esperaba un objeto con check_runs; todos los checks quedan en missing" >&2
  CHECKS_JSON='{"check_runs":[]}'
fi

result_from_check_runs() {
  local key="$1"
  local expected_name="$2"

  jq -r --arg key "$key" --arg expected "$expected_name" '
    [ .check_runs[]?
      | select(.name == $expected or .name == $key)
      | {
          conclusion: (.conclusion // ""),
          status: (.status // ""),
          timestamp: (.completed_at // .started_at // "")
        }
    ]
    | sort_by(.timestamp)
    | .[-1]
    | if . == null then "missing"
      elif .conclusion != "" then .conclusion
      elif .status != "" then .status
      else "missing"
      end
  ' <<<"$CHECKS_JSON"
}

for index in "${!CHECK_KEYS[@]}"; do
  CHECK_RESULTS[index]="$(result_from_check_runs "${CHECK_KEYS[index]}" "${CHECK_NAMES[index]}")"
done

# Capa 1 verdict (devops-comment job) — fuente de verdad binaria de ADR-0019.
GATE_RESULT="$(result_from_check_runs "$GATE_NAME" "$GATE_NAME")"

printf '| Job | Resultado |\n'
printf '| --- | --- |\n'
printf '| %s | %s |\n' "$GATE_NAME" "$GATE_RESULT"
for index in "${!CHECK_KEYS[@]}"; do
  printf '| %s | %s |\n' "${CHECK_KEYS[index]}" "${CHECK_RESULTS[index]}"
done

# Estados terminales válidos para los 4 checks base:
#   success              → el job corrió y aprobó
#   skipped              → el filtro needs.changes.outputs.X == 'false'
#                          excluyó al job (legítimo, no es bypass)
# Todo lo demás (failure / cancelled / timed_out / pending / in_progress /
# missing / neutral) bloquea el merge.
job_ok() {
  case "$1" in
    success) return 0 ;;
    skipped) return 0 ;;
    *)       return 1 ;;
  esac
}

red_checks=()
if [[ "$GATE_RESULT" != "success" ]]; then
  red_checks+=("devops-comment=$GATE_RESULT")
fi
for index in "${!CHECK_KEYS[@]}"; do
  if ! job_ok "${CHECK_RESULTS[index]}"; then
    red_checks+=("${CHECK_KEYS[index]}=${CHECK_RESULTS[index]}")
  fi
done

write_audit_log() {
  local verdict="$1"
  local red="$2"
  local parent

  parent="$(dirname "$LOG_FILE")"
  mkdir -p "$parent"
  printf '%s pr=%s sha=%s verdict=%s checks_red=%s actor=%s\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    "$PR_NUMBER" "$PR_HEAD_SHA" "$verdict" "$red" "$ACTOR" \
    >> "$LOG_FILE"
}

if ((${#red_checks[@]} > 0)); then
  red_checks_text="$(IFS=', '; printf '%s' "${red_checks[*]}")"
  write_audit_log FAIL "$red_checks_text"
  echo "::error title=ADR-0019 Capa 2 bloqueada::PR #${PR_NUMBER} SHA ${PR_HEAD_SHA}; checks no exitosos: ${red_checks_text}; actor=${ACTOR}" >&2
  exit 1
fi

write_audit_log PASS none
echo "::notice title=ADR-0019 Capa 2 aprobada::PR #${PR_NUMBER} SHA ${PR_HEAD_SHA}; lint/typecheck/test-web/build-web=success; actor=${ACTOR}"
exit 0
