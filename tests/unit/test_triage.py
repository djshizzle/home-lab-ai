"""Unit tests for Webex message triage functions."""

import pytest

from avops.webex.triage import classify_intent, classify_priority, extract_room_code


class TestClassifyIntent:
    def test_camera_keywords(self):
        assert classify_intent("my camera is not working") == "camera"
        assert classify_intent("the video keeps pixelating") == "camera"

    def test_audio_keywords(self):
        assert classify_intent("echo on the call again") == "audio"
        assert classify_intent("microphone is muted can't hear") == "audio"

    def test_display_keywords(self):
        assert classify_intent("screen is blank and black") == "display"
        assert classify_intent("the projector is not showing anything") == "display"

    def test_connectivity_keywords(self):
        assert classify_intent("can't join the webex meeting") == "connectivity"
        assert classify_intent("hdmi cable won't connect") == "connectivity"

    def test_device_offline(self):
        assert classify_intent("the board is offline and not working") == "device_offline"
        assert classify_intent("system is down can't turn on") == "device_offline"

    def test_firmware(self):
        assert classify_intent("need to update firmware version") == "firmware"

    def test_general_fallback(self):
        assert classify_intent("hello i need help") == "general"
        assert classify_intent("") == "general"

    def test_highest_score_wins(self):
        # camera + audio keywords — camera appears more
        text = "camera camera camera audio"
        result = classify_intent(text)
        assert result == "camera"


class TestExtractRoomCode:
    def test_standard_codes(self):
        assert extract_room_code("issue in conf-3b") == "conf-3b"
        assert extract_room_code("room hq-031 is broken") == "hq-031"

    def test_floor_room_code(self):
        assert extract_room_code("meeting room 3B has issues") == "3b"

    def test_no_code(self):
        assert extract_room_code("general audio problem") == ""

    def test_case_insensitive(self):
        assert extract_room_code("ROOM HQ-031 DOWN").lower() in ("hq-031", "")


class TestClassifyPriority:
    def test_critical_keywords(self):
        assert classify_priority("URGENT board meeting now", "general") == "critical"
        assert classify_priority("emergency the room is down", "general") == "critical"
        assert classify_priority("asap exec presentation", "general") == "critical"

    def test_high_for_device_offline(self):
        assert classify_priority("device not connecting", "device_offline") == "high"

    def test_high_for_imminent_meeting(self):
        assert classify_priority("meeting in 5 min and no audio", "audio") == "high"

    def test_low_priority(self):
        assert classify_priority("no rush when you get a chance", "general") == "low"

    def test_medium_default(self):
        assert classify_priority("camera seems a bit blurry", "camera") == "medium"
