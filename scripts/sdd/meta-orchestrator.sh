#!/usr/bin/env bash
# Meta-orchestrator: repeatedly invokes orchestrator.sh until no autonomous work
# remains. Blocked or failed tasks are noted and skipped; dependent tasks that
# cannot proceed are identified in the final summary.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/sdd/meta-orchestrator.sh --spec <path> --plan <path> [options]

Options:
  --spec <path>                 Approved spec file for the workstream.
  --spec-slice <dir>            Optional slice directory (passthrough).
  --plan <path>                 Plan file storing task state and signals.
  --milestone <id>              Optional worktree milestone label (for example
                                M2). Defaults to spec/plan-derived milestone.
  --cc                          Use the Claude Code backend (passthrough).
                                Incompatible with --cline, --sandbox,
                                --reasoning-effort.
  --cline                       Use the Cline backend (passthrough).
                                Incompatible with --cc, --sandbox,
                                --reasoning-effort, --effort.
  --sandbox <mode>              Sandbox mode (passthrough). Not valid with
                                --cc or --cline.
  --model <name>                Model name (passthrough).
  --effort <level>              Claude reasoning effort, requires --cc
                                (passthrough). Default with --cc: high.
  --reasoning-effort <level>    Base reasoning effort (passthrough). Not valid
                                with --cc or --cline.
  --profile <name>              Profile name (passthrough). Not valid with
                                --cc or --cline.
  --json                        JSON output (passthrough). Not valid with
                                --cc or --cline.
  --ephemeral                   Ephemeral mode (passthrough). Not valid with
                                --cc or --cline.
  --max-iterations <N>          Max orchestrator invocations. Default: 50.
  --max-retries <N>             Max retries per task on execution error.
                                Default: 2.
  --delay <seconds>             Delay between iterations. Default: 5.
  --dry-run                     Simulate dispatch order without executing.
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

validate_integer_option() {
  local option_name="$1"
  local option_value="$2"
  local minimum="$3"

  if [[ ! "${option_value}" =~ ^[0-9]+$ ]]; then
    usage_error "${option_name} must be an integer >= ${minimum}"
  fi

  if (( option_value < minimum )); then
    usage_error "${option_name} must be an integer >= ${minimum}"
  fi
}

validate_number_option() {
  local option_name="$1"
  local option_value="$2"
  local minimum="$3"

  if [[ ! "${option_value}" =~ ^([0-9]+([.][0-9]+)?|[.][0-9]+)$ ]]; then
    usage_error "${option_name} must be a number >= ${minimum}"
  fi

  if ! awk -v value="${option_value}" -v minimum="${minimum}" 'BEGIN { exit !(value >= minimum) }'; then
    usage_error "${option_name} must be a number >= ${minimum}"
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

  usage_error "meta-orchestrator.sh requires realpath or readlink -f to resolve paths"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
# shellcheck source=../lib/project-config.sh
source "${SCRIPT_DIR}/../lib/project-config.sh"
REPO_ROOT="${APP_REPO_ROOT}"
META_RUNNER="${SCRIPT_DIR}/meta-orchestrator.js"

SPEC_PATH=""
PLAN_PATH=""
SPEC_SLICE_PATH=""
MILESTONE=""
CC=false
CLINE=false
SANDBOX=""
MODEL=""
REASONING_EFFORT=""
EFFORT=""
PROFILE=""
JSON=false
EPHEMERAL=false
MAX_ITERATIONS=""
MAX_RETRIES=""
DELAY=""
DRY_RUN=false

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
    --milestone)
      require_option_value "$1" "${2-}"
      MILESTONE="$2"
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
    --max-iterations)
      require_option_value "$1" "${2-}"
      MAX_ITERATIONS="$2"
      shift 2
      continue
      ;;
    --max-retries)
      require_option_value "$1" "${2-}"
      MAX_RETRIES="$2"
      shift 2
      continue
      ;;
    --delay)
      require_option_value "$1" "${2-}"
      DELAY="$2"
      shift 2
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

if [[ "${CC}" == true && "${CLINE}" == true ]]; then
  usage_error "--cc and --cline are mutually exclusive"
fi

if [[ "${CC}" == true ]]; then
  if [[ -n "${SANDBOX}" || -n "${REASONING_EFFORT}" || -n "${PROFILE}" || "${JSON}" == true || "${EPHEMERAL}" == true ]]; then
    usage_error "--sandbox, --reasoning-effort, --profile, --json, and --ephemeral are not compatible with --cc"
  fi
fi

if [[ "${CLINE}" == true ]]; then
  if [[ -n "${SANDBOX}" || -n "${REASONING_EFFORT}" || -n "${PROFILE}" || "${JSON}" == true || "${EPHEMERAL}" == true || -n "${EFFORT}" ]]; then
    usage_error "--sandbox, --reasoning-effort, --profile, --json, --ephemeral, and --effort are not compatible with --cline"
  fi
fi

if [[ "${CC}" == false && "${CLINE}" == false && -n "${EFFORT}" ]]; then
  usage_error "--effort requires --cc"
fi

if [[ -n "${MAX_ITERATIONS}" ]]; then
  validate_integer_option "--max-iterations" "${MAX_ITERATIONS}" 1
fi

if [[ -n "${MAX_RETRIES}" ]]; then
  validate_integer_option "--max-retries" "${MAX_RETRIES}" 0
fi

if [[ -n "${DELAY}" ]]; then
  validate_number_option "--delay" "${DELAY}" 0
fi

if [[ "${SPEC_PATH}" != /* ]]; then
  SPEC_PATH="${REPO_ROOT}/${SPEC_PATH#./}"
fi
SPEC_PATH="$(resolve_existing_path "${SPEC_PATH}")"
[[ -f "${SPEC_PATH}" ]] || usage_error "Spec file not found: ${SPEC_PATH}"

if [[ "${PLAN_PATH}" != /* ]]; then
  PLAN_PATH="${REPO_ROOT}/${PLAN_PATH#./}"
fi
PLAN_PATH="$(resolve_existing_path "${PLAN_PATH}")"
[[ -f "${PLAN_PATH}" ]] || usage_error "Plan file not found: ${PLAN_PATH}"

if [[ -n "${SPEC_SLICE_PATH}" ]]; then
  if [[ "${SPEC_SLICE_PATH}" != /* ]]; then
    SPEC_SLICE_PATH="${REPO_ROOT}/${SPEC_SLICE_PATH#./}"
  fi
  SPEC_SLICE_PATH="$(resolve_existing_path "${SPEC_SLICE_PATH}")"
  [[ -d "${SPEC_SLICE_PATH}" ]] || usage_error "Spec slice directory not found: ${SPEC_SLICE_PATH}"
fi

ARGS=(
  "${META_RUNNER}"
  "--repo-root" "${REPO_ROOT}"
  "--spec" "${SPEC_PATH}"
  "--plan" "${PLAN_PATH}"
)

if [[ -n "${SPEC_SLICE_PATH}" ]]; then
  ARGS+=("--spec-slice" "${SPEC_SLICE_PATH}")
fi

if [[ -n "${MILESTONE}" ]]; then
  ARGS+=("--milestone" "${MILESTONE}")
fi

if [[ "${CC}" == true ]]; then
  ARGS+=("--cc")
elif [[ "${CLINE}" == true ]]; then
  ARGS+=("--cline")
fi

[[ -n "${SANDBOX}" ]] && ARGS+=("--sandbox" "${SANDBOX}")
[[ -n "${MODEL}" ]] && ARGS+=("--model" "${MODEL}")

if [[ "${CC}" == true ]]; then
  [[ -n "${EFFORT}" ]] && ARGS+=("--effort" "${EFFORT}")
else
  [[ -n "${REASONING_EFFORT}" ]] && ARGS+=("--reasoning-effort" "${REASONING_EFFORT}")
fi

[[ -n "${PROFILE}" ]] && ARGS+=("--profile" "${PROFILE}")
[[ "${JSON}" == true ]] && ARGS+=("--json")
[[ "${EPHEMERAL}" == true ]] && ARGS+=("--ephemeral")
[[ -n "${MAX_ITERATIONS}" ]] && ARGS+=("--max-iterations" "${MAX_ITERATIONS}")
[[ -n "${MAX_RETRIES}" ]] && ARGS+=("--max-retries" "${MAX_RETRIES}")
[[ -n "${DELAY}" ]] && ARGS+=("--delay" "${DELAY}")
[[ "${DRY_RUN}" == true ]] && ARGS+=("--dry-run")

exec node "${ARGS[@]}"
