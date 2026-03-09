"""AVops application configuration — loaded from environment or AWS Secrets Manager."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ────────────────────────────────────────────────────────────────────
    app_name: str = "AVops Webex Support Agents"
    app_env: Literal["development", "staging", "production"] = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8080
    log_level: str = "INFO"
    secret_key: str = Field(default="change-me-in-production-use-secrets-manager")

    # ── AWS ────────────────────────────────────────────────────────────────────
    aws_region: str = "us-east-1"
    aws_profile: str | None = None               # None → use IAM role in AWS
    aws_endpoint_url: str | None = None          # Override for LocalStack / testing

    # DynamoDB table names
    dynamo_tickets_table: str = "avops-support-tickets"
    dynamo_devices_table: str = "avops-devices"
    dynamo_rooms_table: str = "avops-rooms"
    dynamo_agent_state_table: str = "avops-agent-state"

    # S3
    s3_bucket_logs: str = "avops-support-logs"
    s3_bucket_reports: str = "avops-reports"
    s3_bucket_firmware: str = "avops-firmware"

    # SQS
    sqs_agent_queue_url: str = ""                # Populated from Secrets Manager in prod
    sqs_webex_event_queue_url: str = ""

    # Secrets Manager
    use_secrets_manager: bool = False            # True in staging/prod
    secrets_manager_prefix: str = "avops/"

    # ── Webex ──────────────────────────────────────────────────────────────────
    webex_bot_token: str = Field(default="", alias="WEBEX_BOT_TOKEN")
    webex_webhook_secret: str = Field(default="", alias="WEBEX_WEBHOOK_SECRET")
    webex_support_room_id: str = Field(default="", alias="WEBEX_SUPPORT_ROOM_ID")
    webex_admin_email: str = Field(default="", alias="WEBEX_ADMIN_EMAIL")

    # ── Claude / Anthropic ─────────────────────────────────────────────────────
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    claude_model: str = "claude-sonnet-4-6"      # Orchestrator + heavy agents
    claude_fast_model: str = "claude-haiku-4-5-20251001"  # Routing / triage
    claude_max_tokens: int = 8192
    agent_timeout_seconds: int = 300

    # ── Security (future corp posture) ────────────────────────────────────────
    # These are no-ops in dev; enforced in staging/prod via AWS WAF + Cognito
    enable_auth: bool = False
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:8080"]

    # ── AV Domain ─────────────────────────────────────────────────────────────
    device_ping_timeout_seconds: int = 5
    crestron_rate_limit_per_min: int = 60
    qsys_rate_limit_per_min: int = 30


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton. Import and call this everywhere."""
    return Settings()
