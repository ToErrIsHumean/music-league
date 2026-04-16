#!/usr/bin/env bash
# Claude mode uses scripts/sdd/run-role.sh --cc for dry-run composition and
# dispatches the loop with Claude-aware nested wrapper arguments.
# Cline mode uses scripts/sdd/run-role.sh --cline for dry-run composition and
# dispatches the loop with Cline-aware nested wrapper arguments.
# Path-scoped tool restrictions are not available at Claude Code or Cline CLI flag granularity.
# Any PLAN.md write prohibition is enforced by the included role prompt, not the CLI.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/sdd/orchestrator.sh --spec <path> --plan <path> [options]

Options:
  --spec <path>                 Approved spec file for the workstream.
  --spec-slice <dir>            Optional slice directory. When present, pass it
                                through to implementer/reviewer wrappers.
  --plan <path>                 Plan file storing task state and signals.
  --cc                          Use the Claude Code backend for dry-run composition
                                and nested role dispatch. Incompatible with
                                --sandbox, --reasoning-effort, --profile, --json,
                                and --ephemeral.
  --cline                       Use the Cline backend for dry-run composition and
                                nested role dispatch. Incompatible with --sandbox,
                                --reasoning-effort, --profile, --json, --ephemeral,
                                and --effort.
  --sandbox <mode>              Pass through to nested role wrappers. Not valid with --cc
                                or --cline.
  --output-last-message <path>  Write the orchestrator summary there.
  --model <name>                Pass through to nested role wrappers.
  --reasoning-effort <level>    Base reasoning effort. Default: high. Not valid with --cc
                                or --cline.
  --effort <level>              Base Claude reasoning effort. Requires --cc.
                                Default with --cc: high.
  --profile <name>              Pass through to nested role wrappers. Not valid with --cc
                                or --cline.
  --json                        Pass through to nested role wrappers. Not valid with --cc
                                or --cline.
  --ephemeral                   Pass through to nested role wrappers. Not valid with --cc
                                or --cline.
  --dry-run                     Compose the tracked role prompt and exit.
  --help                        Show this message.
EOF
}

usage_error() {
  echo "$1" >&2
  usage >&2
  exit 1
}

require_option_value() {
  local option_name="$1"
  local option_value="${2-}"

  if [[ -z "${option_value}" || "${option_value}" == --* ]]; then
    usage_error "${option_name} requires a value"
  fi
}

resolve_existing_path() {
  local input_path="$1"

  if command -v realpath >/dev/null 2>&1; then
    realpath "${input_path}"
    return
  fi

  if command -v readlink >/dev/null 2>&1; then
    readlink -f "${input_path}"
    return
  fi

  usage_error "orchestrator.sh requires realpath or readlink -f to resolve paths"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
# shellcheck source=../lib/project-config.sh
source "${SCRIPT_DIR}/../lib/project-config.sh"
REPO_ROOT="${APP_REPO_ROOT}"
RUN_ROLE_SCRIPT="${SCRIPT_DIR}/run-role.sh"
LOOP_RUNNER="${SCRIPT_DIR}/orchestrator-loop.js"

SPEC_PATH=""
SPEC_SLICE_PATH=""
PLAN_PATH=""
CC=false
CLINE=false

# Named passthrough variables (validated post-parse)
SANDBOX=""
OUTPUT_LAST_MESSAGE=""
MODEL=""
REASONING_EFFORT=""
EFFORT=""
PROFILE=""
JSON=false
EPHEMERAL=false
DRY_RUN=false
CC_DEFAULT_EFFORT="high"

while (($# > 0)); do
  case "$1" in
    --spec)
      require_option_value "$1" "${2-}"
      SPEC_PATH="$2"
      shift 2
      continue
      ;;
    --plan)
      require_option_value "$1" "${2-}"
      PLAN_PATH="$2"
      shift 2
      continue
      ;;
    --spec-slice)
      require_option_value "$1" "${2-}"
      SPEC_SLICE_PATH="$2"
      shift 2
      continue
      ;;
    --cc)
      CC=true
      shift
      continue
      ;;
    --cline)
      CLINE=true
      shift
      continue
      ;;
    --sandbox)
      require_option_value "$1" "${2-}"
      SANDBOX="$2"
      shift 2
      continue
      ;;
    --output-last-message)
      require_option_value "$1" "${2-}"
      OUTPUT_LAST_MESSAGE="$2"
      shift 2
      continue
      ;;
    --model)
      require_option_value "$1" "${2-}"
      MODEL="$2"
      shift 2
      continue
      ;;
    --reasoning-effort)
      require_option_value "$1" "${2-}"
      REASONING_EFFORT="$2"
      shift 2
      continue
      ;;
    --effort)
      require_option_value "$1" "${2-}"
      EFFORT="$2"
      shift 2
      continue
      ;;
    --profile)
      require_option_value "$1" "${2-}"
      PROFILE="$2"
      shift 2
      continue
      ;;
    --json)
      JSON=true
      shift
      continue
      ;;
    --ephemeral)
      EPHEMERAL=true
      shift
      continue
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      continue
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      usage_error "Unknown argument: $1"
      ;;
  esac
