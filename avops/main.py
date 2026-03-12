"""AVops FastAPI application entry point.

Run locally:
    uvicorn avops.main:app --reload --port 8080
"""

from fastapi import FastAPI

from avops import __version__
from avops.routers import devices, health

app = FastAPI(
    title="AVops API",
    description="Enterprise AV device management, configuration, monitoring, and support automation",
    version=__version__,
)

app.include_router(health.router)
app.include_router(devices.router)


@app.get("/")
async def root() -> dict:
    """API root — returns version info."""
    return {"service": "avops", "version": __version__}
