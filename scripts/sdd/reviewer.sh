#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/sdd/reviewer.sh --task <TASK-NN> --spec <path> --cycle <n> --diff <path> [options]

Options:
  --task <TASK-NN>              Assigned task ID.
  --spec <path>                 Approved spec file for the task.
  --spec-slice <dir>            Optional slice directory. When present, inject spec
                                universal + task slice files instead of the full spec.
  --epoch <n>                   Optional escalation epoch. Default: 1.
  --cycle <n>                   Review cycle number.
  --diff <path>                 Implementer diff artifact to audit.
  --prior-verdict <path>        Optional prior-cycle verdict in the same epoch.
  --verdict-output <path>       Optional explicit verdict output path.
  --cc                          Use the Claude Code backend via scripts/sdd/run-role.sh.
                                Defaults to --effort medium. Incompatible with --sandbox,
                                --reasoning-effort, --profile, --json, --ephemeral.
  --cline                       Use the Cline backend via scripts/sdd/run-role.sh.
                                Incompatible with --sandbox, --reasoning-effort, --profile,
                                --json, --ephemeral, and --effort.
  --sandbox <mode>              Pass through to scripts/sdd/run-role.sh. Not valid with --cc
                                or --cline.
  --output-last-message <path>  Pass through to the run-role script.
  --model <name>                Pass through to the run-role script.
  --reasoning-effort <level>    Pass through to scripts/sdd/run-role.sh. Not valid with --cc
                                or --cline.
  --effort <level>              Pass through to scripts/sdd/run-role.sh. Requires
                                --cc. Default with --cc: medium.
  --profile <name>              Pass through to scripts/sdd/run-role.sh. Not valid with --cc
                                or --cline.
  --json                        Pass through to scripts/sdd/run-role.sh. Not valid with --cc
                                or --cline.
  --ephemeral                   Pass through to scripts/sdd/run-role.sh. Not valid with --cc
                                or --cline.
  --instruction <comment>       Optional operator note providing added focus or
                                constraint for this invocation.
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

  usage_error "reviewer.sh requires realpath or readlink -f to resolve paths"
}

resolve_path_maybe_missing() {
  local input_path="$1"

  if command -v realpath >/dev/null 2>&1; then
    realpath -m "${input_path}"
    return
  fi

  if command -v readlink >/dev/null 2>&1; then
    readlink -m "${input_path}"
    return
  fi

  usage_error "reviewer.sh requires realpath or readlink -m to resolve paths"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
# shellcheck source=../lib/project-config.sh
source "${SCRIPT_DIR}/../lib/project-config.sh"
REPO_ROOT="${APP_REPO_ROOT}"

TASK_ID=""
SPEC_PATH=""
SPEC_SLICE_PATH=""
EPOCH="1"
CYCLE=""
DIFF_PATH=""
PRIOR_VERDICT_PATH=""
  VERDICT_OUTPUT_PATH=""
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
INSTRUCTION=""
CC_DEFAULT_EFFORT="medium"

while (($# > 0)); do
  case "$1" in
    --task)
      require_option_value "$1" "${2-}"
      TASK_ID="$2"
      shift 2
      continue
      ;;
    --spec)
      require_option_value "$1" "${2-}"
      SPEC_PATH="$2"
      shift 2
      continue
      ;;
    --spec-slice)
      require_option_value "$1" "${2-}"
      SPEC_SLICE_PATH="$2"
      shift 2
      continue
      ;;
    --epoch)
      require_option_value "$1" "${2-}"
      EPOCH="$2"
      shift 2
      continue
      ;;
    --cycle)
      require_option_value "$1" "${2-}"
      CYCLE="$2"
      shift 2
      continue
      ;;
    --diff)
      require_option_value "$1" "${2-}"
      DIFF_PATH="$2"
      shift 2
      continue
      ;;
    --prior-verdict)
      require_option_value "$1" "${2-}"
      PRIOR_VERDICT_PATH="$2"
      shift 2
      continue
      ;;
    --verdict-output)
      require_option_value "$1" "${2-}"
      VERDICT_OUTPUT_PATH="$2"
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
    --instruction)
      require_option_value "$1" "${2-}"
      INSTRUCTION="$2"
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

if [[ -z "${TASK_ID}" ]]; then
  usage_error "--task is required"
fi

if [[ -z "${SPEC_PATH}" ]]; then
  usage_error "--spec is required"
fi

if [[ -z "${CYCLE}" ]]; then
  usage_error "--cycle is required"
fi

if [[ -z "${DIFF_PATH}" ]]; then
  usage_error "--diff is required"
fi

if [[ ! "${TASK_ID}" =~ ^TASK-[0-9A-Za-z]+$ ]]; then
  usage_error "Invalid task ID: ${TASK_ID}"
fi

if [[ ! "${EPOCH}" =~ ^[1-9][0-9]*$ ]]; then
  usage_error "Invalid epoch value: ${EPOCH}"
fi

if [[ ! "${CYCLE}" =~ ^[1-9][0-9]*$ ]]; then
  usage_error "Invalid cycle value: ${CYCLE}"
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

SPEC_UNIVERSAL_PATH=""
SPEC_TASK_SLICE_PATH=""

