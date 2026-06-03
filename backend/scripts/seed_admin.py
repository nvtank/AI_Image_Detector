import sys
import os
import sqlite3
from datetime import datetime, timezone

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings
from app.services import auth_service
from app.services.logging_service import logging_service  # Triggers DB init and migration


def update_admin_emails_in_env_file(env_file: str, email: str) -> bool:
    email = email.strip().lower()
    os.makedirs(os.path.dirname(env_file) or ".", exist_ok=True)

    existing_lines = []
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            existing_lines = f.read().splitlines()

    changed = False
    found = False
    new_lines = []

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


def main():
    email = "admin@gmail.com"
    password = "admin"
    full_name = "Admin"
    env_file = os.path.join(os.path.dirname(__file__), "..", ".env")

    print("[Seed] Initializing/migrating database...")
    # This automatically instantiates LoggingService which runs _init_db and _migrate_db
    db_path = settings.DATABASE_PATH
    print(f"[Seed] Database path: {db_path}")

    # Generate bcrypt hash of the password "admin"
    password_hash = auth_service.hash_password(password)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        
        # Check if user already exists
        cur.execute("SELECT id FROM users WHERE email = ?", (email,))
        row = cur.fetchone()

        if row:
            # Update password and role to admin
            print(f"[Seed] User {email} already exists. Updating password and role to admin...")
            cur.execute(
                "UPDATE users SET password_hash = ?, role = ?, updated_at = ? WHERE email = ?",
                (password_hash, "admin", now, email)
            )
            conn.commit()
            print("[Seed] User updated successfully.")
        else:
            # Insert new user with admin role
            print(f"[Seed] Creating new admin user: {email}...")
            cur.execute(
                "INSERT INTO users (full_name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (full_name, email, password_hash, "admin", now, now)
            )
            conn.commit()
            print("[Seed] User created successfully.")
    except Exception as e:
        print(f"[Seed] Error updating database: {e}")
        return 1
    finally:
        conn.close()

    # Update .env
    try:
        changed = update_admin_emails_in_env_file(env_file, email)
        if changed:
            print(f"[Seed] Updated {env_file}: added {email} to ADMIN_EMAILS")
        else:
            print(f"[Seed] Config check: {env_file} already contains {email} in ADMIN_EMAILS")
    except Exception as e:
        print(f"[Seed] Warning: Failed to update .env: {e}")

    print("[Seed] Seeding completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
