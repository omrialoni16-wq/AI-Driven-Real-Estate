"""Start the backend against the TEST databases, in the foreground. Ctrl+C stops it.

    python scripts/run_test_server.py

It reads the same api-tests/.env the suite reads and passes those values to
`node server.js` as environment variables. The backend's own dotenv never
overrides a variable that is already set, so these win over backend/.env
without any change to the app. Values the suite doesn't set (GROQ_API_KEY,
CORS_EXTRA_ORIGINS) still come from backend/.env.

Why a launcher instead of "start the server however you like": the safety
guard in config.py can only inspect the .env file, not the running server.
Starting the server from that same checked .env is what makes the guard mean
something.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

# Scripts run as files, so Python only looks in scripts/ for imports.
# Add api-tests/ so `import config` works.
API_TESTS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_TESTS_DIR))

from config import ConfigError, load_settings  # noqa: E402

BACKEND_DIR = API_TESTS_DIR.parent / "backend"

# High enough that no realistic number of runs hits the login/register limiter,
# which otherwise allows 10 requests per 15 minutes per IP.
TEST_AUTH_RATE_LIMIT_MAX = "1000"


def main() -> int:
    try:
        settings = load_settings()  # runs the safety guard
    except ConfigError as error:
        print(f"Refusing to start the test server: {error}", file=sys.stderr)
        return 1

    port = urlsplit(settings.base_url).port or 80
    env = {
        **os.environ,
        "MONGO_URI": settings.mongo_uri,
        "AUTH_MONGO_URI": settings.auth_mongo_uri,
        "JWT_SECRET": settings.jwt_secret,
        "PORT": str(port),
        # Anything but "production": in production the cookie is `secure`, and
        # requests won't send a secure cookie back over plain http.
        "NODE_ENV": "test",
        "AUTH_RATE_LIMIT_MAX": TEST_AUTH_RATE_LIMIT_MAX,
    }

    print(
        f"Starting test server on port {port} "
        f"(databases: {settings.properties_db_name}, {settings.auth_db_name})",
        flush=True,
    )
    try:
        return subprocess.run(["node", "server.js"], cwd=BACKEND_DIR, env=env).returncode
    except KeyboardInterrupt:
        # Ctrl+C reaches node too (same process group); just exit quietly.
        return 0


if __name__ == "__main__":
    sys.exit(main())
