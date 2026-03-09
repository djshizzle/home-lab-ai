"""AWS client factory — centralised boto3 session management."""

from functools import lru_cache
from typing import Any

import boto3
import structlog
from botocore.config import Config

from avops.config import get_settings

log = structlog.get_logger(__name__)


def _boto_session() -> boto3.Session:
    settings = get_settings()
    kwargs: dict[str, Any] = {"region_name": settings.aws_region}
    if settings.aws_profile:
        kwargs["profile_name"] = settings.aws_profile
    return boto3.Session(**kwargs)


def _client_kwargs() -> dict[str, Any]:
    settings = get_settings()
    kwargs: dict[str, Any] = {
        "config": Config(
            retries={"max_attempts": 3, "mode": "adaptive"},
            connect_timeout=5,
            read_timeout=10,
        )
    }
    if settings.aws_endpoint_url:
        kwargs["endpoint_url"] = settings.aws_endpoint_url
    return kwargs


@lru_cache
def get_dynamodb():
    """Return cached DynamoDB resource."""
    return _boto_session().resource("dynamodb", **_client_kwargs())


@lru_cache
def get_dynamodb_client():
    """Return cached DynamoDB low-level client."""
    return _boto_session().client("dynamodb", **_client_kwargs())


@lru_cache
def get_s3():
    """Return cached S3 client."""
    return _boto_session().client("s3", **_client_kwargs())


@lru_cache
def get_sqs():
    """Return cached SQS client."""
    return _boto_session().client("sqs", **_client_kwargs())


@lru_cache
def get_secrets_manager():
    """Return cached Secrets Manager client."""
    return _boto_session().client("secretsmanager", **_client_kwargs())
