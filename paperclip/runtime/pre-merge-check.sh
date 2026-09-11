#!/usr/bin/env bash
# pre-merge-check.sh — Capa 2 (ADR-0019) + Capa 3 (ADR-0029) de merge guard.
#
# Capa 2: el merge sólo puede continuar cuando la Capa 1 (workflow
# `devops-comment gate §8.1`) terminó en `success` Y cada uno de los
# cuatro checks base (lint, typecheck, test-web, build-web) está en
# estado terminal válido: `success` o `skipped`. El `skipped` es legítimo
# cuando el filtro `needs.changes.outputs.X == 'true'` excluyó al job
# (PR docs-only, workflow-only, etc.); cualquier otro estado no terminal
# o de fallo aborta el merge. Este gate es binario y fail-closed.
# El waiver ADR-0011 sólo cubre la identidad compartida en la revisión;
# nunca permite continuar con un check de CI rojo.
#
# Capa 3 (ADR-0029 anti-fabricación): el SHA citado como "CI verde" en
# el body del PR o en el comentario sticky del job `devops-comment`
# debe pertenecer al set de SHAs del PR que tienen un check-run con
# conclusión `success`. Caso de referencia: PR #612 squash 308d0986
# citó run 34565250199 sobre SHA 10e9c2a80 (FAILURE) — el HEAD real
# 5b6b238d tenía run 34566703382 FAILURE. La Capa 3 cierra ese
# vector de fabricación comparando el SHA citado contra los commits
# del PR y los check-runs de cada uno.

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

# Capa 2 (CI-green sobre SHA) y Capa 3 (anti-fabricación SHA citation) son
# dos gates diferentes. La CI workflow encadena sha-citation-check con
# lint/typecheck/test-web/build-web vía `needs:` y por eso puede evaluar
# Capa 2 sobre el mismo run. La QA workflow corre en un workflow separado
# y no puede ver los check-runs de CI en tiempo real — su primer run sobre
# una PR siempre vería todos los checks en `missing` y fallaría Capa 2
# falsamente. SKIP_CAPA_2=1 desactiva sólo Capa 2; Capa 3 sigue activa.
SKIP_CAPA_2="${SKIP_CAPA_2:-0}"

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
  if [[ "$SKIP_CAPA_2" == "1" ]]; then
    red_checks_text="$(IFS=', '; printf '%s' "${red_checks[*]}")"
    echo "::notice title=ADR-0019 Capa 2 SKIP::PR #${PR_NUMBER} SHA ${PR_HEAD_SHA}; checks no exitosos omitidos (SKIP_CAPA_2=1): ${red_checks_text}; actor=${ACTOR}"
  else
    red_checks_text="$(IFS=', '; printf '%s' "${red_checks[*]}")"
    write_audit_log FAIL "$red_checks_text"
    echo "::error title=ADR-0019 Capa 2 bloqueada::PR #${PR_NUMBER} SHA ${PR_HEAD_SHA}; checks no exitosos: ${red_checks_text}; actor=${ACTOR}" >&2
    exit 1
  fi
fi

# ─────────────────────────────────────────────────────────────────────────
# Capa 3 — ADR-0029 anti-fabricación de SHA citation
# ─────────────────────────────────────────────────────────────────────────
# El SHA citado como "CI verde" en (a) el PR body o (b) el último comentario
# sticky del job `devops-comment` debe pertenecer al set de SHAs del PR que
# tienen un check-run con conclusión `success`. Esto cierra el vector
# PR #612: comentar "CI verde en SHA X" cuando X es un commit anterior al
# HEAD y el SHA sobre el cual realmente corrió el run era otro (o era rojo).
#
# Set verde: green_sha_set = { s ∈ PR.commits | ∃ check-run sobre s con
# conclusion == "success" }.
#
# Si no se puede parsear la cita, o el SHA citado no está en el set, o el
# run citado (regex `runs/(\d+)`) tiene head_sha ∉ PR.commits → FAIL.
# ─────────────────────────────────────────────────────────────────────────

# En modo dry-run o si la API devolvió error persistente, la Capa 3 también
# debe ser explícita. ADR-0029 dice "falla cerrada", pero `--dry-run` debe
# sobrevivir para inspección manual; usar SKIP explícito en log.
DRY_RUN="0"
if [[ "${1:-}" == "--dry-run" || "${PAPERCLIP_PRE_MERGE_DRY_RUN:-0}" == "1" ]]; then
  DRY_RUN="1"
fi

# PR body
PR_BODY=""
if ! PR_BODY="$(fetch_json "${GITHUB_API}/repos/${REPOSITORY}/pulls/${PR_NUMBER}" | jq -er '.body // ""' 2>/dev/null)"; then
  PR_BODY=""
fi

# Comentarios del PR (incluye el sticky del job devops-comment).
PR_COMMENTS_JSON=""
if ! PR_COMMENTS_JSON="$(fetch_json "${GITHUB_API}/repos/${REPOSITORY}/issues/${PR_NUMBER}/comments?per_page=100")"; then
  echo "::warning title=Capa 3 sin comentarios::no se pudo consultar /issues/${PR_NUMBER}/comments; se omite la verificación del comentario sticky." >&2
  PR_COMMENTS_JSON='[]'
fi
if ! jq -e 'type == "array"' >/dev/null 2>&1 <<<"$PR_COMMENTS_JSON"; then
  PR_COMMENTS_JSON='[]'
fi

# Citas detectadas: union(body + último comentario sticky). Formato
# `SHA: \`<40hex>\`` o matches sueltos de 7-40 hex dentro de bloque code.
# Si no hay cita detectable, la Capa 3 falla cerrada salvo dry-run.
EXTRACT_SHAS() {
  printf '%s\n' "$1" \
    | grep -oE 'SHA:[[:space:]]*`[0-9a-f]{7,40}`' \
    | grep -oE '[0-9a-f]{7,40}' || true
  printf '%s\n' "$1" \
    | grep -oE '`[0-9a-f]{7,40}`' \
    | grep -vE 'SHA:' \
    | grep -oE '[0-9a-f]{7,40}' || true
}
EXTRACT_RUN_IDS() {
  printf '%s\n' "$1" \
    | grep -oE 'runs/[0-9]+' \
    | grep -oE '[0-9]+' || true
}

# Lista de comentarios — tomar el último del bot devops-comment-ci-gate-strict.
# El sticky-publish añade header `devops-ci-gate-strict`. Si no hay sticky,
# tomar el último comentario humano del PR (puede contener SHA citation
# legítima, p.ej. "SHA foo123 verificado").
LATEST_STICKY_BODY="$(jq -r '[.[] | select(.body | test("devops-ci-gate-strict"; "i"))] | last | .body // ""' <<<"$PR_COMMENTS_JSON")"
LATEST_USER_BODY="$(jq -r '[.[] | select(.body | test("devops-ci-gate-strict"; "i") | not)] | last | .body // ""' <<<"$PR_COMMENTS_JSON")"

CITED_SHAS_RAW=""
CITED_SHAS_RAW+="$(EXTRACT_SHAS "$PR_BODY")"
CITED_SHAS_RAW+=$'\n'
CITED_SHAS_RAW+="$(EXTRACT_SHAS "$LATEST_STICKY_BODY")"
CITED_SHAS_RAW+=$'\n'
CITED_SHAS_RAW+="$(EXTRACT_SHAS "$LATEST_USER_BODY")"

CITED_RUN_RAW=""
CITED_RUN_RAW+="$(EXTRACT_RUN_IDS "$PR_BODY")"
CITED_RUN_RAW+=$'\n'
CITED_RUN_RAW+="$(EXTRACT_RUN_IDS "$LATEST_STICKY_BODY")"
CITED_RUN_RAW+=$'\n'
CITED_RUN_RAW+="$(EXTRACT_RUN_IDS "$LATEST_USER_BODY")"

# Filtrar: una línea es SHA sólo si TODOS sus caracteres están en [0-9a-f].
# Esto evita que un run id "34571877608" (dígitos puros) matchee como SHA.
CITED_SHAS="$(printf '%s\n' "$CITED_SHAS_RAW" | awk '/^[0-9a-f]{7,40}$/' | sort -u || true)"
# Filtrar: una línea es run id sólo si TODOS sus caracteres son dígitos.
CITED_RUN_IDS="$(printf '%s\n' "$CITED_RUN_RAW" | awk '/^[0-9]+$/' | sort -u || true)"

# Si no hay citas, la Capa 3 no aplica (modo lectura silenciosa). Sólo se
# falla cerrada si hay citas que no verifican. Caso PR #612 dejó cita
# explícita del SHA y run; sin cita → no hay evidencia que fabricar.
if [[ -z "$CITED_SHAS" && -z "$CITED_RUN_IDS" ]]; then
  printf '| sha-citation (Capa 3) | SKIP (sin citas en body ni comentarios) |\n'
  write_audit_log PASS "capa3=skip-no-citations"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "::notice title=ADR-0029 Capa 3 SKIP::PR #${PR_NUMBER} sin citas de SHA; nada que verificar."
    exit 0
  fi
  echo "::notice title=ADR-0019+0029 aprobadas::PR #${PR_NUMBER} SHA ${PR_HEAD_SHA}; Capa 2 PASS, Capa 3 SKIP (sin citas)"
  exit 0
fi

# Construir green_sha_set.
# 1) PR.commits — todos los SHAs del PR.
PR_COMMITS_JSON=""
if ! PR_COMMITS_JSON="$(fetch_json "${GITHUB_API}/repos/${REPOSITORY}/pulls/${PR_NUMBER}/commits?per_page=100")"; then
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "::warning title=Capa 3 dry-run parcial::no se pudo listar PR commits; verificando sólo que el SHA citado sea igual al HEAD."
  else
    write_audit_log FAIL "capa3=api-error-commits"
    echo "::error title=ADR-0029 Capa 3 bloqueada::no se pudo listar commits del PR #${PR_NUMBER}" >&2
    exit 1
  fi
