"""
Comprehensive integration tests for the profile service API.

Covers all endpoints: POST, GET, PATCH, DELETE /profile and GET /profile/{username}
Tests validation (good + bad data), auth, updates, deletes, and edge cases.
"""

import os
import time
import uuid

import requests
from pymongo import MongoClient

SERVICE_URL = os.getenv("SERVICE_URL", "http://localhost:8000")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "ironguild_test")


def get_db():
    client = MongoClient(MONGO_URI)
    return client[MONGO_DB]


def fresh_uid():
    """Generate a unique fake Firebase UID for test isolation."""
    return f"test-uid-{uuid.uuid4().hex[:12]}"


def setup_module():
    """Clean slate before tests."""
    get_db().profiles.delete_many({})


def teardown_module():
    """Clean up after all tests."""
    get_db().profiles.delete_many({})


# ─────────────────────────────────────────────────────────────────────
# POST /profile — Create
# ─────────────────────────────────────────────────────────────────────

class TestCreateProfile:

    def test_create_valid_profile(self):
        """POST with valid username returns 201 and correct response shape."""
        uid = fresh_uid()
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "warrior01"},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["id"] == uid
        assert body["username"] == "warrior01"
        assert body["displayName"] == "warrior01"  # defaults to username
        assert body["bio"] is None
        assert body["birthday"] is None
        assert "createdAt" in body
        assert "updatedAt" in body

    def test_create_stores_in_mongodb(self):
        """Profile document should exist in MongoDB after creation."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "dbcheck01"},
            headers={"X-User-Id": uid},
        )
        doc = get_db().profiles.find_one({"_id": uid})
        assert doc is not None
        assert doc["username"] == "dbcheck01"
        assert "createdAt" in doc
        assert "updatedAt" in doc

    def test_create_duplicate_username_409(self):
        """Two profiles with the same username should return 409."""
        uid1 = fresh_uid()
        uid2 = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "dupeuser"},
            headers={"X-User-Id": uid1},
        )
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "dupeuser"},
            headers={"X-User-Id": uid2},
        )
        assert resp.status_code == 409

    def test_create_duplicate_uid_fails(self):
        """Same UID creating a second profile should fail (duplicate _id)."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "firstprofile"},
            headers={"X-User-Id": uid},
        )
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "secondprofile"},
            headers={"X-User-Id": uid},
        )
        # MongoDB _id uniqueness should cause a conflict
        assert resp.status_code in (409, 500)

    def test_create_no_auth_401(self):
        """POST without X-User-Id header returns 401."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "noauth"},
        )
        assert resp.status_code == 401

    # --- Validation: missing fields ---

    def test_create_empty_body_422(self):
        """POST with empty body should return 422 (username is required)."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 422

    def test_create_missing_username_422(self):
        """POST without username field returns 422."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"bio": "hello"},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 422

    # --- Validation: bad username values ---

    def test_create_username_too_short_422(self):
        """Username under 3 chars should be rejected."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "ab"},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 422

    def test_create_username_too_long_422(self):
        """Username over 30 chars should be rejected."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "a" * 31},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 422

    def test_create_username_invalid_chars_422(self):
        """Username with spaces or special chars should be rejected."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "bad user!"},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 422

    def test_create_username_valid_pattern(self):
        """Username with allowed chars (alphanumeric, underscore, hyphen) should pass."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "valid_user-01"},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 201

    def test_create_username_boundary_3_chars(self):
        """Username exactly 3 chars should be accepted."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "abc"},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 201

    def test_create_username_boundary_30_chars(self):
        """Username exactly 30 chars should be accepted."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "a" * 30},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 201

    # --- Validation: extra fields / wrong types ---

    def test_create_extra_fields_422(self):
        """Sending fields not in the create schema should be rejected."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "extrafields", "role": "admin"},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 422

    def test_create_wrong_type_422(self):
        """Username as a number should be rejected."""
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": 12345},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 422


# ─────────────────────────────────────────────────────────────────────
# GET /profile — Own profile (authed)
# ─────────────────────────────────────────────────────────────────────

