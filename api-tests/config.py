"""Loads the suite's configuration from environment variables into one typed object.

Every environment-specific value (URLs, credentials, timeouts) comes from here.
Test code never reads os.environ directly, so pointing the suite at a different
environment only means using a different .env file.

This module is also the safety rail: load_settings() refuses to return a
Settings object unless the target is a local server backed by *_test databases.
There is no way to get settings that point at real data.

Run `python config.py` to check your .env without running any tests.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

API_TESTS_DIR = Path(__file__).resolve().parent
ENV_FILE = API_TESTS_DIR / ".env"

# Hosts that mean "a server on this machine". Anything else could be a shared or
# production deployment, which this suite must never write to.
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
TEST_DB_SUFFIX = "_test"

REQUIRED_VARS = (
    "API_BASE_URL",
    "TEST_MONGO_URI",
    "TEST_AUTH_MONGO_URI",
    "TEST_JWT_SECRET",
    "TEST_ADMIN_EMAIL",
    "TEST_ADMIN_PASSWORD",
)
DEFAULT_TIMEOUT_SECONDS = 10.0


class ConfigError(Exception):
    """The configuration is missing, malformed, or points at something unsafe."""


# frozen=True: a test cannot change settings halfway through a run and silently
# affect every test after it.
# repr=False on secrets: if a failing test prints the settings object, the
# password, secret, and connection strings (which embed credentials) stay out of the log.
@dataclass(frozen=True)
class Settings:
    base_url: str
    admin_email: str
    admin_password: str = field(repr=False)
    request_timeout: float
    mongo_uri: str = field(repr=False)
    auth_mongo_uri: str = field(repr=False)
    jwt_secret: str = field(repr=False)

    @property
    def properties_db_name(self) -> str:
        return db_name_from_uri(self.mongo_uri)

    @property
    def auth_db_name(self) -> str:
        return db_name_from_uri(self.auth_mongo_uri)


def db_name_from_uri(uri: str) -> str:
    """Extract the database name from a MongoDB connection string.

    mongodb+srv://user:pass@cluster0.example.mongodb.net/Properties_test?retryWrites=true
                                                        ^^^^^^^^^^^^^^^ the URL path

    Parsed as plain text on purpose: pymongo's own URI parser does a DNS lookup
    for mongodb+srv URIs, and a config check shouldn't need the network.
    """
    return urlsplit(uri).path.lstrip("/")


def assert_safe_target(settings: Settings) -> None:
    """Raise ConfigError unless the suite targets a local server and *_test databases."""
    host = urlsplit(settings.base_url).hostname
    if host not in LOCAL_HOSTS:
        raise ConfigError(
            f"API_BASE_URL host is {host!r}. The suite only runs against a local "
            f"server ({', '.join(sorted(LOCAL_HOSTS))}) because it creates and deletes data."
        )

    for var_name, db_name in (
        ("TEST_MONGO_URI", settings.properties_db_name),
        ("TEST_AUTH_MONGO_URI", settings.auth_db_name),
    ):
        if not db_name:
            # With no database in the URI, Mongoose falls back to a database named "test".
            raise ConfigError(
                f"{var_name} has no database name. Add one ending in "
                f"'{TEST_DB_SUFFIX}' after the host, e.g. .../MyDatabase{TEST_DB_SUFFIX}"
            )
        if not db_name.endswith(TEST_DB_SUFFIX):
            raise ConfigError(
                f"{var_name} points at database {db_name!r}. The suite creates and "
                f"deletes data, so the database name must end with '{TEST_DB_SUFFIX}'. "
                f"Check {ENV_FILE}."
            )


def load_settings() -> Settings:
    """Read the environment, validate it, and return a Settings object pointing at a safe target."""
    # override=False: a variable already set in the real environment wins over
    # the .env file. That's how CI will inject its values from repo secrets.
    load_dotenv(ENV_FILE, override=False)

    missing = [name for name in REQUIRED_VARS if not os.getenv(name, "").strip()]
    if missing:
        raise ConfigError(
            f"Missing required variables: {', '.join(missing)}. "
            f"Copy .env.example to .env in {API_TESTS_DIR} and fill them in."
        )

    raw_timeout = os.getenv("REQUEST_TIMEOUT_SECONDS", "").strip()
    try:
        timeout = float(raw_timeout) if raw_timeout else DEFAULT_TIMEOUT_SECONDS
    except ValueError:
        raise ConfigError(f"REQUEST_TIMEOUT_SECONDS must be a number, got {raw_timeout!r}") from None

    settings = Settings(
        base_url=os.environ["API_BASE_URL"].strip().rstrip("/"),
        admin_email=os.environ["TEST_ADMIN_EMAIL"].strip(),
        admin_password=os.environ["TEST_ADMIN_PASSWORD"],
        request_timeout=timeout,
        mongo_uri=os.environ["TEST_MONGO_URI"].strip(),
        auth_mongo_uri=os.environ["TEST_AUTH_MONGO_URI"].strip(),
        jwt_secret=os.environ["TEST_JWT_SECRET"],
    )
    assert_safe_target(settings)
    return settings


if __name__ == "__main__":
    try:
        s = load_settings()
    except ConfigError as error:
        raise SystemExit(f"Config NOT OK: {error}")
    print("Config OK")
    print(f"  API base URL:        {s.base_url}")
    print(f"  Properties database: {s.properties_db_name}")
    print(f"  Auth database:       {s.auth_db_name}")
    print(f"  Admin email:         {s.admin_email}")
    print(f"  Request timeout:     {s.request_timeout}s")
