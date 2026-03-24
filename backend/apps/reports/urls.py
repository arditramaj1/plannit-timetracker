from django.urls import path

from .views import AdminReportView

urlpatterns = [
    path("summary/", AdminReportView.as_view(), name="report-summary"),
]
