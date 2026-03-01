"""
Integration tests for the API Gateway.

Uses the Firebase Auth Emulator to create real test users and obtain
genuine ID tokens. Tests verify that the gateway:
  1. Requires a valid Bearer token for protected endpoints
  2. Proxies requests to the profile-service correctly
  3. Injects X-User-Id from the verified Firebase UID
  4. Allows unauthenticated access to public endpoints
  5. Returns proper error codes for missing/invalid auth
"""

import json
import os
import uuid

import requests

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:8080")
EMULATOR_HOST = os.getenv("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099")
PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "ironguild-local")

# Firebase Auth Emulator REST endpoints
_EMULATOR_SIGNUP_URL = (
    f"http://{EMULATOR_HOST}/identitytoolkit.googleapis.com/v1"
    f"/accounts:signUp?key=fake-api-key"
)
_EMULATOR_SIGNIN_URL = (
    f"http://{EMULATOR_HOST}/identitytoolkit.googleapis.com/v1"
    f"/accounts:signInWithPassword?key=fake-api-key"
)
_EMULATOR_DELETE_URL = (
    f"http://{EMULATOR_HOST}/emulator/v1/projects/{PROJECT_ID}/accounts"
)


def _create_emulator_user(email: str = None, password: str = "testpass123"):
    """
    Create a user in the Firebase Auth Emulator and return (uid, id_token).
    """
    if email is None:
        email = f"test-{uuid.uuid4().hex[:8]}@test.com"

    resp = requests.post(
        _EMULATOR_SIGNUP_URL,
        json={"email": email, "password": password, "returnSecureToken": True},
    )
    resp.raise_for_status()
    data = resp.json()
    return data["localId"], data["idToken"]


def _sign_in(email: str, password: str = "testpass123"):
    """Sign in an existing emulator user and return (uid, id_token)."""
    resp = requests.post(
        _EMULATOR_SIGNIN_URL,
        json={"email": email, "password": password, "returnSecureToken": True},
    )
    resp.raise_for_status()
    data = resp.json()
    return data["localId"], data["idToken"]


def auth_header(token: str) -> dict:
    """Build an Authorization header with a Bearer token."""
    return {"Authorization": f"Bearer {token}"}


def unique_username() -> str:
    return f"gw_{uuid.uuid4().hex[:10]}"


def setup_module():
    """Verify gateway and emulator are reachable."""
    resp = requests.get(f"{GATEWAY_URL}/health")
    assert resp.status_code == 200
    resp = requests.get(f"http://{EMULATOR_HOST}/")
    assert resp.status_code == 200


def teardown_module():
    """Delete all emulator accounts."""
    requests.delete(_EMULATOR_DELETE_URL)


# ─────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────

class TestHealth:

    def test_gateway_health(self):
        resp = requests.get(f"{GATEWAY_URL}/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["service"] == "api-gateway"


# ─────────────────────────────────────────────────────────────────────
# Auth enforcement
# ─────────────────────────────────────────────────────────────────────

class TestAuthEnforcement:

    def test_post_profile_no_token_401(self):
        """POST /profile without Bearer token returns 401."""
        resp = requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": "notoken"},
        )
        assert resp.status_code == 401

    def test_get_own_profile_no_token_401(self):
        """GET /profile without Bearer token returns 401."""
        resp = requests.get(f"{GATEWAY_URL}/profile")
        assert resp.status_code == 401

    def test_patch_profile_no_token_401(self):
        """PATCH /profile without Bearer token returns 401."""
        resp = requests.patch(
            f"{GATEWAY_URL}/profile",
            json={"bio": "hacker"},
        )
        assert resp.status_code == 401

    def test_delete_profile_no_token_401(self):
        """DELETE /profile without Bearer token returns 401."""
        resp = requests.delete(f"{GATEWAY_URL}/profile")
        assert resp.status_code == 401

    def test_invalid_token_401(self):
        """A garbage token should return 401."""
        resp = requests.get(
            f"{GATEWAY_URL}/profile",
            headers=auth_header("this-is-not-a-valid-token"),
        )
        assert resp.status_code == 401

    def test_public_profile_no_token_ok(self):
        """GET /profile/{username} should NOT require auth."""
        # Will 404 because user doesn't exist, but NOT 401
        resp = requests.get(f"{GATEWAY_URL}/profile/nonexistent")
        assert resp.status_code != 401


# ─────────────────────────────────────────────────────────────────────
# Profile CRUD through the gateway (with real emulator tokens)
# ─────────────────────────────────────────────────────────────────────