if [[ -n "${SPEC_SLICE_PATH}" ]]; then
  if [[ "${SPEC_SLICE_PATH}" != /* ]]; then
    SPEC_SLICE_PATH="${REPO_ROOT}/${SPEC_SLICE_PATH#./}"
  fi

  SPEC_SLICE_PATH="$(resolve_path_maybe_missing "${SPEC_SLICE_PATH}")"

  if [[ ! -d "${SPEC_SLICE_PATH}" ]]; then
    usage_error "Spec slice directory not found: ${SPEC_SLICE_PATH}"
  fi

  SPEC_FILENAME="$(basename "${SPEC_PATH}")"
  SPEC_BASENAME="${SPEC_FILENAME%.*}"

  SPEC_UNIVERSAL_PATH="${SPEC_SLICE_PATH%/}/${SPEC_BASENAME}-universal.md"

  if [[ ! -f "${SPEC_UNIVERSAL_PATH}" ]]; then
    usage_error "Spec universal file not found: ${SPEC_UNIVERSAL_PATH}"
  fi

  SPEC_TASK_SLICE_PATH="${SPEC_SLICE_PATH%/}/${SPEC_BASENAME}-slice-${TASK_ID}.md"

  if [[ ! -f "${SPEC_TASK_SLICE_PATH}" ]]; then
    usage_error "Spec task slice file not found: ${SPEC_TASK_SLICE_PATH}"
  fi

  SPEC_UNIVERSAL_PATH="$(resolve_existing_path "${SPEC_UNIVERSAL_PATH}")"
  SPEC_TASK_SLICE_PATH="$(resolve_existing_path "${SPEC_TASK_SLICE_PATH}")"
fi

if [[ "${DIFF_PATH}" != /* ]]; then
  DIFF_PATH="${REPO_ROOT}/${DIFF_PATH#./}"
fi

DIFF_PATH="$(resolve_existing_path "${DIFF_PATH}")"

if [[ ! -f "${DIFF_PATH}" ]]; then
  usage_error "Diff file not found: ${DIFF_PATH}"
fi

if [[ -n "${PRIOR_VERDICT_PATH}" ]]; then
  if [[ "${PRIOR_VERDICT_PATH}" != /* ]]; then
    PRIOR_VERDICT_PATH="${REPO_ROOT}/${PRIOR_VERDICT_PATH#./}"
  fi

  PRIOR_VERDICT_PATH="$(resolve_existing_path "${PRIOR_VERDICT_PATH}")"

  if [[ ! -f "${PRIOR_VERDICT_PATH}" ]]; then
    usage_error "Prior verdict file not found: ${PRIOR_VERDICT_PATH}"
  fi
fi

if [[ -z "${VERDICT_OUTPUT_PATH}" ]]; then
  VERDICT_OUTPUT_PATH="${APP_SDD_DOCS_DIR_REL}/reviews/${TASK_ID}-epoch-${EPOCH}-cycle-${CYCLE}.md"
fi

if [[ "${VERDICT_OUTPUT_PATH}" != /* ]]; then
  VERDICT_OUTPUT_PATH="${REPO_ROOT}/${VERDICT_OUTPUT_PATH#./}"
fi

VERDICT_OUTPUT_DIR="$(dirname "${VERDICT_OUTPUT_PATH}")"
mkdir -p "${VERDICT_OUTPUT_DIR}"

if command -v realpath >/dev/null 2>&1; then
  VERDICT_OUTPUT_PATH="$(realpath -m "${VERDICT_OUTPUT_PATH}")"
elif command -v readlink >/dev/null 2>&1; then
  VERDICT_OUTPUT_PATH="$(readlink -m "${VERDICT_OUTPUT_PATH}")"
else
  usage_error "reviewer.sh requires realpath or readlink -m to resolve verdict paths"
fi

# Build passthrough args after all validation
PASSTHROUGH_ARGS=()
RUN_ROLE_SCRIPT="${SCRIPT_DIR}/run-role.sh"

if [[ "${CC}" == true ]]; then
  PASSTHROUGH_ARGS+=("--cc")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && PASSTHROUGH_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
  [[ -n "${MODEL}" ]] && PASSTHROUGH_ARGS+=("--model" "${MODEL}")
  PASSTHROUGH_ARGS+=("--effort" "${EFFORT:-${CC_DEFAULT_EFFORT}}")
  [[ "${DRY_RUN}" == true ]] && PASSTHROUGH_ARGS+=("--dry-run")
elif [[ "${CLINE}" == true ]]; then
  PASSTHROUGH_ARGS+=("--cline")
  [[ -n "${OUTPUT_LAST_MESSAGE}" ]] && PASSTHROUGH_ARGS+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
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

RUN_ROLE_ARGS=(
  --prompt "${APP_SDD_DOCS_DIR_REL}/reviewer.md"
  "${PASSTHROUGH_ARGS[@]}"
  --param "task_id=${TASK_ID}"
  --param "epoch=${EPOCH}"
  --param "cycle=${CYCLE}"
  --param "guidance_path=${APP_PM_GUIDANCE_PATH_REL}"
  --param "diff_path=$(project_config_repo_relative_path "${DIFF_PATH}")"
  --param "verdict_output_path=$(project_config_repo_relative_path "${VERDICT_OUTPUT_PATH}")"
)

if [[ -n "${SPEC_SLICE_PATH}" ]]; then
  RUN_ROLE_ARGS+=(
    --param "spec_universal_path=$(project_config_repo_relative_path "${SPEC_UNIVERSAL_PATH}")"
    --param "spec_task_slice_path=$(project_config_repo_relative_path "${SPEC_TASK_SLICE_PATH}")"
  )
else
  RUN_ROLE_ARGS+=(--param "spec_path=$(project_config_repo_relative_path "${SPEC_PATH}")")
fi

if [[ -n "${PRIOR_VERDICT_PATH}" ]]; then
  RUN_ROLE_ARGS+=(--param "prior_verdict_path=$(project_config_repo_relative_path "${PRIOR_VERDICT_PATH}")")
fi

if [[ -n "${INSTRUCTION}" ]]; then
  RUN_ROLE_ARGS+=(--param "instruction=${INSTRUCTION}")
fi

"${RUN_ROLE_SCRIPT}" "${RUN_ROLE_ARGS[@]}"
