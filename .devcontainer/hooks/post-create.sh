#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
backend_dir="${repo_root}/backend"
frontend_dir="${repo_root}/frontend"

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Required command not found: ${cmd}" >&2
    exit 1
  fi
}

require_command git
require_command uv
require_command npm

git config --global --add safe.directory "${repo_root}"

if [[ ! -d "${backend_dir}" || ! -d "${frontend_dir}" ]]; then
  echo "Expected backend and frontend directories under ${repo_root}" >&2
  exit 1
fi

cd "${backend_dir}"
uv sync --locked

cd "${frontend_dir}"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi
