"""Unit tests for application configuration."""

import os

import pytest

from avops.config import Settings, get_settings


class TestSettings:
    def test_defaults(self):
        s = Settings()
        assert s.app_env == "development"
        assert s.aws_region == "us-east-1"
        assert s.dynamo_tickets_table == "avops-support-tickets"
        assert s.claude_model == "claude-sonnet-4-6"
        assert s.use_secrets_manager is False

    def test_table_names(self):
        s = Settings()
        assert "tickets" in s.dynamo_tickets_table
        assert "devices" in s.dynamo_devices_table
        assert "agent-state" in s.dynamo_agent_state_table

    def test_rate_limits(self):
        s = Settings()
        assert s.crestron_rate_limit_per_min == 60
        assert s.qsys_rate_limit_per_min == 30

    def test_get_settings_cached(self):
        """get_settings() returns the same instance (lru_cache)."""
        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2
