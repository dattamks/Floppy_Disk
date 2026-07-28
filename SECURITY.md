# Security Policy

## Reporting a vulnerability

If you believe you've found a security vulnerability in Floppy Disk, please
report it privately rather than opening a public issue.

- Use GitHub's **[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)**
  ("Report a vulnerability" under the repository's **Security** tab), or
- email the maintainer.

Please include enough detail to reproduce the issue (affected component,
version/commit, steps, and impact). We'll acknowledge your report and keep you
updated on the fix.

## Scope notes for self-hosters

- **Storage backend.** The local disk backend (`LocalStorageService`) is the
  default. Serve it only to authenticated users you trust with their own
  namespace; the blob endpoint is owner-scoped and rejects path traversal, but
  it is still an authenticated surface.
- **`SECRET_KEY`.** Production refuses to start on the built-in dev key — always
  set `DJANGO_SECRET_KEY`.
- **Deployment.** Run behind TLS, set `DJANGO_ALLOWED_HOSTS`,
  `CORS_ALLOWED_ORIGINS`, and `CSRF_TRUSTED_ORIGINS` for your domain (the
  defaults are localhost-only).

Please do not run automated scanners against instances you do not own.
