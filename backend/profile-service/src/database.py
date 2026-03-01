"""
MongoDB database layer for profiles.
"""

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect(mongo_uri: str, db_name: str = "ironguild") -> None:
    """Connect to MongoDB."""
    global _client, _db
    _client = AsyncIOMotorClient(mongo_uri)
    _db = _client[db_name]

    # Ensure unique index on username
    await _db.profiles.create_index("username", unique=True)


async def disconnect() -> None:
    """Close the MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
    _client = None
    _db = None


def _collection():
    if _db is None:
        raise RuntimeError("Database not connected. Call connect() first.")
    return _db.profiles


async def create_profile(uid: str, data: dict[str, Any]) -> dict[str, Any]:
    """
    Insert a new profile document.

    Args:
        uid: Firebase user ID (used as the document _id)
        data: Validated profile fields from the create schema
    """
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": uid,
        **data,
        "displayName": data.get("displayName", data["username"]),
        "bio": data.get("bio"),
        "avatarUrl": data.get("avatarUrl"),
        "birthday": data.get("birthday"),
        "createdAt": now,
        "updatedAt": now,
    }
    await _collection().insert_one(doc)
    return doc


async def get_profile_by_username(username: str) -> dict[str, Any] | None:
    """Fetch a profile by username."""
    return await _collection().find_one({"username": username})


async def get_profile_by_id(uid: str) -> dict[str, Any] | None:
    """Fetch a profile by Firebase UID."""
    return await _collection().find_one({"_id": uid})


async def update_profile(uid: str, data: dict[str, Any]) -> dict[str, Any] | None:
    """
    Update a profile. Only provided fields are changed.

    Returns the updated document, or None if not found.
    """
    data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    result = await _collection().find_one_and_update(
        {"_id": uid},
        {"$set": data},
        return_document=True,
    )
    return result


async def delete_profile(uid: str) -> bool:
    """Delete a profile. Returns True if a document was deleted."""
    result = await _collection().delete_one({"_id": uid})
    return result.deleted_count > 0
