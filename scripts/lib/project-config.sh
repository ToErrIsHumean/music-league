#!/usr/bin/env bash

if [[ -n "${PROJECT_CONFIG_SH_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
PROJECT_CONFIG_SH_LOADED=1

PROJECT_CONFIG_KEYS=(
  APP_DEPLOY_ROOT
  APP_FRONTEND_DIST
  APP_DB_PATH
  APP_BACKUP_DIR
  APP_BACKUP_LOG
  APP_BACKUP_RETENTION_DAYS
  APP_NGINX_SERVER_NAME
  APP_BACKEND_PROXY_URL
  APP_PM_GUIDANCE_PATH
  APP_PM_PROCESS_PATH
  APP_PM_PROMPTS_DIR
  APP_PM_STATE_DIR
  APP_SDD_WORKTREE_ROOT
  APP_SDD_DOCS_DIR
  APP_SDD_BRANCH_PREFIX
  APP_SDD_GATE_CONFIG_PATH
  APP_CODEX_BIN
  APP_CLAUDE_BIN
  APP_CLINE_BIN
)

_PROJECT_CONFIG_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
APP_REPO_ROOT="$(cd "${PROJECT_CONFIG_REPO_ROOT_OVERRIDE:-${_PROJECT_CONFIG_LIB_DIR}/../..}" && pwd -P)"
PROJECT_CONFIG_DIR="$(cd "${PROJECT_CONFIG_DIR_OVERRIDE:-${APP_REPO_ROOT}/config}" && pwd -P)"

declare -A _PROJECT_CONFIG_ORIGINAL_SET=()
declare -A _PROJECT_CONFIG_ORIGINAL_VALUE=()

for _project_config_key in "${PROJECT_CONFIG_KEYS[@]}"; do
  if [[ -v "${_project_config_key}" ]]; then
    _PROJECT_CONFIG_ORIGINAL_SET["${_project_config_key}"]=1
    _PROJECT_CONFIG_ORIGINAL_VALUE["${_project_config_key}"]="${!_project_config_key}"
  else
    _PROJECT_CONFIG_ORIGINAL_SET["${_project_config_key}"]=0
  fi
done

project_config_source_file() {
  local file_path="$1"

  if [[ ! -f "${file_path}" ]]; then
    return
  fi

  set -a
  # shellcheck source=/dev/null
  source "${file_path}"
  set +a
}

project_config_resolve_repo_path() {
  local input_path="$1"

  if [[ -z "${input_path}" ]]; then
    printf '\n'
    return
  fi

  if [[ "${input_path}" == /* ]]; then
    printf '%s\n' "${input_path}"
    return
  fi

  printf '%s\n' "${APP_REPO_ROOT}/${input_path#./}"
}

project_config_resolve_deploy_path() {
  local input_path="$1"

  if [[ -z "${input_path}" ]]; then
    printf '\n'
    return
  fi

  if [[ "${input_path}" == /* ]]; then
    printf '%s\n' "${input_path}"
    return
  fi

  printf '%s\n' "${APP_DEPLOY_ROOT_ABS}/${input_path#./}"
}

project_config_repo_relative_path() {
  local input_path="$1"
  local resolved_path

  if [[ -z "${input_path}" ]]; then
    printf '\n'
    return
  fi

  resolved_path="$(project_config_resolve_repo_path "${input_path}")"

  if [[ "${resolved_path}" == "${APP_REPO_ROOT}/"* ]]; then
    printf '%s\n' "${resolved_path#${APP_REPO_ROOT}/}"
    return
  fi

  printf '%s\n' "${input_path}"
}

project_config_source_file "${PROJECT_CONFIG_DIR}/project.defaults.env"
project_config_source_file "${PROJECT_CONFIG_DIR}/project.local.env"

for _project_config_key in "${PROJECT_CONFIG_KEYS[@]}"; do
  if [[ "${_PROJECT_CONFIG_ORIGINAL_SET["${_project_config_key}"]}" == "1" ]]; then
    export "${_project_config_key}=${_PROJECT_CONFIG_ORIGINAL_VALUE["${_project_config_key}"]}"
  fi
done

APP_DEPLOY_ROOT_ABS="$(project_config_resolve_repo_path "${APP_DEPLOY_ROOT:-}")"
APP_FRONTEND_DIST_ABS="$(project_config_resolve_repo_path "${APP_FRONTEND_DIST:-}")"
APP_DEPLOY_FRONTEND_DIST="$(project_config_resolve_deploy_path "${APP_FRONTEND_DIST:-}")"
APP_DB_PATH_ABS="$(project_config_resolve_repo_path "${APP_DB_PATH:-}")"
APP_DEPLOY_DB_PATH="$(project_config_resolve_deploy_path "${APP_DB_PATH:-}")"
APP_BACKUP_DIR_ABS="$(project_config_resolve_repo_path "${APP_BACKUP_DIR:-}")"
APP_BACKUP_LOG_ABS="$(project_config_resolve_repo_path "${APP_BACKUP_LOG:-}")"
APP_PM_GUIDANCE_PATH_ABS="$(project_config_resolve_repo_path "${APP_PM_GUIDANCE_PATH:-}")"
APP_PM_GUIDANCE_PATH_REL="$(project_config_repo_relative_path "${APP_PM_GUIDANCE_PATH:-}")"
APP_PM_PROCESS_PATH_ABS="$(project_config_resolve_repo_path "${APP_PM_PROCESS_PATH:-}")"
APP_PM_PROCESS_PATH_REL="$(project_config_repo_relative_path "${APP_PM_PROCESS_PATH:-}")"
APP_PM_PROMPTS_DIR_ABS="$(project_config_resolve_repo_path "${APP_PM_PROMPTS_DIR:-}")"
APP_PM_PROMPTS_DIR_REL="$(project_config_repo_relative_path "${APP_PM_PROMPTS_DIR:-}")"
APP_PM_STATE_DIR_ABS="$(project_config_resolve_repo_path "${APP_PM_STATE_DIR:-}")"
APP_PM_STATE_DIR_REL="$(project_config_repo_relative_path "${APP_PM_STATE_DIR:-}")"
APP_SDD_WORKTREE_ROOT_ABS="$(project_config_resolve_repo_path "${APP_SDD_WORKTREE_ROOT:-}")"
APP_SDD_DOCS_DIR_ABS="$(project_config_resolve_repo_path "${APP_SDD_DOCS_DIR:-}")"
APP_SDD_DOCS_DIR_REL="$(project_config_repo_relative_path "${APP_SDD_DOCS_DIR:-}")"
APP_SDD_GATE_CONFIG_PATH_ABS="$(project_config_resolve_repo_path "${APP_SDD_GATE_CONFIG_PATH:-}")"
APP_SDD_GATE_CONFIG_PATH_REL="$(project_config_repo_relative_path "${APP_SDD_GATE_CONFIG_PATH:-}")"

export APP_REPO_ROOT
export PROJECT_CONFIG_DIR
export APP_DEPLOY_ROOT_ABS
export APP_FRONTEND_DIST_ABS
export APP_DEPLOY_FRONTEND_DIST
export APP_DB_PATH_ABS
export APP_DEPLOY_DB_PATH
export APP_BACKUP_DIR_ABS
export APP_BACKUP_LOG_ABS
export APP_PM_GUIDANCE_PATH_ABS
export APP_PM_GUIDANCE_PATH_REL
export APP_PM_PROCESS_PATH_ABS
export APP_PM_PROCESS_PATH_REL
export APP_PM_PROMPTS_DIR_ABS
export APP_PM_PROMPTS_DIR_REL
export APP_PM_STATE_DIR_ABS
export APP_PM_STATE_DIR_REL
export APP_SDD_WORKTREE_ROOT_ABS
export APP_SDD_DOCS_DIR_ABS
export APP_SDD_DOCS_DIR_REL
export APP_SDD_GATE_CONFIG_PATH_ABS
export APP_SDD_GATE_CONFIG_PATH_REL