done

if [[ -z "${SPEC_PATH}" ]]; then
  usage_error "--spec is required"
fi

if [[ -z "${PLAN_PATH}" ]]; then
  usage_error "--plan is required"
fi

# Three-way mutual exclusivity: --cc, --cline, or default (Codex)
if [[ "${CC}" == true && "${CLINE}" == true ]]; then
  usage_error "--cc and --cline are mutually exclusive"
fi

# Claude Code compatibility checks
if [[ "${CC}" == true ]]; then
  if [[ -n "${SANDBOX}" || -n "${REASONING_EFFORT}" || -n "${PROFILE}" || "${JSON}" == true || "${EPHEMERAL}" == true ]]; then
    usage_error "--sandbox, --reasoning-effort, --profile, --json, and --ephemeral are not compatible with --cc"
  fi
fi

# Cline compatibility checks
if [[ "${CLINE}" == true ]]; then
  if [[ -n "${SANDBOX}" || -n "${REASONING_EFFORT}" || -n "${PROFILE}" || "${JSON}" == true || "${EPHEMERAL}" == true ]]; then
    usage_error "--sandbox, --reasoning-effort, --profile, --json, and --ephemeral are not compatible with --cline"
  fi
  if [[ -n "${EFFORT}" ]]; then
    usage_error "--effort requires --cc, not --cline"
  fi
fi

# Default (Codex) compatibility checks
if [[ "${CC}" == false && "${CLINE}" == false ]]; then
  if [[ -n "${EFFORT}" ]]; then
    usage_error "--effort requires --cc"
  fi
fi

