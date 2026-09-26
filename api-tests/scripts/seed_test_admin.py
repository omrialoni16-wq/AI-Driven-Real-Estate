"""Create or update the test admin in the TEST auth database. Safe to run repeatedly.

    python scripts/seed_test_admin.py

Idempotent: it upserts by email, so every run leaves exactly one test admin
whose password matches TEST_ADMIN_PASSWORD in .env. The first run creates it;
later runs update the password hash (so changing the password in .env and
re-running just works).

Why write to the database directly instead of using the API: POST
/api/auth/register requires an admin to be logged in already, which is
chicken-and-egg on an empty database. The app's own backend/scripts/seedAdmins.js
solves the same problem the same way, but it's configured by editing the file.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import bcrypt
from pymongo import ASCENDING, MongoClient

# Scripts run as files, so Python only looks in scripts/ for imports.
# Add api-tests/ so `import config` works.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import ConfigError, load_settings  # noqa: E402

# Mongoose model "User" (backend/src/models/User.js) maps to collection "users".
USERS_COLLECTION = "users"
# Same cost factor the app uses in authController.register: bcrypt.hash(password, 10).
BCRYPT_ROUNDS = 10
ADMIN_NAME = "Test Admin"


def main() -> int:
    try:
        settings = load_settings()  # runs the safety guard: only *_test databases
    except ConfigError as error:
        print(f"Refusing to seed: {error}", file=sys.stderr)
        return 1

    # The User model lowercases and trims emails, and login looks them up that way.
    email = settings.admin_email.strip().lower()
    password_hash = bcrypt.hashpw(
        settings.admin_password.encode(), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    ).decode()
    now = datetime.now(timezone.utc)

    with MongoClient(settings.auth_mongo_uri, serverSelectionTimeoutMS=10_000) as client:
        users = client[settings.auth_db_name][USERS_COLLECTION]

        # The same unique index Mongoose creates from `unique: true` on email.
        # Normally the server has already created it, but on a fresh database
        # the seed may run first. With the index in place, "exactly one admin"
        # is enforced by the database, not just by this script's logic.
        users.create_index([("email", ASCENDING)], unique=True)

        # Upsert: update the document matching the filter, or insert one if none
        # matches. $setOnInsert fields are written only when inserting.
        result = users.update_one(
            {"email": email},
            {
                "$set": {"name": ADMIN_NAME, "passwordHash": password_hash, "updatedAt": now},
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )

    action = "Created" if result.upserted_id else "Updated"
    print(f"{action} test admin {email} in {settings.auth_db_name}.{USERS_COLLECTION}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
