from django.contrib.auth import get_user_model
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework_simplejwt.views import TokenObtainPairView

from apps.common.permissions import IsAdminRole

from .serializers import CompactUserSerializer, CustomTokenObtainPairSerializer, UserSerializer

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class CurrentUserView(RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CompactUserSerializer

    def get_object(self):
        return self.request.user


class UserViewSet(ReadOnlyModelViewSet):
    queryset = User.objects.filter(is_active=True).order_by("first_name", "last_name", "username")
    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]
    search_fields = ("username", "email", "first_name", "last_name")
    ordering_fields = ("username", "email", "date_joined", "last_login")
