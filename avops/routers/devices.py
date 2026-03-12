"""Device management router."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from avops.constants.devices import DEVICE_CATEGORIES

router = APIRouter(prefix="/devices", tags=["devices"])


class Device(BaseModel):
    device_id: str
    hostname: str
    model: str
    category: str
    room_id: str
    ip_address: str
    firmware_version: str | None = None
    online: bool = False


# In-memory store for development; replace with DB in production
_devices: dict[str, Device] = {}


def _require_device(device_id: str) -> Device:
    """Return device or raise 404."""
    if device_id not in _devices:
        raise HTTPException(status_code=404, detail=f"Device not found: {device_id}")
    return _devices[device_id]


def _validate_category(category: str) -> None:
    """Raise 400 if category is not recognised."""
    if category not in DEVICE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")


@router.get("")
async def list_devices(category: str | None = None) -> list[Device]:
    """List all registered devices, optionally filtered by category."""
    if category:
        _validate_category(category)
        return [d for d in _devices.values() if d.category == category]
    return list(_devices.values())


@router.get("/{device_id}")
async def get_device(device_id: str) -> Device:
    """Get a single device by ID."""
    return _require_device(device_id)


@router.post("", status_code=201)
async def register_device(device: Device) -> Device:
    """Register a new AV device."""
    _validate_category(device.category)
    _devices[device.device_id] = device
    return device


@router.delete("/{device_id}", status_code=204)
async def remove_device(device_id: str) -> None:
    """Remove a device from the registry."""
    _require_device(device_id)
    del _devices[device_id]
