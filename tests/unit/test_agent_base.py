"""Unit tests for BaseAgent JSON parsing."""

import pytest

from avops.agents.base import BaseAgent


class TestBaseAgentJsonParsing:
    """Test the _parse_json helper without making real API calls."""

    def setup_method(self):
        # Bypass API client init — we only test _parse_json
        self.agent = object.__new__(BaseAgent)
        self.agent.name = "test"

    def test_direct_json(self):
        result = self.agent._parse_json('{"intent": "audio", "priority": "high"}')
        assert isinstance(result, dict)
        assert result["intent"] == "audio"

    def test_json_in_fence(self):
        text = '```json\n{"intent": "camera"}\n```'
        result = self.agent._parse_json(text)
        assert isinstance(result, dict)
        assert result["intent"] == "camera"

    def test_json_in_plain_fence(self):
        text = '```\n{"verdict": "APPROVE"}\n```'
        result = self.agent._parse_json(text)
        assert isinstance(result, dict)
        assert result["verdict"] == "APPROVE"

    def test_invalid_json_returns_text(self):
        text = "This is plain text with no JSON"
        result = self.agent._parse_json(text)
        assert isinstance(result, str)
        assert result == text

    def test_nested_json(self):
        text = '{"steps": [{"step": 1, "action": "ping device"}]}'
        result = self.agent._parse_json(text)
        assert isinstance(result, dict)
        assert len(result["steps"]) == 1
