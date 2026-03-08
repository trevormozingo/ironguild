"""
Follow routes.

One-way follow model (Instagram-style).
Both follower and target must have existing profiles.
"""

from fastapi import APIRouter, Header, HTTPException

from .database import follow_user, get_followers, get_following, unfollow_user

router = APIRouter(prefix="/follows", tags=["follows"])


@router.post("/{uid}", status_code=201)
async def follow(uid: str, x_user_id: str = Header(...)):
    if x_user_id == uid:
        raise HTTPException(status_code=422, detail="Cannot follow yourself")
    result = await follow_user(x_user_id, uid)
    if result is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    if result is False:
        raise HTTPException(status_code=409, detail="Already following")
    return {"followerUid": x_user_id, "followingUid": uid}


@router.delete("/{uid}", status_code=204)
async def unfollow(uid: str, x_user_id: str = Header(...)):
    deleted = await unfollow_user(x_user_id, uid)
    if not deleted:
        raise HTTPException(status_code=404, detail="Not following this user")


@router.get("/following")
async def list_following(x_user_id: str = Header(...)):
    uids = await get_following(x_user_id)
    return {"following": uids, "count": len(uids)}


@router.get("/followers")
async def list_followers(x_user_id: str = Header(...)):
    uids = await get_followers(x_user_id)
    return {"followers": uids, "count": len(uids)}
