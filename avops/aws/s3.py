"""S3 helpers — log archival, report storage, firmware files."""

import json
from datetime import UTC, datetime
from typing import Any

import structlog

from avops.aws.client import get_s3
from avops.config import get_settings

log = structlog.get_logger(__name__)


def _key_prefix() -> str:
    now = datetime.now(UTC)
    return f"{now.year}/{now.month:02d}/{now.day:02d}"


class LogStore:
    """Archive ticket conversation logs to S3."""

    def __init__(self):
        self._s3 = get_s3()
        self._bucket = get_settings().s3_bucket_logs

    def save_ticket_log(self, ticket_id: str, payload: dict[str, Any]) -> str:
        key = f"{_key_prefix()}/tickets/{ticket_id}.json"
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=json.dumps(payload, default=str),
            ContentType="application/json",
            ServerSideEncryption="AES256",
        )
        log.info("s3.log_saved", bucket=self._bucket, key=key)
        return key

    def save_agent_transcript(self, ticket_id: str, session_id: str, transcript: str) -> str:
        key = f"{_key_prefix()}/transcripts/{ticket_id}/{session_id}.txt"
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=transcript.encode(),
            ContentType="text/plain",
            ServerSideEncryption="AES256",
        )
        log.info("s3.transcript_saved", key=key)
        return key


class ReportStore:
    """Store generated AV support reports."""

    def __init__(self):
        self._s3 = get_s3()
        self._bucket = get_settings().s3_bucket_reports

    def save_report(self, report_type: str, content: str, fmt: str = "md") -> str:
        key = f"{_key_prefix()}/{report_type}/{datetime.now(UTC).isoformat()}.{fmt}"
        self._s3.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=content.encode(),
            ContentType="text/plain" if fmt == "md" else "application/json",
            ServerSideEncryption="AES256",
        )
        log.info("s3.report_saved", key=key)
        return key

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )


class FirmwareStore:
    """Firmware file storage and retrieval."""

    def __init__(self):
        self._s3 = get_s3()
        self._bucket = get_settings().s3_bucket_firmware

    def list_firmware(self, vendor: str | None = None) -> list[dict[str, Any]]:
        prefix = f"{vendor}/" if vendor else ""
        resp = self._s3.list_objects_v2(Bucket=self._bucket, Prefix=prefix)
        return [
            {
                "key": obj["Key"],
                "size_bytes": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            }
            for obj in resp.get("Contents", [])
        ]

    def get_download_url(self, key: str, expires_in: int = 3600) -> str:
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )
