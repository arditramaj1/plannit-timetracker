import os

from django.core.asgi import get_asgi_application

from config.env import load_project_env

load_project_env()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

application = get_asgi_application()
