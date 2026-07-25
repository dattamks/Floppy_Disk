"""DRF serializers for the auth API."""
import datetime

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

User = get_user_model()

MIN_SIGNUP_AGE = 18  # PRD 5.1: minimum account age


class UserSerializer(serializers.ModelSerializer):
    billing_enabled = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "email_verified", "display_name", "storage_region",
                  "status", "tier", "quota_bytes", "billing_enabled"]
        read_only_fields = fields

    def get_billing_enabled(self, obj):
        from django.conf import settings
        return settings.RAZORPAY_ENABLED


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
