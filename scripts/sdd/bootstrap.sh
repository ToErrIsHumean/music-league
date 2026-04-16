#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/project-config.sh
source "${SCRIPT_DIR}/../lib/project-config.sh"

mkdir -p "${APP_SDD_DOCS_DIR_ABS}/reviews"
