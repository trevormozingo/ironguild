"""
Reaction routes.

Emoji reactions on posts. One reaction per user per post.
Supported types: strong, fire, heart, smile, laugh, thumbsup, thumbsdown, angry.
"""

from fastapi import APIRouter, Header, HTTPException, Request

from .database import get_reactions, remove_reaction, set_reaction
from .schema import validate

router = APIRouter(prefix="/posts", tags=["reactions"])


@router.put("/{post_id}/reactions", status_code=200)
async def react(post_id: str, request: Request, x_user_id: str = Header(...)):
    body = await request.json()
    errors = validate("reaction_set", body)
    if errors:
        raise HTTPException(status_code=422, detail=errors)
    doc = await set_reaction(post_id, x_user_id, body["type"])
    if doc is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"postId": post_id, "uid": x_user_id, "type": doc["type"]}


@router.delete("/{post_id}/reactions", status_code=204)
async def unreact(post_id: str, x_user_id: str = Header(...)):
    deleted = await remove_reaction(post_id, x_user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Reaction not found")


@router.get("/{post_id}/reactions")
async def list_reactions(post_id: str):
    reactions = await get_reactions(post_id)
    return {"reactions": reactions, "count": len(reactions)}
