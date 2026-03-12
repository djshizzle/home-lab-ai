"""Tests for the AVops FastAPI application."""

import pytest
from fastapi.testclient import TestClient

from avops.main import app
from avops.routers import devices as devices_module

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_devices():
    """Clear the in-memory device store before each test."""
    devices_module._devices.clear()
    yield
    devices_module._devices.clear()


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "avops"
    assert "version" in data


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_list_devices_empty():
    response = client.get("/devices")
    assert response.status_code == 200
    assert response.json() == []


def test_register_and_get_device():
    device_payload = {
        "device_id": "hq-conf3b-ctrl-01",
        "hostname": "av-hq-conf3b-ctrl-1.internal",
        "model": "crestron-cp4",
        "category": "ctrl",
        "room_id": "hq-3b",
        "ip_address": "10.10.3.11",
        "firmware_version": "4.0.0",
        "online": True,
    }
    response = client.post("/devices", json=device_payload)
    assert response.status_code == 201
    assert response.json()["device_id"] == "hq-conf3b-ctrl-01"

    response = client.get("/devices/hq-conf3b-ctrl-01")
    assert response.status_code == 200
    assert response.json()["model"] == "crestron-cp4"


def test_register_device_invalid_category():
    device_payload = {
        "device_id": "hq-test-xx-01",
        "hostname": "av-hq-test-xx-1.internal",
        "model": "unknown-model",
        "category": "invalid_category",
        "room_id": "hq-1a",
        "ip_address": "10.10.1.99",
    }
    response = client.post("/devices", json=device_payload)
    assert response.status_code == 400


def test_get_device_not_found():
    response = client.get("/devices/does-not-exist")
    assert response.status_code == 404


def test_list_devices_by_category():
    # Register one ctrl and one dsp device
    for payload in [
        {
            "device_id": "hq-conf1a-ctrl-01",
            "hostname": "av-hq-conf1a-ctrl-1.internal",
            "model": "crestron-cp4",
            "category": "ctrl",
            "room_id": "hq-1a",
            "ip_address": "10.10.1.11",
        },
        {
            "device_id": "hq-conf1a-dsp-01",
            "hostname": "av-hq-conf1a-dsp-1.internal",
            "model": "biamp-tesira",
            "category": "dsp",
            "room_id": "hq-1a",
            "ip_address": "10.10.1.21",
        },
    ]:
        client.post("/devices", json=payload)

    response = client.get("/devices?category=ctrl")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["category"] == "ctrl"


def test_list_devices_invalid_category():
    response = client.get("/devices?category=bogus")
    assert response.status_code == 400


def test_remove_device():
    device_payload = {
        "device_id": "hq-conf1a-dsp-01",
        "hostname": "av-hq-conf1a-dsp-1.internal",
        "model": "biamp-tesira",
        "category": "dsp",
        "room_id": "hq-1a",
        "ip_address": "10.10.1.21",
    }
    client.post("/devices", json=device_payload)

    response = client.delete("/devices/hq-conf1a-dsp-01")
    assert response.status_code == 204

    response = client.get("/devices/hq-conf1a-dsp-01")
    assert response.status_code == 404
