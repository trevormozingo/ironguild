"""
Profile route handlers.

Validation is done by loading the JSON schemas from models/ —
no field definitions are duplicated in code.
"""

from fastapi import APIRouter, Header, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from . import database
from .schema import validate

router = APIRouter(prefix="/profile", tags=["profile"])


def _to_public(doc: dict) -> dict:
    """Shape a DB document into the public profile response."""
    return {
        "username": doc["username"],
        "displayName": doc.get("displayName"),
        "bio": doc.get("bio"),
        "birthday": doc.get("birthday"),
    }


def _to_private(doc: dict) -> dict:
    """Shape a DB document into the private profile response (owner only)."""
    return {
        "id": doc["_id"],
        "username": doc["username"],
        "displayName": doc.get("displayName"),
        "bio": doc.get("bio"),
        "birthday": doc.get("birthday"),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }


def _get_uid(x_user_id: str | None) -> str:
    """
    Extract the authenticated user's Firebase UID.
    In production, the API gateway verifies the Firebase token and
    forwards the UID as the X-User-Id header.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    return x_user_id


# --- POST /profile ---
@router.post("", status_code=201)
async def create_profile(request: Request, x_user_id: str | None = Header(None)):
    uid = _get_uid(x_user_id)
    body = await request.json()

    errors = validate("create", body)
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    try:
        doc = await database.create_profile(uid, body)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Username already taken")

    return _to_private(doc)


# --- GET /profile ---
@router.get("")
async def get_my_profile(x_user_id: str | None = Header(None)):
    uid = _get_uid(x_user_id)
    doc = await database.get_profile_by_id(uid)
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _to_private(doc)


# --- PATCH /profile ---
@router.patch("")
async def update_my_profile(request: Request, x_user_id: str | None = Header(None)):
    uid = _get_uid(x_user_id)
    body = await request.json()

    errors = validate("update", body)
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    doc = await database.update_profile(uid, body)
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _to_private(doc)


# --- DELETE /profile ---
@router.delete("", status_code=204)
async def delete_my_profile(x_user_id: str | None = Header(None)):
    uid = _get_uid(x_user_id)
    deleted = await database.delete_profile(uid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Profile not found")
    return None


# --- GET /profile/{username} ---
@router.get("/{username}")
async def get_public_profile(username: str):
    doc = await database.get_profile_by_username(username)
    if not doc:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _to_public(doc)
