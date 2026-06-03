import sys
import os
import argparse
import secrets
import string

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings
from app.services import auth_service


def _generate_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits
    # ensure at least 1 digit to satisfy backend password policy
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if any(c.isdigit() for c in pwd):
            return pwd


def _update_admin_emails_in_env_file(env_file: str, email: str) -> bool:
    """Update or append ADMIN_EMAILS in an .env file. Returns True if changed."""
    email = email.strip().lower()
    os.makedirs(os.path.dirname(env_file) or ".", exist_ok=True)

    existing_lines: list[str] = []
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            existing_lines = f.read().splitlines()

    changed = False
    found = False
    new_lines: list[str] = []

    for line in existing_lines:
        if line.strip().startswith("ADMIN_EMAILS="):
            found = True
            key, _, value = line.partition("=")
            current = [e.strip().lower() for e in value.split(",") if e.strip()]
            if email not in current:
                current.append(email)
                changed = True
            new_lines.append(f"{key}={','.join(current)}")
        else:
            new_lines.append(line)

    if not found:
        new_lines.append(f"ADMIN_EMAILS={email}")
        changed = True

    if changed:
        with open(env_file, "w", encoding="utf-8") as f:
            f.write("\n".join(new_lines) + "\n")

    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an admin user for AI Image Detector (SQLite + RBAC via ADMIN_EMAILS)")
    parser.add_argument("--email", help="Admin email (or set ADMIN_EMAIL)")
    parser.add_argument("--password", help="Admin password (or set ADMIN_PASSWORD). If omitted, a strong password is generated.")
    parser.add_argument("--full-name", default="Admin", help="Full name (default: Admin)")
    parser.add_argument(
        "--update-env",
        action="store_true",
        help="Also write/update ADMIN_EMAILS in an env file so this email gets admin role.",
    )
    parser.add_argument(
        "--env-file",
        default=os.path.join(os.path.dirname(__file__), "..", ".env"),
        help="Path to .env to update when using --update-env (default: backend/.env)",
    )
    parser.add_argument(
        "--reset-password",
        action="store_true",
        help="If user already exists, reset their password to the provided/generated one.",
    )

    args = parser.parse_args()

    email = (args.email or os.getenv("ADMIN_EMAIL") or "").strip()
    if not email:
        print("Error: missing --email (or env ADMIN_EMAIL)")
        return 2

    password = (args.password or os.getenv("ADMIN_PASSWORD") or "").strip()
    generated = False
    if not password:
        password = _generate_password()
        generated = True

    # Ensure DB directory exists (auth_service doesn't mkdir)
    os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)

    existing = auth_service.get_user_by_email(email)
    if existing:
        if not args.reset_password:
            print(f"User already exists: {email} (id={existing['id']}). Use --reset-password to change password.")
        else:
            password_hash = auth_service.hash_password(password)
            import sqlite3
            from datetime import datetime, timezone

            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            conn = sqlite3.connect(settings.DATABASE_PATH)
            try:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE users SET password_hash = ?, updated_at = ? WHERE email = ?",
                    (password_hash, now, email),
                )
                conn.commit()
            finally:
                conn.close()
            print(f"Password reset for user: {email}")
    else:
        try:
            user = auth_service.create_user(full_name=args.full_name, email=email, password=password)
        except ValueError as e:
            print(f"Error: {e}")
            return 2
        print(f"Created user: {user['email']} (id={user['id']})")

    # RBAC is config-based, not stored in DB
    current_admin_emails = [e.strip().lower() for e in settings.ADMIN_EMAILS.split(",") if e.strip()]
    if email.lower() not in current_admin_emails:
        if args.update_env:
            changed = _update_admin_emails_in_env_file(args.env_file, email)
            if changed:
                print(f"Updated {args.env_file}: added {email} to ADMIN_EMAILS")
            else:
                print(f"No change: {args.env_file} already contains {email} in ADMIN_EMAILS")
        else:
            print("NOTE: This user will NOT be admin until you set ADMIN_EMAILS to include their email.")
            print(f"      Example: ADMIN_EMAILS={email}")

    if generated:
        print("\nGenerated password (save it now):")
        print(password)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
