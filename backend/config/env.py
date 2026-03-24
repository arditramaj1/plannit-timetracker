from pathlib import Path

from dotenv import load_dotenv


def load_project_env() -> None:
    root_dir = Path(__file__).resolve().parents[2]
    project_root = root_dir.parent

    load_dotenv(project_root / ".env")
    load_dotenv(root_dir / ".env")

