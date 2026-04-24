#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
BOLDER_HOME="${BOLDER_UTILS_HOME:-${REPO_ROOT}/node_modules/bolder-utils}"

exec bash "${BOLDER_HOME}/scripts/sdd/orchestrator.sh" "$@"