class TestGetOwnProfile:

    def test_get_own_profile(self):
        """GET /profile returns the authenticated user's full profile."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "getme01"},
            headers={"X-User-Id": uid},
        )
        resp = requests.get(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == uid
        assert body["username"] == "getme01"
        assert "createdAt" in body
        assert "updatedAt" in body

    def test_get_own_profile_no_auth_401(self):
        """GET /profile without auth returns 401."""
        resp = requests.get(f"{SERVICE_URL}/profile")
        assert resp.status_code == 401

    def test_get_own_profile_not_found_404(self):
        """GET /profile for a UID with no profile returns 404."""
        resp = requests.get(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────
# GET /profile/{username} — Public profile
# ─────────────────────────────────────────────────────────────────────

class TestGetPublicProfile:

    def test_get_public_profile(self):
        """GET /profile/{username} returns public fields only."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "public01"},
            headers={"X-User-Id": uid},
        )
        resp = requests.get(f"{SERVICE_URL}/profile/public01")
        assert resp.status_code == 200
        body = resp.json()
        assert body["username"] == "public01"
        assert body["displayName"] is not None
        # Public profile should NOT expose these
        assert "id" not in body
        assert "createdAt" not in body
        assert "updatedAt" not in body

    def test_get_public_profile_not_found_404(self):
        """GET /profile/{username} for a nonexistent user returns 404."""
        resp = requests.get(f"{SERVICE_URL}/profile/nonexistentuser999")
        assert resp.status_code == 404

    def test_get_public_profile_no_auth_required(self):
        """GET /profile/{username} should work without auth headers."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "noauth01"},
            headers={"X-User-Id": uid},
        )
        resp = requests.get(f"{SERVICE_URL}/profile/noauth01")
        assert resp.status_code == 200

    def test_public_profile_shows_updated_fields(self):
        """Public profile should reflect updates made via PATCH."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "public02"},
            headers={"X-User-Id": uid},
        )
        requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": "Public bio", "displayName": "Public Name"},
            headers={"X-User-Id": uid},
        )
        resp = requests.get(f"{SERVICE_URL}/profile/public02")
        assert resp.status_code == 200
        body = resp.json()
        assert body["bio"] == "Public bio"
        assert body["displayName"] == "Public Name"


# ─────────────────────────────────────────────────────────────────────
# PATCH /profile — Update
# ─────────────────────────────────────────────────────────────────────

