"""Health and readiness check endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

from avops.config import get_settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    app: str
    env: str
    version: str = "0.1.0"


@router.get("/health", response_model=HealthResponse)
async def health_check():
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        env=settings.app_env,
    )


@router.get("/ready")
async def readiness_check():
    """Verify downstream dependencies are reachable (AWS, Webex)."""
    checks: dict[str, str] = {}

    # AWS DynamoDB check
    try:
        from avops.aws.client import get_dynamodb_client  # noqa: PLC0415

        get_dynamodb_client().list_tables(Limit=1)
        checks["dynamodb"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["dynamodb"] = f"error: {exc!s}"

    # Webex bot token check
    try:
        from avops.webex.client import get_bot_me  # noqa: PLC0415

        me = get_bot_me()
        checks["webex"] = "ok" if me else "error: no bot identity"
    except Exception as exc:  # noqa: BLE001
        checks["webex"] = f"error: {exc!s}"

    # Anthropic API key present
    settings = get_settings()
    checks["anthropic"] = "ok" if settings.anthropic_api_key else "missing API key"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}
