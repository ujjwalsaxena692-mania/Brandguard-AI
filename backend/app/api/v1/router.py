from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import knowledge, organisation, submissions, system

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(system.router)
api_v1_router.include_router(organisation.router)
api_v1_router.include_router(knowledge.router)
api_v1_router.include_router(submissions.router)