fi
PR_COMMIT_SHAS="$(jq -r '[.[].sha] | .[]' <<<"$PR_COMMITS_JSON" 2>/dev/null | sort -u || true)"

# 2) Para cada commit, check-runs y filtrar los que tengan conclusión
# `success` en alguno de los 4 jobs base + el gate devops-comment.
GREEN_SHA_SET=""
for commit_sha in $PR_COMMIT_SHAS; do
  commit_checks=""
  if ! commit_checks="$(fetch_json "${GITHUB_API}/repos/${REPOSITORY}/commits/${commit_sha}/check-runs?per_page=100")"; then
    continue
  fi
  if jq -e 'type == "object" and (.check_runs | type == "array")' >/dev/null 2>&1 <<<"$commit_checks"; then
    if jq -e '[.check_runs[] | select(.conclusion == "success")] | length > 0' >/dev/null 2>&1 <<<"$commit_checks"; then
      GREEN_SHA_SET+="$(printf '%s\n' "$commit_sha")"
    fi
  fi
done
GREEN_SHA_SET="$(printf '%s\n' "$GREEN_SHA_SET" | sort -u | sed '/^$/d')"

printf '| sha-citation (Capa 3) | %d commits verdes en set |' "$(printf '%s\n' "$GREEN_SHA_SET" | grep -c . || true)"

# Validar cada SHA citado. Soporta SHA completo (40 hex) o corto
# (≥7 hex). Para SHA corto, expandimos a cualquier commit del PR cuyo
# prefijo coincida y exigimos que ese commit esté en green_sha_set.
SHA_CITATION_FAIL=()
for cited_sha in $CITED_SHAS; do
  # ¿Es un SHA completo presente en el set?
  if grep -qx "$cited_sha" <<<"$GREEN_SHA_SET" 2>/dev/null; then
    continue
  fi
  # ¿Es un SHA corto (≥7 hex) que matchea por prefijo a un commit verde?
  if [[ ${#cited_sha} -ge 7 && ${#cited_sha} -lt 40 ]]; then
    matches="$(grep -E "^${cited_sha}" <<<"$GREEN_SHA_SET" 2>/dev/null || true)"
    # Exigir prefijo único (no ambiguo entre dos commits del PR).
    match_count="$(printf '%s\n' "$matches" | grep -c . || true)"
    if [[ "$match_count" == "1" ]]; then
      continue
    fi
    SHA_CITATION_FAIL+=("sha=${cited_sha}=prefix-ambiguous(${match_count})")
    continue
  fi
  SHA_CITATION_FAIL+=("sha=${cited_sha}∉green_sha_set")
done

# Validar cada run ID citado: el head_sha del run debe estar en el set
# verde Y debe ser un commit del PR (no run de otro PR).
for run_id in $CITED_RUN_IDS; do
  run_json=""
  if ! run_json="$(fetch_json "${GITHUB_API}/repos/${REPOSITORY}/actions/runs/${run_id}")"; then
    SHA_CITATION_FAIL+=("run=${run_id}=api-error")
    continue
  fi
  run_head_sha="$(jq -er '.head_sha // empty' <<<"$run_json" 2>/dev/null || true)"
  if [[ -z "$run_head_sha" ]]; then
    SHA_CITATION_FAIL+=("run=${run_id}=missing-head_sha")
    continue
  fi
  if ! grep -qx "$run_head_sha" <<<"$PR_COMMIT_SHAS" 2>/dev/null; then
    SHA_CITATION_FAIL+=("run=${run_id}=head_sha=${run_head_sha}∉PR.commits")
    continue
  fi
  if ! grep -qx "$run_head_sha" <<<"$GREEN_SHA_SET" 2>/dev/null; then
    SHA_CITATION_FAIL+=("run=${run_id}=head_sha=${run_head_sha}∉green_sha_set")
    continue
  fi
done

if ((${#SHA_CITATION_FAIL[@]} > 0)); then
  fail_text="$(IFS=', '; printf '%s' "${SHA_CITATION_FAIL[*]}")"
  write_audit_log FAIL "capa3=${fail_text}"
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '\n::warning title=ADR-0029 Capa 3 dry-run::PR #%s SHA %s — citas no verificarían: %s\n' \
      "$PR_NUMBER" "$PR_HEAD_SHA" "$fail_text"
    exit 0
  fi
  echo "::error title=ADR-0029 Capa 3 bloqueada::PR #${PR_NUMBER} SHA ${PR_HEAD_SHA}; fabricación detectada: ${fail_text}; actor=${ACTOR}; ref MGC-2968/MGC-2986" >&2
  exit 1
fi

printf '\n| sha-citation (Capa 3) | PASS |\n'
write_audit_log PASS "capa3=ok"
echo "::notice title=ADR-0019+0029 aprobadas::PR #${PR_NUMBER} SHA ${PR_HEAD_SHA}; Capa 2 PASS, Capa 3 PASS (citas verificadas contra green_sha_set); actor=${ACTOR}"
exit 0
