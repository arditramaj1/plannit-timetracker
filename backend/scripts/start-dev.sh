#!/usr/bin/env bash
set -euo pipefail

/app/scripts/entrypoint.sh python manage.py runserver 0.0.0.0:8000

