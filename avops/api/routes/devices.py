"""Device inventory endpoints — list, register, update status."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from avops.aws.dynamodb import DeviceStore
from avops.constants.devices import DeviceStatus

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceRegisterRequest(BaseModel):
    device_id: str                # e.g. hq-conf3b-ctrl-01
    room_id: str                  # e.g. hq-031
    model: str                    # e.g. cisco-board-pro-55
    vendor: str
    hostname: str = ""
    ip_address: str = ""
    firmware_version: str = ""
    webex_supported: bool = False
    status: str = DeviceStatus.UNKNOWN


class DeviceStatusUpdate(BaseModel):
    status: str


@router.get("")
async def list_devices():
    """List all Webex-capable devices across the estate."""
    store = DeviceStore()
    devices = store.list_webex_devices()
    return {"devices": devices, "count": len(devices)}


@router.get("/room/{room_id}")
async def devices_by_room(room_id: str):
    """List all AV devices in a specific room."""
    store = DeviceStore()
    devices = store.list_by_room(room_id)
    return {"room_id": room_id, "devices": devices, "count": len(devices)}


@router.get("/{device_id}")
async def get_device(device_id: str, room_id: str):
    """Retrieve a specific device record."""
    store = DeviceStore()
    device = store.get(device_id, room_id)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    return device


@router.post("")
async def register_device(body: DeviceRegisterRequest):
    """Register or update a device in the inventory."""
    store = DeviceStore()
    device = body.model_dump()
    store.put(device)
    return {"status": "registered", "device_id": body.device_id}


@router.patch("/{device_id}/status")
async def update_device_status(device_id: str, room_id: str, body: DeviceStatusUpdate):
    """Update device operational status."""
    store = DeviceStore()
    device = store.get(device_id, room_id)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
    store.update_status(device_id, room_id, body.status)
    return {"device_id": device_id, "status": body.status}