class TestProfileCrudViaGateway:

    def test_create_profile(self):
        """POST /profile with a real emulator token creates a profile."""
        uid, token = _create_emulator_user()
        username = unique_username()
        resp = requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": username},
            headers=auth_header(token),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["username"] == username
        assert body["id"] == uid  # UID from Firebase emulator

        # Clean up
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token))

    def test_get_own_profile(self):
        """GET /profile returns the authenticated user's profile."""
        uid, token = _create_emulator_user()
        username = unique_username()
        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": username},
            headers=auth_header(token),
        )

        resp = requests.get(f"{GATEWAY_URL}/profile", headers=auth_header(token))
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == uid
        assert body["username"] == username

        # Clean up
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token))

    def test_update_profile(self):
        """PATCH /profile updates the profile."""
        uid, token = _create_emulator_user()
        username = unique_username()
        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": username},
            headers=auth_header(token),
        )

        resp = requests.patch(
            f"{GATEWAY_URL}/profile",
            json={"bio": "Updated via gateway"},
            headers=auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["bio"] == "Updated via gateway"

        # Clean up
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token))

    def test_get_public_profile(self):
        """GET /profile/{username} returns the public profile (no auth needed)."""
        uid, token = _create_emulator_user()
        username = unique_username()
        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": username},
            headers=auth_header(token),
        )

        resp = requests.get(f"{GATEWAY_URL}/profile/{username}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["username"] == username
        assert "id" not in body
        assert "createdAt" not in body

        # Clean up
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token))

    def test_delete_profile(self):
        """DELETE /profile removes the profile."""
        uid, token = _create_emulator_user()
        username = unique_username()
        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": username},
            headers=auth_header(token),
        )

        resp = requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token))
        assert resp.status_code == 204

    def test_get_after_delete_404(self):
        """GET /profile after deletion returns 404."""
        uid, token = _create_emulator_user()
        username = unique_username()
        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": username},
            headers=auth_header(token),
        )
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token))

        resp = requests.get(f"{GATEWAY_URL}/profile", headers=auth_header(token))
        assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────
# User isolation — different Firebase users are different profiles
# ─────────────────────────────────────────────────────────────────────

class TestUserIsolation:

    def test_two_users_have_separate_profiles(self):
        """Two Firebase users create separate profiles."""
        uid_a, token_a = _create_emulator_user()
        uid_b, token_b = _create_emulator_user()
        username_a = unique_username()
        username_b = unique_username()

        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": username_a},
            headers=auth_header(token_a),
        )
        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": username_b},
            headers=auth_header(token_b),
        )

        resp_a = requests.get(f"{GATEWAY_URL}/profile", headers=auth_header(token_a))
        resp_b = requests.get(f"{GATEWAY_URL}/profile", headers=auth_header(token_b))

        assert resp_a.json()["username"] == username_a
        assert resp_a.json()["id"] == uid_a
        assert resp_b.json()["username"] == username_b
        assert resp_b.json()["id"] == uid_b

        # Clean up
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token_a))
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token_b))

    def test_user_b_cannot_modify_user_a(self):
        """PATCH with user B's token only affects user B's profile."""
        uid_a, token_a = _create_emulator_user()
        uid_b, token_b = _create_emulator_user()

        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": unique_username()},
            headers=auth_header(token_a),
        )
        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": unique_username()},
            headers=auth_header(token_b),
        )

        # User B updates their own bio
        requests.patch(
            f"{GATEWAY_URL}/profile",
            json={"bio": "I am user B"},
            headers=auth_header(token_b),
        )

        # User A's bio should be unchanged
        resp_a = requests.get(f"{GATEWAY_URL}/profile", headers=auth_header(token_a))
        assert resp_a.json()["bio"] is None

        # Clean up
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token_a))
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token_b))


# ─────────────────────────────────────────────────────────────────────
# Validation passthrough
# ─────────────────────────────────────────────────────────────────────

class TestValidationPassthrough:

    def test_create_bad_username_422(self):
        """Validation errors from profile-service are passed through."""
        _, token = _create_emulator_user()
        resp = requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": "ab"},  # too short
            headers=auth_header(token),
        )
        assert resp.status_code == 422

    def test_update_empty_body_422(self):
        """Empty PATCH body should be rejected by profile-service."""
        _, token = _create_emulator_user()
        username = unique_username()
        requests.post(
            f"{GATEWAY_URL}/profile",
            json={"username": username},
            headers=auth_header(token),
        )

        resp = requests.patch(
            f"{GATEWAY_URL}/profile",
            json={},
            headers=auth_header(token),
        )
        assert resp.status_code == 422

        # Clean up
        requests.delete(f"{GATEWAY_URL}/profile", headers=auth_header(token))
