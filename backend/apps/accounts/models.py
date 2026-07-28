"""
Accounts: custom email-first User (Phase 1) + device tracking.

Phase 1 uses email/password. Phone/OTP fields exist but are inert until the
Phase 2 auth stack (Cognito + DLT SMS) lands — kept here so the schema is
forward-compatible and migrations don't churn later.
"""
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class UserManager(BaseUserManager):
    """Manager for the email-as-username User model."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """Application user. Email is the login identity in Phase 1."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        DORMANT = "dormant", "Dormant"  # no login for 6 months
        SUSPENDED = "suspended", "Suspended"
        DELETED = "deleted", "Deleted"  # soft-deleted, pending 30-day hard delete

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    email = models.EmailField(unique=True, db_index=True)
    email_verified = models.BooleanField(default=False)

    date_of_birth = models.DateField(null=True, blank=True)  # self-attested, age >= 18

    display_name = models.CharField(max_length=120, blank=True, default="")

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )
    storage_region = models.CharField(max_length=16, default="ap-south")  # data residency

    # Device backup settings.
    auto_backup_enabled = models.BooleanField(default=False)
    backup_wifi_only = models.BooleanField(default=True)
    two_factor_enabled = models.BooleanField(default=False)

    # Denormalized quota counters. Single storage tier (no billing).
    quota_bytes = models.BigIntegerField(default=2 * 1024**4)        # 2 TB
    storage_used_bytes = models.BigIntegerField(default=0)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    last_login_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # email + password only

    class Meta:
        db_table = "accounts_user"

    def __str__(self):
        return self.email

    def mark_deleted(self):
        """DPDPA soft delete; hard delete cascades after 30 days."""
        self.status = self.Status.DELETED
        self.is_active = False
        self.deleted_at = timezone.now()
        self.save(update_fields=["status", "is_active", "deleted_at", "updated_at"])


class ApiKey(TimeStampedModel):
    """
    Programmatic access token (PRD: MCP / integrations).

    The full key is shown once at creation; only its SHA-256 hash is stored.
    Bearer-authenticated requests bypass CSRF (they carry no session cookie).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=80, blank=True, default="")
    prefix = models.CharField(max_length=12, db_index=True)  # first chars, for display
    key_hash = models.CharField(max_length=64, unique=True)  # sha256 hex
    # Comma-separated scopes granted to this key. "read" allows safe methods;
    # "write" is required for POST/PUT/PATCH/DELETE. Least-privilege: mint a
    # read-only key ("read") for integrations that only need to fetch.
    scopes = models.CharField(max_length=64, default="read,write")
    revoked = models.BooleanField(default=False)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "accounts_api_key"

    def has_scope(self, scope: str) -> bool:
        return scope in [s.strip() for s in (self.scopes or "").split(",") if s.strip()]

    @staticmethod
    def hash_token(token: str) -> str:
        import hashlib
        return hashlib.sha256(token.encode()).hexdigest()

    @classmethod
    def create_for(cls, user, name="", scopes="read,write"):
        """Mint a key. Returns (ApiKey, full_token) — the token is not stored."""
        import secrets
        token = "fd_" + secrets.token_urlsafe(32)
        key = cls.objects.create(
            user=user, name=name, prefix=token[:12], key_hash=cls.hash_token(token),
            scopes=scopes,
        )
        return key, token


class ConsentLog(TimeStampedModel):
    """Tracks ToS / Privacy Policy version acceptance (DPDPA, PRD 5.11)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="consents")
    policy = models.CharField(max_length=20, default="tos")  # tos | privacy
    version = models.CharField(max_length=40)

    class Meta:
        db_table = "accounts_consent_log"
        indexes = [models.Index(fields=["user", "policy"])]


class DataExport(TimeStampedModel):
    """A generated DPDPA data-export archive with an expiring download link."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="exports")
    object_key = models.CharField(max_length=512)
    size_bytes = models.BigIntegerField(default=0)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = "accounts_data_export"


class UserDevice(TimeStampedModel):
    """Device/session visibility and fraud signals (NOT rate-limiting — PRD 5.1)."""

    class DeviceType(models.TextChoices):
        IOS = "ios", "iOS"
        ANDROID = "android", "Android"
        WEB = "web", "Web"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    device_id = models.CharField(max_length=255)
    device_type = models.CharField(max_length=10, choices=DeviceType.choices)
    push_token = models.CharField(max_length=512, blank=True, default="")
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "accounts_user_device"
        unique_together = [("user", "device_id")]
        indexes = [models.Index(fields=["user", "last_seen"])]

    def __str__(self):
        return f"{self.user.email} · {self.device_type} · {self.device_id[:12]}"