if [[ "${SPEC_PATH}" != /* ]]; then
  SPEC_PATH="${REPO_ROOT}/${SPEC_PATH#./}"
fi

SPEC_PATH="$(resolve_existing_path "${SPEC_PATH}")"

if [[ ! -f "${SPEC_PATH}" ]]; then
  usage_error "Spec file not found: ${SPEC_PATH}"
fi

if [[ -n "${SPEC_SLICE_PATH}" ]]; then
  if [[ "${SPEC_SLICE_PATH}" != /* ]]; then
    SPEC_SLICE_PATH="${REPO_ROOT}/${SPEC_SLICE_PATH#./}"
  fi

  SPEC_SLICE_PATH="$(resolve_existing_path "${SPEC_SLICE_PATH}")"

  if [[ ! -d "${SPEC_SLICE_PATH}" ]]; then
    usage_error "Spec slice directory not found: ${SPEC_SLICE_PATH}"
  fi
fi

if [[ "${PLAN_PATH}" != /* ]]; then
  PLAN_PATH="${REPO_ROOT}/${PLAN_PATH#./}"
fi

PLAN_PATH="$(resolve_existing_path "${PLAN_PATH}")"

if [[ ! -f "${PLAN_PATH}" ]]; then
  usage_error "Plan file not found: ${PLAN_PATH}"
fi

ROLE_ARGS=()
LOOP_ARGS=()
DRY_RUN_PARAMS=()

if [[ "${CC}" == true ]]; then
  ROLE_ARGS+=("--cc")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && ROLE_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
  [[ -n "${MODEL}" ]] && ROLE_ARGS+=("--model" "${MODEL}")
  ROLE_ARGS+=("--effort" "${EFFORT:-${CC_DEFAULT_EFFORT}}")
  [[ "${DRY_RUN}" == true ]] && ROLE_ARGS+=("--dry-run")

  LOOP_ARGS+=("--cc")
  [[ -n "${SPEC_SLICE_PATH}" ]] && LOOP_ARGS+=("--spec-slice" "${SPEC_SLICE_PATH}")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && LOOP_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
  [[ -n "${MODEL}" ]] && LOOP_ARGS+=("--model" "${MODEL}")
  LOOP_ARGS+=("--effort" "${EFFORT:-${CC_DEFAULT_EFFORT}}")
elif [[ "${CLINE}" == true ]]; then
  ROLE_ARGS+=("--cline")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && ROLE_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
  [[ "${DRY_RUN}" == true ]] && ROLE_ARGS+=("--dry-run")

  LOOP_ARGS+=("--cline")
  [[ -n "${SPEC_SLICE_PATH}" ]] && LOOP_ARGS+=("--spec-slice" "${SPEC_SLICE_PATH}")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && LOOP_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
else
  [[ -n "${SANDBOX}" ]] && ROLE_ARGS+=("--sandbox" "${SANDBOX}")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && ROLE_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
  [[ -n "${MODEL}" ]] && ROLE_ARGS+=("--model" "${MODEL}")
  [[ -n "${REASONING_EFFORT}" ]] && ROLE_ARGS+=("--reasoning-effort" "${REASONING_EFFORT}")
  [[ -n "${PROFILE}" ]] && ROLE_ARGS+=("--profile" "${PROFILE}")
  [[ "${JSON}" == true ]] && ROLE_ARGS+=("--json")
  [[ "${EPHEMERAL}" == true ]] && ROLE_ARGS+=("--ephemeral")
  [[ "${DRY_RUN}" == true ]] && ROLE_ARGS+=("--dry-run")

  [[ -n "${SPEC_SLICE_PATH}" ]] && LOOP_ARGS+=("--spec-slice" "${SPEC_SLICE_PATH}")
  [[ -n "${SANDBOX}" ]] && LOOP_ARGS+=("--sandbox" "${SANDBOX}")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && LOOP_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
  [[ -n "${MODEL}" ]] && LOOP_ARGS+=("--model" "${MODEL}")
  [[ -n "${REASONING_EFFORT}" ]] && LOOP_ARGS+=("--reasoning-effort" "${REASONING_EFFORT}")
  [[ -n "${PROFILE}" ]] && LOOP_ARGS+=("--profile" "${PROFILE}")
  [[ "${JSON}" == true ]] && LOOP_ARGS+=("--json")
  [[ "${EPHEMERAL}" == true ]] && LOOP_ARGS+=("--ephemeral")
fi

if [[ "${DRY_RUN}" == true ]]; then
  DRY_RUN_PARAMS=(
    --param "spec_path=${SPEC_PATH#${REPO_ROOT}/}"
    --param "plan_path=${PLAN_PATH#${REPO_ROOT}/}"
    --param "guidance_path=${APP_PM_GUIDANCE_PATH_REL}"
  )

  if [[ -n "${SPEC_SLICE_PATH}" ]]; then
    DRY_RUN_PARAMS+=(--param "spec_slice_path=${SPEC_SLICE_PATH#${REPO_ROOT}/}")
  fi

  "${RUN_ROLE_SCRIPT}" \
  --prompt "${APP_SDD_DOCS_DIR_REL}/orchestrator.md" \
  "${ROLE_ARGS[@]}" \
  "${DRY_RUN_PARAMS[@]}"
  exit 0
fi

# Load .env so pipeline scripts inherit ANTHROPIC_API_KEY and other env vars
if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.env"
  set +a
fi

exec node "${LOOP_RUNNER}" \
  --repo-root "${REPO_ROOT}" \
  --spec "${SPEC_PATH}" \
  --plan "${PLAN_PATH}" \
  "${LOOP_ARGS[@]}"
