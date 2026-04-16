#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/sdd/run-role.sh --prompt <path> [options] --param key=value [--param key=value ...]

Options:
  --prompt <path>                Tracked role prompt under the configured SDD docs dir.
  --param <key=value>            Runtime parameter appended to the prompt.
  --workdir <path>               Working directory for the selected role backend.
                                 Default: this checkout's repo root.
  --cc                           Use the Claude Code backend instead of Codex.
                                 Incompatible with --sandbox, --reasoning-effort,
                                 --profile, --json, and --ephemeral.
  --cline                        Use the Cline backend instead of Codex.
                                 Incompatible with --sandbox, --reasoning-effort,
                                 --profile, --json, --ephemeral, and --effort.
  --sandbox <mode>               Codex sandbox mode. Default: danger-full-access.
  --output-last-message <path>   Save the agent's final message to a file.
  --model <name>                 Optional model override for the selected backend.
  --reasoning-effort <level>     Codex model reasoning effort. Default: high.
  --effort <level>               Claude reasoning effort. Default: high.
  --profile <name>               Optional Codex profile override.
  --json                         Pass through to codex exec.
  --ephemeral                    Pass through to codex exec.
  --dry-run                      Print the composed prompt and exit.
  --help                         Show this message.
EOF
}

fail() {
  echo "$1" >&2
  exit 1
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

resolve_path() {
  local input_path="$1"

  if command -v realpath >/dev/null 2>&1; then
    realpath "${input_path}"
    return
  fi

  if command -v readlink >/dev/null 2>&1; then
    readlink -f "${input_path}"
    return
  fi

  fail "run-role.sh requires realpath or readlink -f to resolve prompt paths"
}

sanitize_param_value() {
  local value="$1"
  value="${value//$'\r'/\\r}"
  value="${value//$'\n'/\\n}"
  printf '%s' "${value}"
}

resolve_codex_config_path() {
  local codex_home="${CODEX_HOME:-${HOME:-}/.codex}"
  printf '%s/config.toml\n' "${codex_home}"
}

read_codex_config_value() {
  local config_path="$1"
  local key_name="$2"
  local profile_name="${3-}"

  if [[ ! -f "${config_path}" ]]; then
    return 1
  fi

  awk \
    -v target_key="${key_name}" \
    -v target_profile="${profile_name}" \
    '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }

    function unquote(value) {
      value = trim(value)
      if (value ~ /^".*"$/) {
        sub(/^"/, "", value)
        sub(/"$/, "", value)
      }
      return value
    }

    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }

    /^\[/ {
      section = $0
      gsub(/^[[:space:]]*\[/, "", section)
      gsub(/\][[:space:]]*$/, "", section)
      next
    }

    {
      if ($0 !~ /^[[:space:]]*[A-Za-z0-9_.-]+[[:space:]]*=/) {
        next
      }

      key = $0
      sub(/=.*/, "", key)
      key = trim(key)

      if (key != target_key) {
        next
      }

      value = $0
      sub(/^[^=]*=/, "", value)

      if (target_profile != "") {
        if (section == "profiles." target_profile || section == "profile." target_profile) {
          print unquote(value)
          exit
        }
        next
      }

      if (section == "") {
        print unquote(value)
        exit
      }
    }
    ' "${config_path}"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
# shellcheck source=../lib/project-config.sh
source "${SCRIPT_DIR}/../lib/project-config.sh"
REPO_ROOT="${APP_REPO_ROOT}"
BOOTSTRAP_SCRIPT="${SCRIPT_DIR}/bootstrap.sh"
SDD_PROMPTS_DIR="$(resolve_path "${APP_SDD_DOCS_DIR_ABS}")"
CLAUDE_BIN="${CLAUDE_BIN:-${APP_CLAUDE_BIN}}"
CLAUDE_REASONING_FLAG="${CLAUDE_REASONING_FLAG:---effort}"
CLINE_BIN="${CLINE_BIN:-${APP_CLINE_BIN}}"

ROLE_PROMPT=""
ROLE_WORKDIR=""
USE_CLAUDE="0"
USE_CLINE="0"
SANDBOX_MODE="danger-full-access"
SANDBOX_EXPLICIT="0"
OUTPUT_LAST_MESSAGE=""
MODEL_NAME=""
REASONING_EFFORT="high"
REASONING_EFFORT_EXPLICIT="0"
EFFORT_LEVEL="high"
EFFORT_EXPLICIT="0"
PROFILE_NAME=""
DRY_RUN="0"
PARAMS=()
SANITIZED_PARAMS=()
CODEX_ARGS=()
CODEX_CONFIG_PATH="$(resolve_codex_config_path)"
RUNTIME_MODEL_NAME=""

while (($# > 0)); do
  case "$1" in
    --prompt)
      require_option_value "$1" "${2-}"
      ROLE_PROMPT="$2"
      shift 2
      continue
      ;;
    --param)
      require_option_value "$1" "${2-}"
      PARAMS+=("$2")
      shift 2
      continue
      ;;
    --workdir)
      require_option_value "$1" "${2-}"
      ROLE_WORKDIR="$2"
      shift 2
      continue
      ;;
    --cc)
      USE_CLAUDE="1"
      shift
      continue
      ;;
    --cline)
      USE_CLINE="1"
      shift
      continue
      ;;
    --sandbox)
      require_option_value "$1" "${2-}"
      SANDBOX_MODE="$2"
      SANDBOX_EXPLICIT="1"
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
      MODEL_NAME="$2"
      shift 2
      continue
      ;;
    --reasoning-effort)
      require_option_value "$1" "${2-}"
      REASONING_EFFORT="$2"
      REASONING_EFFORT_EXPLICIT="1"
      shift 2
      continue
      ;;
    --effort)
      require_option_value "$1" "${2-}"
      EFFORT_LEVEL="$2"
      EFFORT_EXPLICIT="1"
      shift 2
      continue
      ;;
    --profile)
      require_option_value "$1" "${2-}"
      PROFILE_NAME="$2"
      shift 2
      continue
      ;;
    --json)
      CODEX_ARGS+=("--json")
      shift
      continue
      ;;
    --ephemeral)
      CODEX_ARGS+=("--ephemeral")
      shift
      continue
      ;;
    --dry-run)
      DRY_RUN="1"
      shift
      continue
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${ROLE_PROMPT}" ]]; then
  usage_error "--prompt is required"