class TestUpdateProfile:

    def _create_user(self, username):
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": username},
            headers={"X-User-Id": uid},
        )
        return uid

    def test_update_display_name(self):
        """PATCH with displayName should update it."""
        uid = self._create_user("patch01")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"displayName": "New Name"},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 200
        assert resp.json()["displayName"] == "New Name"

    def test_update_bio(self):
        """PATCH with bio should update it."""
        uid = self._create_user("patch02")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": "I lift heavy things."},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 200
        assert resp.json()["bio"] == "I lift heavy things."

    def test_update_birthday(self):
        """PATCH with birthday should update it."""
        uid = self._create_user("patch03")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"birthday": "1995-06-15"},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 200
        assert resp.json()["birthday"] == "1995-06-15"

    def test_update_multiple_fields(self):
        """PATCH with multiple fields should update all of them."""
        uid = self._create_user("patch04")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={
                "displayName": "Updated Name",
                "bio": "Updated bio",
                "birthday": "2000-01-01",
            },
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["displayName"] == "Updated Name"
        assert body["bio"] == "Updated bio"
        assert body["birthday"] == "2000-01-01"

    def test_update_persists_in_mongodb(self):
        """Updated values should be reflected in MongoDB."""
        uid = self._create_user("patch05")
        requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": "Persisted bio"},
            headers={"X-User-Id": uid},
        )
        doc = get_db().profiles.find_one({"_id": uid})
        assert doc["bio"] == "Persisted bio"

    def test_update_changes_updated_at(self):
        """PATCH should update the updatedAt timestamp."""
        uid = self._create_user("patch06")
        resp1 = requests.get(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        original_updated = resp1.json()["updatedAt"]

        time.sleep(0.1)

        requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": "Triggers timestamp update"},
            headers={"X-User-Id": uid},
        )
        resp2 = requests.get(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        assert resp2.json()["updatedAt"] != original_updated

    def test_update_set_bio_to_null(self):
        """PATCH bio to null should clear it."""
        uid = self._create_user("patch07")
        requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": "Something"},
            headers={"X-User-Id": uid},
        )
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": None},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 200
        assert resp.json()["bio"] is None

    def test_update_set_birthday_to_null(self):
        """PATCH birthday to null should clear it."""
        uid = self._create_user("patch07b")
        requests.patch(
            f"{SERVICE_URL}/profile",
            json={"birthday": "1990-01-01"},
            headers={"X-User-Id": uid},
        )
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"birthday": None},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 200
        assert resp.json()["birthday"] is None

    def test_update_does_not_change_username(self):
        """Username should remain the same after an update."""
        uid = self._create_user("patch_keep_name")
        requests.patch(
            f"{SERVICE_URL}/profile",
            json={"displayName": "Changed"},
            headers={"X-User-Id": uid},
        )
        resp = requests.get(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        assert resp.json()["username"] == "patch_keep_name"

    # --- Validation: bad update data ---

    def test_update_empty_body_422(self):
        """PATCH with empty body should return 422 (minProperties: 1)."""
        uid = self._create_user("patch08")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 422

    def test_update_extra_fields_422(self):
        """PATCH with fields not in update schema should be rejected."""
        uid = self._create_user("patch09")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"username": "hacked"},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 422

    def test_update_display_name_too_long_422(self):
        """displayName over 100 chars should be rejected."""
        uid = self._create_user("patch10")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"displayName": "x" * 101},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 422

    def test_update_bio_too_long_422(self):
        """Bio over 500 chars should be rejected."""
        uid = self._create_user("patch11")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": "x" * 501},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 422

    def test_update_display_name_empty_string_422(self):
        """displayName as empty string should be rejected (minLength: 1)."""
        uid = self._create_user("patch12")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"displayName": ""},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 422

    def test_update_wrong_type_422(self):
        """bio as a number should be rejected."""
        uid = self._create_user("patch13")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": 12345},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 422

    def test_update_invalid_birthday_format_422(self):
        """birthday with invalid date format should be rejected."""
        uid = self._create_user("patch14")
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"birthday": "not-a-date"},
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 422

    # --- Auth & not found ---

    def test_update_no_auth_401(self):
        """PATCH without auth returns 401."""
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": "no auth"},
        )
        assert resp.status_code == 401

    def test_update_nonexistent_profile_404(self):
        """PATCH for a UID with no profile returns 404."""
        resp = requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": "ghost"},
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────
# DELETE /profile
# ─────────────────────────────────────────────────────────────────────

class TestDeleteProfile:

    def test_delete_profile(self):
        """DELETE /profile should remove the profile and return 204."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "delete01"},
            headers={"X-User-Id": uid},
        )
        resp = requests.delete(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 204

    def test_delete_removes_from_mongodb(self):
        """Deleted profile should not exist in MongoDB."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "delete02"},
            headers={"X-User-Id": uid},
        )
        requests.delete(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        doc = get_db().profiles.find_one({"_id": uid})
        assert doc is None

    def test_delete_then_get_returns_404(self):
        """GET /profile after delete should return 404."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "delete03"},
            headers={"X-User-Id": uid},
        )
        requests.delete(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        resp = requests.get(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 404

    def test_delete_then_public_returns_404(self):
        """GET /profile/{username} after delete should return 404."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "delete04"},
            headers={"X-User-Id": uid},
        )
        requests.delete(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        resp = requests.get(f"{SERVICE_URL}/profile/delete04")
        assert resp.status_code == 404

    def test_delete_nonexistent_404(self):
        """DELETE for a UID with no profile returns 404."""
        resp = requests.delete(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": fresh_uid()},
        )
        assert resp.status_code == 404

    def test_delete_no_auth_401(self):
        """DELETE without auth returns 401."""
        resp = requests.delete(f"{SERVICE_URL}/profile")
        assert resp.status_code == 401

    def test_delete_idempotent(self):
        """Deleting the same profile twice should return 404 on second call."""
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "delete05"},
            headers={"X-User-Id": uid},
        )
        requests.delete(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        resp = requests.delete(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid},
        )
        assert resp.status_code == 404

    def test_username_available_after_delete(self):
        """After deleting a profile, the username should be available for reuse."""
        uid1 = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "reuse_me"},
            headers={"X-User-Id": uid1},
        )
        requests.delete(
            f"{SERVICE_URL}/profile",
            headers={"X-User-Id": uid1},
        )
        uid2 = fresh_uid()
        resp = requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": "reuse_me"},
            headers={"X-User-Id": uid2},
        )
        assert resp.status_code == 201


