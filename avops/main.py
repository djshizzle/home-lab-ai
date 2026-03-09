"""
AVops Webex Support Agents — FastAPI application entry point.

Startup sequence:
  1. Load secrets from AWS Secrets Manager (if prod)
  2. Configure structured logging
  3. Mount API routers
  4. Serve
"""

import os

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from avops.api.routes import devices, health, tickets, webex
from avops.aws.secrets import load_secrets_into_env
from avops.config import get_settings

# ── Load secrets (no-op in dev if use_secrets_manager=False) ─────────────────
_extra_env = load_secrets_into_env()
for k, v in _extra_env.items():
    os.environ.setdefault(k, v)

# ── Structured logging ────────────────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO
)

settings = get_settings()

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    description=(
        "Enterprise AV Operations — Webex Support Agents powered by a "
        "7-agent Claude AI architecture, backed by AWS."
    ),
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS (tighten in production via Cognito + WAF) ───────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ───────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api")
app.include_router(webex.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(devices.router, prefix="/api")

# ── Static Frontend (served from /frontend/dist in prod) ─────────────────────
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")


# ── Global exception handler ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    log = structlog.get_logger("avops.error")
    log.error("unhandled_exception", path=str(request.url), error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )


# ── Dev entrypoint ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "avops.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=True,
        log_config=None,  # Use structlog instead
    )
