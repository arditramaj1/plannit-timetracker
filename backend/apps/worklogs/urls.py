from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import WorkLogEntryViewSet

router = DefaultRouter()
router.register("", WorkLogEntryViewSet, basename="worklog")

urlpatterns = [
    path("", include(router.urls)),
]