# ─────────────────────────────────────────────────────────────────────
# Profile isolation — user can only access/modify their own profile
# ─────────────────────────────────────────────────────────────────────

class TestProfileIsolation:

    def _create_user(self, username):
        uid = fresh_uid()
        requests.post(
            f"{SERVICE_URL}/profile",
            json={"username": username},
            headers={"X-User-Id": uid},
        )
        return uid

    def test_get_own_profile_only(self):
        """GET /profile returns YOUR profile, not someone else's."""
        uid_a = self._create_user("iso_user_a")
        uid_b = self._create_user("iso_user_b")

        resp_a = requests.get(f"{SERVICE_URL}/profile", headers={"X-User-Id": uid_a})
        resp_b = requests.get(f"{SERVICE_URL}/profile", headers={"X-User-Id": uid_b})

        assert resp_a.json()["username"] == "iso_user_a"
        assert resp_b.json()["username"] == "iso_user_b"
        assert resp_a.json()["id"] == uid_a
        assert resp_b.json()["id"] == uid_b

    def test_patch_only_affects_own_profile(self):
        """PATCH /profile with user B's token should NOT change user A's profile."""
        uid_a = self._create_user("iso_patch_a")
        uid_b = self._create_user("iso_patch_b")

        # User B updates their own bio
        requests.patch(
            f"{SERVICE_URL}/profile",
            json={"bio": "I am user B"},
            headers={"X-User-Id": uid_b},
        )

        # User A's profile should be untouched
        resp_a = requests.get(f"{SERVICE_URL}/profile", headers={"X-User-Id": uid_a})
        assert resp_a.json()["bio"] is None
        assert resp_a.json()["username"] == "iso_patch_a"

    def test_delete_only_affects_own_profile(self):
        """DELETE /profile with user B's token should NOT delete user A's profile."""
        uid_a = self._create_user("iso_del_a")
        uid_b = self._create_user("iso_del_b")

        # User B deletes their own profile
        requests.delete(f"{SERVICE_URL}/profile", headers={"X-User-Id": uid_b})

        # User A's profile should still exist
        resp_a = requests.get(f"{SERVICE_URL}/profile", headers={"X-User-Id": uid_a})
        assert resp_a.status_code == 200
        assert resp_a.json()["username"] == "iso_del_a"

        # User B's profile should be gone
        resp_b = requests.get(f"{SERVICE_URL}/profile", headers={"X-User-Id": uid_b})
        assert resp_b.status_code == 404

    def test_no_way_to_patch_another_users_profile(self):
        """There is no endpoint to PATCH another user's profile by username."""
        uid_a = self._create_user("iso_nopatch_a")
        uid_b = self._create_user("iso_nopatch_b")

        # Attempt to PATCH /profile/iso_nopatch_a (this should NOT be a valid route)
        resp = requests.patch(
            f"{SERVICE_URL}/profile/iso_nopatch_a",
            json={"bio": "hacked"},
            headers={"X-User-Id": uid_b},
        )
        # Should be 405 (Method Not Allowed) since GET is the only method on /profile/{username}
        assert resp.status_code == 405

    def test_no_way_to_delete_another_users_profile(self):
        """There is no endpoint to DELETE another user's profile by username."""
        uid_a = self._create_user("iso_nodel_a")
        uid_b = self._create_user("iso_nodel_b")

        resp = requests.delete(
            f"{SERVICE_URL}/profile/iso_nodel_a",
            headers={"X-User-Id": uid_b},
        )
        assert resp.status_code == 405

        # Verify user A's profile is untouched
        resp_a = requests.get(f"{SERVICE_URL}/profile/iso_nodel_a")
        assert resp_a.status_code == 200


# ─────────────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────────────

class TestHealth:

    def test_health_endpoint(self):
        """GET /health should return 200."""
        resp = requests.get(f"{SERVICE_URL}/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
