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


class DeviceStateChange(BaseModel):
    device_id: str
    old_state: str
    new_state: str


# In-memory store for development; replace with DB in production
_devices: dict[str, Device] = {}


@router.get("")
async def list_devices(category: str | None = None) -> list[Device]:
    """List all registered devices, optionally filtered by category."""
    devices = list(_devices.values())
    if category:
        if category not in DEVICE_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Unknown category: {category}")
        devices = [d for d in devices if d.category == category]
    return devices


@router.get("/{device_id}")
async def get_device(device_id: str) -> Device:
    """Get a single device by ID."""
    if device_id not in _devices:
        raise HTTPException(status_code=404, detail=f"Device not found: {device_id}")
    return _devices[device_id]


@router.post("", status_code=201)
async def register_device(device: Device) -> Device:
    """Register a new AV device."""
    if device.category not in DEVICE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Unknown category: {device.category}")
    _devices[device.device_id] = device
    return device


@router.delete("/{device_id}", status_code=204)
async def remove_device(device_id: str) -> None:
    """Remove a device from the registry."""
    if device_id not in _devices:
        raise HTTPException(status_code=404, detail=f"Device not found: {device_id}")
    del _devices[device_id]
