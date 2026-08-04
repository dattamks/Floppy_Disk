"""DRF serializers for the auth API."""
import datetime

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()

MIN_SIGNUP_AGE = 18  # PRD 5.1: minimum account age


class UserSerializer(serializers.ModelSerializer):
    # True for the instance Owner (first user or a superuser). The SPA uses this
    # to reveal the owner-only Storage/Admin settings; regular users get False.
    is_owner = serializers.BooleanField(source="is_owner_effective", read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "email_verified", "display_name", "storage_region",
                  "status", "quota_bytes", "two_factor_enabled", "is_owner", "avatar_url",
                  "language"]
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    display_name = serializers.CharField(required=False, allow_blank=True, default="")
    date_of_birth = serializers.DateField()

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def validate_date_of_birth(self, value):
        today = datetime.date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < MIN_SIGNUP_AGE:
            raise serializers.ValidationError(
                f"You must be at least {MIN_SIGNUP_AGE} years old to sign up."
            )
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField()
