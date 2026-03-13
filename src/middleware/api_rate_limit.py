"""FastAPI rate limiting middleware using slowapi (R14).

Protects the AVops API from abuse and accidental tight loops.
"""

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse

# Global limiter instance — import this in route modules.
limiter = Limiter(key_func=get_remote_address)

# Default rate limit strings for endpoint categories.
RATE_LIMITS = {
    "device_status": "120/minute",
    "device_reboot": "5/minute",
    "device_config": "10/minute",
    "upload": "10/minute",
    "rooms": "60/minute",
    "default": "60/minute",
}


def rate_limit_exceeded_handler(_request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Custom 429 response with Retry-After header."""
    retry_after = getattr(exc, "retry_after", 60)
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "detail": str(exc.detail),
            "retry_after": retry_after,
        },
        headers={"Retry-After": str(retry_after)},
    )
