#!/usr/bin/env bash
set -euo pipefail

if [[ ! -x /app/node_modules/.bin/next ]]; then
  npm install
fi

npm run dev
