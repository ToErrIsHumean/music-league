#!/usr/bin/env bash
# Claude mode uses scripts/sdd/run-role.sh --cc under the same planner entrypoint.
# Path-scoped tool restrictions are not available at Claude Code CLI flag granularity.
# Any PLAN.md write prohibition is enforced by the included role prompt, not the CLI.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/sdd/planner.sh --spec <path> [options]

Options:
  --spec <path>                 Approved spec file to plan from.
  --plan <path>                 Optional plan output path. Default derives from the spec name.
  --cc                          Use the Claude Code backend via scripts/sdd/run-role.sh.
                                Incompatible with --sandbox, --reasoning-effort,
                                --profile, --json, and --ephemeral.
  --sandbox <mode>              Pass through to scripts/sdd/run-role.sh. Not valid with --cc.
  --output-last-message <path>  Pass through to the run-role script.
  --model <name>                Pass through to the run-role script.
  --reasoning-effort <level>    Pass through to scripts/sdd/run-role.sh. Not valid with --cc.
  --effort <level>              Pass through to scripts/sdd/run-role.sh. Requires
                                --cc. Default with --cc: high.
  --profile <name>              Pass through to scripts/sdd/run-role.sh. Not valid with --cc.
  --json                        Pass through to scripts/sdd/run-role.sh. Not valid with --cc.
  --ephemeral                   Pass through to scripts/sdd/run-role.sh. Not valid with --cc.
  --dry-run                     Pass through to the run-role script.
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

  usage_error "planner.sh requires realpath or readlink -f to resolve paths"
}

resolve_output_path() {
  local input_path="$1"

  if command -v realpath >/dev/null 2>&1; then
    realpath -m "${input_path}"
    return
  fi

  if command -v readlink >/dev/null 2>&1; then
    local parent_dir
    parent_dir="$(dirname "${input_path}")"
    local basename_path
    basename_path="$(basename "${input_path}")"
    if [[ ! -d "${parent_dir}" ]]; then
      usage_error "Plan output directory does not exist: ${parent_dir}"
    fi
    parent_dir="$(cd "${parent_dir}" && pwd -P)"
    printf '%s/%s\n' "${parent_dir}" "${basename_path}"
    return
  fi

  usage_error "planner.sh requires realpath or readlink -f to resolve paths"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
# shellcheck source=../lib/project-config.sh
source "${SCRIPT_DIR}/../lib/project-config.sh"
REPO_ROOT="${APP_REPO_ROOT}"
RUN_ROLE_SCRIPT="${SCRIPT_DIR}/run-role.sh"

SPEC_PATH=""
PLAN_PATH=""
CC=false

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
    --cc)
      CC=true
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

if [[ "${CC}" == true ]]; then
  if [[ -n "${SANDBOX}" || -n "${REASONING_EFFORT}" || -n "${PROFILE}" || "${JSON}" == true || "${EPHEMERAL}" == true ]]; then
    usage_error "--sandbox, --reasoning-effort, --profile, --json, and --ephemeral are not compatible with --cc"
  fi
else
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

if [[ -z "${PLAN_PATH}" ]]; then
  SPEC_BASENAME="$(basename "${SPEC_PATH}")"

  if [[ "${SPEC_BASENAME}" =~ ^SPEC-([0-9]+)-(.*)\.md$ ]]; then
    PLAN_PATH="${REPO_ROOT}/docs/specs/PLAN-${BASH_REMATCH[1]}-${BASH_REMATCH[2]}.md"
  else
    usage_error "Unable to derive plan path from spec filename: ${SPEC_BASENAME}"
  fi
elif [[ "${PLAN_PATH}" != /* ]]; then
  PLAN_PATH="${REPO_ROOT}/${PLAN_PATH#./}"
fi

PLAN_PATH="$(resolve_output_path "${PLAN_PATH}")"

PASSTHROUGH_ARGS=()

if [[ "${CC}" == true ]]; then
  PASSTHROUGH_ARGS+=("--cc")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && PASSTHROUGH_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
  [[ -n "${MODEL}" ]] && PASSTHROUGH_ARGS+=("--model" "${MODEL}")
  PASSTHROUGH_ARGS+=("--effort" "${EFFORT:-${CC_DEFAULT_EFFORT}}")
  [[ "${DRY_RUN}" == true ]] && PASSTHROUGH_ARGS+=("--dry-run")
else
  [[ -n "${SANDBOX}" ]] && PASSTHROUGH_ARGS+=("--sandbox" "${SANDBOX}")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && PASSTHROUGH_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
  [[ -n "${MODEL}" ]] && PASSTHROUGH_ARGS+=("--model" "${MODEL}")
  [[ -n "${REASONING_EFFORT}" ]] && PASSTHROUGH_ARGS+=("--reasoning-effort" "${REASONING_EFFORT}")
  [[ -n "${PROFILE}" ]] && PASSTHROUGH_ARGS+=("--profile" "${PROFILE}")
  [[ "${JSON}" == true ]] && PASSTHROUGH_ARGS+=("--json")
  [[ "${EPHEMERAL}" == true ]] && PASSTHROUGH_ARGS+=("--ephemeral")
  [[ "${DRY_RUN}" == true ]] && PASSTHROUGH_ARGS+=("--dry-run")
fi

"${RUN_ROLE_SCRIPT}" \
  --prompt "${APP_SDD_DOCS_DIR_REL}/planner.md" \
  "${PASSTHROUGH_ARGS[@]}" \
  --param "spec_path=${SPEC_PATH#${REPO_ROOT}/}" \
  --param "plan_output_path=${PLAN_PATH#${REPO_ROOT}/}" \
  --param "guidance_path=${APP_PM_GUIDANCE_PATH_REL}"
