#!/usr/bin/env python3
"""
Provision demo users in Keycloak — one-time script.

Creates the four WithoutBorder demo accounts in the Keycloak realm with fixed
UUIDs so the local database seed (app/seed.py) stays in sync across environments.

Usage:
    # With env vars
    KEYCLOAK_URL=https://auth.manga-pics.com \
    KEYCLOAK_REALM=without-border \
    KEYCLOAK_ADMIN_USER=admin \
    KEYCLOAK_ADMIN_PASSWORD=<secret> \
    python scripts/provision_keycloak.py

    # Or with a .env file
    cp scripts/provision_keycloak.env.example scripts/provision_keycloak.env
    # (edit provision_keycloak.env)
    python scripts/provision_keycloak.py

Requirements:
    pip install httpx python-dotenv
"""

import sys
import os

# Load .env file next to this script if present
_env_file = os.path.join(os.path.dirname(__file__), "provision_keycloak.env")
if os.path.exists(_env_file):
    from dotenv import load_dotenv
    load_dotenv(_env_file)

import httpx

# ── Configuration ──────────────────────────────────────────────────────────────

KEYCLOAK_URL    = os.environ.get("KEYCLOAK_URL",            "https://auth.manga-pics.com")
REALM           = os.environ.get("KEYCLOAK_REALM",          "without-border")
ADMIN_USER      = os.environ.get("KEYCLOAK_ADMIN_USER",     "admin")
ADMIN_PASSWORD  = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "")
DEMO_PASSWORD   = os.environ.get("DEMO_PASSWORD",           "demo1234")

# ── Demo users — UUIDs MUST match backend/app/seed.py ─────────────────────────

DEMO_USERS = [
    {
        "id":         "00000000-0000-0000-0000-000000000001",
        "email":      "demo@withoutborder.app",
        "username":   "sophie",
        "firstName":  "Sophie",
        "lastName":   "",
        "locale":     "fr",
    },
    {
        "id":         "00000000-0000-0000-0000-000000000002",
        "email":      "john@withoutborder.app",
        "username":   "john",
        "firstName":  "John",
        "lastName":   "",
        "locale":     "en",
    },
    {
        "id":         "00000000-0000-0000-0000-000000000003",
        "email":      "maria@withoutborder.app",
        "username":   "maria",
        "firstName":  "Maria",
        "lastName":   "",
        "locale":     "es",
    },
    {
        "id":         "00000000-0000-0000-0000-000000000004",
        "email":      "kevin@withoutborder.app",
        "username":   "kevin",
        "firstName":  "Kevin",
        "lastName":   "Lee",
        "locale":     "ko",
    },
    {
        "id":         "00000000-0000-0000-0000-000000000005",
        "email":      "sarah@withoutborder.app",
        "username":   "sarah",
        "firstName":  "Sarah",
        "lastName":   "Wilson",
        "locale":     "en",
    },
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def get_admin_token(client: httpx.Client) -> str:
    """Obtain a short-lived admin access token from the master realm."""
    resp = client.post(
        f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
        data={
            "grant_type":    "password",
            "client_id":     "admin-cli",
            "username":      ADMIN_USER,
            "password":      ADMIN_PASSWORD,
        },
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def user_exists(client: httpx.Client, token: str, email: str) -> str | None:
    """Return the Keycloak user ID if a user with this email already exists."""
    resp = client.get(
        f"{KEYCLOAK_URL}/admin/realms/{REALM}/users",
        params={"email": email, "exact": "true"},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    users = resp.json()
    return users[0]["id"] if users else None


def create_user(client: httpx.Client, token: str, user: dict) -> None:
    """Create a user in Keycloak with a fixed UUID and set their password."""
    payload = {
        "id":            user["id"],
        "email":         user["email"],
        "username":      user["username"],
        "firstName":     user["firstName"],
        "lastName":      user["lastName"],
        "enabled":       True,
        "emailVerified": True,
        "attributes": {
            "locale": [user["locale"]],
        },
        "credentials": [
            {
                "type":      "password",
                "value":     DEMO_PASSWORD,
                "temporary": False,
            }
        ],
    }
    resp = client.post(
        f"{KEYCLOAK_URL}/admin/realms/{REALM}/users",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    if resp.status_code == 409:
        print(f"  ⚠  {user['email']} already exists in Keycloak (ID mismatch?), skipping creation")
        return
    resp.raise_for_status()
    print(f"  ✓  Created {user['email']} ({user['firstName']}) — UUID {user['id']}")


def reset_password(client: httpx.Client, token: str, keycloak_id: str, email: str) -> None:
    """Reset the password for an already-existing user."""
    resp = client.put(
        f"{KEYCLOAK_URL}/admin/realms/{REALM}/users/{keycloak_id}/reset-password",
        json={"type": "password", "value": DEMO_PASSWORD, "temporary": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    print(f"  ↻  {email} already exists — password reset to demo value")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    if not ADMIN_PASSWORD:
        print("❌  KEYCLOAK_ADMIN_PASSWORD is required.")
        print(f"    Copy scripts/provision_keycloak.env.example → scripts/provision_keycloak.env and fill it in.")
        sys.exit(1)

    print(f"\n🔑  Connecting to Keycloak at {KEYCLOAK_URL}")
    print(f"    Realm : {REALM}")
    print(f"    Admin : {ADMIN_USER}\n")

    with httpx.Client(timeout=30) as client:
        try:
            token = get_admin_token(client)
        except httpx.HTTPStatusError as exc:
            print(f"❌  Could not authenticate as admin: {exc.response.status_code} — {exc.response.text}")
            sys.exit(1)

        print(f"✅  Admin token obtained\n")
        print(f"👥  Provisioning {len(DEMO_USERS)} demo users (password: {DEMO_PASSWORD})\n")

        for user in DEMO_USERS:
            existing_id = user_exists(client, token, user["email"])
            if existing_id:
                reset_password(client, token, existing_id, user["email"])
            else:
                create_user(client, token, user)

    print("\n✅  Provisioning complete!")
    print("\n📋  Demo accounts:")
    print("┌──────────────────────────────────┬──────────┬──────┬──────────────────────────────────────┐")
    print("│ Email                            │ Username │ Lang │ UUID                                 │")
    print("├──────────────────────────────────┼──────────┼──────┼──────────────────────────────────────┤")
    for u in DEMO_USERS:
        print(f"│ {u['email']:<32} │ {u['username']:<8} │ {u['locale']:<4} │ {u['id']} │")
    print("└──────────────────────────────────┴──────────┴──────┴──────────────────────────────────────┘")
    print(f"\n🔒  Password: {DEMO_PASSWORD}")
    print(f"⚠   These UUIDs must match those in backend/app/seed.py")


if __name__ == "__main__":
    main()
