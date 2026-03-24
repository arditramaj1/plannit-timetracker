#!/usr/bin/env python
import os
import sys

from config.env import load_project_env


def main() -> None:
    load_project_env()
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Django is not installed or unavailable on PYTHONPATH.") from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
