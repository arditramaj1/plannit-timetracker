import os

from django.core.wsgi import get_wsgi_application

from config.env import load_project_env

load_project_env()
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

application = get_wsgi_application()
