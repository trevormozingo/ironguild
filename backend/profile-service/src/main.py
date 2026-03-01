"""
Profile service entry point.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .database import connect, disconnect
from .routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGO_DB", "ironguild")
    await connect(mongo_uri, db_name)
    yield
    await disconnect()


app = FastAPI(
    title="IronGuild Profile Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}