fi

# Three-way mutual exclusivity: --cc, --cline, or default (Codex)
if [[ "${USE_CLAUDE}" == "1" && "${USE_CLINE}" == "1" ]]; then
  usage_error "--cc and --cline are mutually exclusive"
fi

# Claude Code compatibility checks
if [[ "${USE_CLAUDE}" == "1" ]]; then
  if [[ "${SANDBOX_EXPLICIT}" == "1" || "${REASONING_EFFORT_EXPLICIT}" == "1" || -n "${PROFILE_NAME}" || ${#CODEX_ARGS[@]} -gt 0 ]]; then
    usage_error "--sandbox, --reasoning-effort, --profile, --json, and --ephemeral are not compatible with --cc"
  fi
else
  if [[ "${EFFORT_EXPLICIT}" == "1" ]]; then
    usage_error "--effort requires --cc"
  fi
fi

# Cline compatibility checks
if [[ "${USE_CLINE}" == "1" ]]; then
  if [[ "${SANDBOX_EXPLICIT}" == "1" || "${REASONING_EFFORT_EXPLICIT}" == "1" || -n "${PROFILE_NAME}" || ${#CODEX_ARGS[@]} -gt 0 ]]; then
    usage_error "--sandbox, --reasoning-effort, --profile, --json, and --ephemeral are not compatible with --cline"
  fi
  if [[ "${EFFORT_EXPLICIT}" == "1" ]]; then
    usage_error "--effort requires --cc, not --cline"
  fi
fi

if [[ "${ROLE_PROMPT}" != /* ]]; then
  ROLE_PROMPT="${REPO_ROOT}/${ROLE_PROMPT#./}"
fi

if [[ ! -f "${ROLE_PROMPT}" ]]; then
  fail "Prompt file not found: ${ROLE_PROMPT}"
fi

ROLE_PROMPT="$(resolve_path "${ROLE_PROMPT}")"

if [[ "${ROLE_PROMPT}" != "${SDD_PROMPTS_DIR}/"* ]]; then
  fail "Prompt file must live under ${SDD_PROMPTS_DIR}: ${ROLE_PROMPT}"
fi

ROLE_PROMPT_REL="${ROLE_PROMPT#${REPO_ROOT}/}"

if [[ -z "${ROLE_WORKDIR}" ]]; then
  ROLE_WORKDIR="${REPO_ROOT}"
else
  ROLE_WORKDIR="$(resolve_path "${ROLE_WORKDIR}")"
fi

if [[ ! -d "${ROLE_WORKDIR}" ]]; then
  fail "Role working directory not found: ${ROLE_WORKDIR}"
fi

if ! git -C "${REPO_ROOT}" ls-files --error-unmatch -- "${ROLE_PROMPT_REL}" >/dev/null 2>&1; then
  fail "Prompt file must be tracked by git: ${ROLE_PROMPT_REL}"
fi

if ((${#PARAMS[@]} == 0)); then
  fail "At least one --param key=value pair is required"
fi

for pair in "${PARAMS[@]}"; do
  if [[ "${pair}" != *=* ]]; then
    fail "Invalid --param value (expected key=value): ${pair}"
  fi

  key="${pair%%=*}"
  value="${pair#*=}"

  if [[ -z "${key}" ]]; then
    fail "Invalid --param key in: ${pair}"
  fi

  if [[ ! "${key}" =~ ^[A-Za-z][A-Za-z0-9_.-]*$ ]]; then
    fail "Invalid --param key '${key}'. Use letters, numbers, underscore, dot, or hyphen."
  fi

  case "${key}" in
    model_name|reasoning_effort)
      fail "Runtime parameter key '${key}' is reserved by scripts/sdd/run-role.sh"
      ;;
  esac

  SANITIZED_PARAMS+=("${key}=$(sanitize_param_value "${value}")")
done

TEMP_FILES=()

cleanup() {
  if ((${#TEMP_FILES[@]} == 0)); then
    return
  fi

  rm -f "${TEMP_FILES[@]}"
}

trap cleanup EXIT

if [[ "${USE_CLAUDE}" == "1" ]]; then
  if [[ ! "${EFFORT_LEVEL}" =~ ^[A-Za-z0-9._-]+$ ]]; then
    fail "Invalid --effort value '${EFFORT_LEVEL}'. Use letters, numbers, dot, underscore, or hyphen."
  fi

  RUNTIME_MODEL_NAME="${MODEL_NAME:-${CLAUDE_MODEL_NAME:-configured-default}}"

  USER_PROMPT_FILE="$(mktemp)"
  TEMP_FILES+=("${USER_PROMPT_FILE}")

  {
    printf '## Runtime Parameters\n'
    printf 'These values were injected by scripts/sdd/run-role.sh. Treat them as authoritative input.\n'
    for pair in "${SANITIZED_PARAMS[@]}"; do
      key="${pair%%=*}"
      value="${pair#*=}"
      printf -- '- %s: %s\n' "${key}" "${value}"
    done
    printf -- '- model_name: %s\n' "$(sanitize_param_value "${RUNTIME_MODEL_NAME}")"
    printf -- '- reasoning_effort: %s\n' "$(sanitize_param_value "${EFFORT_LEVEL}")"
    printf '\nDo not auto-discover role prompts from the working tree. The prompt above was included explicitly by the wrapper.\n'
  } > "${USER_PROMPT_FILE}"

  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '# System Prompt: %s\n\n' "${ROLE_PROMPT_REL}"
    cat "${ROLE_PROMPT}"
    printf '\n\n# User Prompt\n\n'
    cat "${USER_PROMPT_FILE}"
    exit 0
  fi

  "${BOOTSTRAP_SCRIPT}"

  CLAUDE_COMMAND=("${CLAUDE_BIN}" "--print" "--system-prompt" "$(cat "${ROLE_PROMPT}")")

  if [[ -n "${MODEL_NAME}" ]]; then
    CLAUDE_COMMAND+=("--model" "${MODEL_NAME}")
  fi

  if [[ -n "${CLAUDE_REASONING_FLAG}" ]]; then
    CLAUDE_COMMAND+=("${CLAUDE_REASONING_FLAG}" "${EFFORT_LEVEL}")
  fi

  USER_PROMPT_CONTENT="$(cat "${USER_PROMPT_FILE}")"

  if [[ -n "${OUTPUT_LAST_MESSAGE}" ]]; then
    if [[ "${OUTPUT_LAST_MESSAGE}" != /* ]]; then
      OUTPUT_LAST_MESSAGE="${REPO_ROOT}/${OUTPUT_LAST_MESSAGE#./}"
    fi
    mkdir -p "$(dirname "${OUTPUT_LAST_MESSAGE}")"
    (cd "${ROLE_WORKDIR}" && "${CLAUDE_COMMAND[@]}" "${USER_PROMPT_CONTENT}") | tee "${OUTPUT_LAST_MESSAGE}"
    exit "${PIPESTATUS[0]}"
  fi

  cd "${ROLE_WORKDIR}" && "${CLAUDE_COMMAND[@]}" "${USER_PROMPT_CONTENT}"
  exit $?
fi

if [[ "${USE_CLINE}" == "1" ]]; then
  RUNTIME_MODEL_NAME="${MODEL_NAME:-${CLINE_MODEL_NAME:-configured-default}}"

  USER_PROMPT_FILE="$(mktemp)"
  TEMP_FILES+=("${USER_PROMPT_FILE}")

  {
    printf '## Runtime Parameters\n'
    printf 'These values were injected by scripts/sdd/run-role.sh. Treat them as authoritative input.\n'
    for pair in "${SANITIZED_PARAMS[@]}"; do
      key="${pair%%=*}"
      value="${pair#*=}"
      printf -- '- %s: %s\n' "${key}" "${value}"
    done
    printf -- '- model_name: %s\n' "$(sanitize_param_value "${RUNTIME_MODEL_NAME}")"
    printf '\nDo not auto-discover role prompts from the working tree. The prompt above was included explicitly by the wrapper.\n'
  } > "${USER_PROMPT_FILE}"

  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '# Cline invocation (dry-run):\n'
    printf '  cat "%s" | %s "$(cat %s)" --act -y 2>&1\n' \
      "${ROLE_PROMPT_REL}" "${CLINE_BIN}" "${USER_PROMPT_FILE}"
    printf '# (working directory: %s)\n' "${ROLE_WORKDIR}"
    exit 0
  fi

  "${BOOTSTRAP_SCRIPT}"

  if [[ -n "${OUTPUT_LAST_MESSAGE}" ]]; then
    if [[ "${OUTPUT_LAST_MESSAGE}" != /* ]]; then
      OUTPUT_LAST_MESSAGE="${REPO_ROOT}/${OUTPUT_LAST_MESSAGE#./}"
    fi
    mkdir -p "$(dirname "${OUTPUT_LAST_MESSAGE}")"
    (cd "${ROLE_WORKDIR}" && cat "${ROLE_PROMPT}" | "${CLINE_BIN}" "$(cat "${USER_PROMPT_FILE}")" --act -y 2>&1) | tee "${OUTPUT_LAST_MESSAGE}"
    exit "${PIPESTATUS[0]}"
  fi

  cd "${ROLE_WORKDIR}" && cat "${ROLE_PROMPT}" | "${CLINE_BIN}" "$(cat "${USER_PROMPT_FILE}")" --act -y 2>&1
  exit $?
fi

if [[ ! "${REASONING_EFFORT}" =~ ^[A-Za-z0-9._-]+$ ]]; then
  fail "Invalid --reasoning-effort value '${REASONING_EFFORT}'. Use letters, numbers, dot, underscore, or hyphen."
fi

if [[ -n "${MODEL_NAME}" ]]; then
  RUNTIME_MODEL_NAME="${MODEL_NAME}"
elif [[ -n "${PROFILE_NAME}" ]]; then
  RUNTIME_MODEL_NAME="$(read_codex_config_value "${CODEX_CONFIG_PATH}" "model" "${PROFILE_NAME}" || true)"
fi

if [[ -z "${RUNTIME_MODEL_NAME}" ]]; then
  RUNTIME_MODEL_NAME="$(read_codex_config_value "${CODEX_CONFIG_PATH}" "model" || true)"
fi

if [[ -z "${RUNTIME_MODEL_NAME}" ]]; then
  RUNTIME_MODEL_NAME="configured-default"
fi

COMPOSED_PROMPT="$(mktemp)"
TEMP_FILES+=("${COMPOSED_PROMPT}")

cat "${ROLE_PROMPT}" > "${COMPOSED_PROMPT}"
{
  printf '\n\n## Runtime Parameters\n'
  printf 'These values were injected by scripts/sdd/run-role.sh. Treat them as authoritative input.\n'
  for pair in "${SANITIZED_PARAMS[@]}"; do
    key="${pair%%=*}"
    value="${pair#*=}"
    printf -- '- %s: %s\n' "${key}" "${value}"
  done
  printf -- '- model_name: %s\n' "$(sanitize_param_value "${RUNTIME_MODEL_NAME}")"
  printf -- '- reasoning_effort: %s\n' "$(sanitize_param_value "${REASONING_EFFORT}")"
  printf '\nDo not auto-discover role prompts from the working tree. The prompt above was included explicitly by the wrapper.\n'
} >> "${COMPOSED_PROMPT}"

if [[ "${DRY_RUN}" == "1" ]]; then
  cat "${COMPOSED_PROMPT}"
  exit 0
fi

"${BOOTSTRAP_SCRIPT}"

CODEX_COMMAND=("${APP_CODEX_BIN}" "exec" "--cd" "${ROLE_WORKDIR}" "--sandbox" "${SANDBOX_MODE}")

if [[ -n "${OUTPUT_LAST_MESSAGE}" ]]; then
  CODEX_COMMAND+=("--output-last-message" "${OUTPUT_LAST_MESSAGE}")
fi

if [[ -n "${MODEL_NAME}" ]]; then
  CODEX_COMMAND+=("--model" "${MODEL_NAME}")
fi

CODEX_COMMAND+=("-c" "model_reasoning_effort=\"${REASONING_EFFORT}\"")

if [[ -n "${PROFILE_NAME}" ]]; then
  CODEX_COMMAND+=("--profile" "${PROFILE_NAME}")
fi

if ((${#CODEX_ARGS[@]} > 0)); then
  CODEX_COMMAND+=("${CODEX_ARGS[@]}")
fi

CODEX_COMMAND+=("-")

"${CODEX_COMMAND[@]}" < "${COMPOSED_PROMPT}"
