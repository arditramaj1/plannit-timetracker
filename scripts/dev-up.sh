#!/usr/bin/env bash
set -euo pipefail

[[ -f .env ]] || cp .env.example .env
[[ -f backend/.env ]] || cp backend/.env.example backend/.env
[[ -f frontend/.env.local ]] || cp frontend/.env.local.example frontend/.env.local

docker compose up --build "$@"

