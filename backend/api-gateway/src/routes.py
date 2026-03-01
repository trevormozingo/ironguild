"""
API Gateway route handlers.

All incoming requests go through:
  1. Auth extraction — Bearer token → Firebase UID
  2. Proxy — forward to the appropriate backend service with X-User-Id header

Routes:
  /profile/**  → profile-service
  /health      → gateway health check (no auth)
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from .auth import verify_token
from .proxy import forward_request

router = APIRouter()


def _extract_bearer_token(request: Request) -> str | None:
    """Extract the Bearer token from the Authorization header."""
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None


def _require_auth(request: Request) -> str:
    """
    Verify the Bearer token and return the Firebase UID.
    Raises 401 if missing/invalid.
    """
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    try:
        claims = verify_token(token)
        return claims["uid"]
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


def _optional_auth(request: Request) -> str | None:
    """
    Try to extract a UID from the Bearer token. Returns None if no token present.
    Raises 401 only if a token IS present but invalid.
    """
    token = _extract_bearer_token(request)
    if not token:
        return None
    try:
        claims = verify_token(token)
        return claims["uid"]
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


async def _proxy_to_service(
    service: str,
    path: str,
    request: Request,
    uid: str | None = None,
):
    """
    Forward the request to a backend service and return the response.
    Injects X-User-Id if a UID is provided.
    """
    # Build headers to forward
    headers = dict(request.headers)
    if uid:
        headers["x-user-id"] = uid
    # Remove the original Authorization header — backend services don't need it
    headers.pop("authorization", None)

    body = await request.body() if request.method in ("POST", "PATCH", "PUT") else None

    try:
        resp = await forward_request(
            service=service,
            path=path,
            method=request.method,
            headers=headers,
            body=body,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception:
        raise HTTPException(status_code=502, detail="Backend service unavailable")

    # Forward the backend response as-is
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers={
            k: v
            for k, v in resp.headers.items()
            if k.lower() not in ("transfer-encoding", "connection")
        },
    )


# ─────────────────────────────────────────────────────────────────────
# Profile routes — auth required for mutations, optional for public
# ─────────────────────────────────────────────────────────────────────

@router.post("/profile")
async def create_profile(request: Request):
    """Create a profile — requires auth."""
    uid = _require_auth(request)
    return await _proxy_to_service("profile", "", request, uid)


@router.get("/profile")
async def get_my_profile(request: Request):
    """Get own profile — requires auth."""
    uid = _require_auth(request)
    return await _proxy_to_service("profile", "", request, uid)


@router.patch("/profile")
async def update_my_profile(request: Request):
    """Update own profile — requires auth."""
    uid = _require_auth(request)
    return await _proxy_to_service("profile", "", request, uid)


@router.delete("/profile")
async def delete_my_profile(request: Request):
    """Delete own profile — requires auth."""
    uid = _require_auth(request)
    return await _proxy_to_service("profile", "", request, uid)


@router.get("/profile/{username}")
async def get_public_profile(username: str, request: Request):
    """Get a public profile by username — no auth required."""
    return await _proxy_to_service("profile", f"/{username}", request)
