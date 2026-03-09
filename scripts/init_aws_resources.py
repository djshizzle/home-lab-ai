#!/usr/bin/env python3
"""
Initialize AWS resources for local development (LocalStack or real AWS).

Creates DynamoDB tables, S3 buckets, and SQS queues if they don't exist.
Run once before starting the application in a fresh environment.

Usage:
    python scripts/init_aws_resources.py
    python scripts/init_aws_resources.py --endpoint http://localhost:4566  # LocalStack
"""

import argparse
import sys

import boto3
from botocore.exceptions import ClientError


def create_dynamodb_tables(client, prefix: str):
    tables = [
        {
            "TableName": f"{prefix}-support-tickets",
            "KeySchema": [
                {"AttributeName": "ticket_id", "KeyType": "HASH"},
                {"AttributeName": "created_at", "KeyType": "RANGE"},
            ],
            "AttributeDefinitions": [
                {"AttributeName": "ticket_id", "AttributeType": "S"},
                {"AttributeName": "created_at", "AttributeType": "S"},
                {"AttributeName": "webex_room_id", "AttributeType": "S"},
                {"AttributeName": "status", "AttributeType": "S"},
            ],
            "BillingMode": "PAY_PER_REQUEST",
            "GlobalSecondaryIndexes": [
                {
                    "IndexName": "webex_room_id-created_at-index",
                    "KeySchema": [
                        {"AttributeName": "webex_room_id", "KeyType": "HASH"},
                        {"AttributeName": "created_at", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
                {
                    "IndexName": "status-created_at-index",
                    "KeySchema": [
                        {"AttributeName": "status", "KeyType": "HASH"},
                        {"AttributeName": "created_at", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                },
            ],
        },
        {
            "TableName": f"{prefix}-devices",
            "KeySchema": [
                {"AttributeName": "device_id", "KeyType": "HASH"},
                {"AttributeName": "room_id", "KeyType": "RANGE"},
            ],
            "AttributeDefinitions": [
                {"AttributeName": "device_id", "AttributeType": "S"},
                {"AttributeName": "room_id", "AttributeType": "S"},
            ],
            "BillingMode": "PAY_PER_REQUEST",
            "GlobalSecondaryIndexes": [
                {
                    "IndexName": "room_id-index",
                    "KeySchema": [{"AttributeName": "room_id", "KeyType": "HASH"}],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
        },
        {
            "TableName": f"{prefix}-rooms",
            "KeySchema": [{"AttributeName": "room_id", "KeyType": "HASH"}],
            "AttributeDefinitions": [
                {"AttributeName": "room_id", "AttributeType": "S"}
            ],
            "BillingMode": "PAY_PER_REQUEST",
        },
        {
            "TableName": f"{prefix}-agent-state",
            "KeySchema": [
                {"AttributeName": "ticket_id", "KeyType": "HASH"},
                {"AttributeName": "session_id", "KeyType": "RANGE"},
            ],
            "AttributeDefinitions": [
                {"AttributeName": "ticket_id", "AttributeType": "S"},
                {"AttributeName": "session_id", "AttributeType": "S"},
            ],
            "BillingMode": "PAY_PER_REQUEST",
        },
    ]

    for table_def in tables:
        table_name = table_def["TableName"]
        try:
            client.create_table(**table_def)
            print(f"  ✓ Created DynamoDB table: {table_name}")
        except ClientError as e:
            if e.response["Error"]["Code"] == "ResourceInUseException":
                print(f"  · Table already exists: {table_name}")
            else:
                raise


def create_s3_buckets(client, prefix: str, account: str = "000000000000"):
    buckets = [
        f"{prefix}-support-logs-{account}",
        f"{prefix}-reports-{account}",
        f"{prefix}-firmware-{account}",
    ]
    for bucket in buckets:
        try:
            client.create_bucket(Bucket=bucket)
            print(f"  ✓ Created S3 bucket: {bucket}")
        except ClientError as e:
            if e.response["Error"]["Code"] == "BucketAlreadyOwnedByYou":
                print(f"  · Bucket already exists: {bucket}")
            else:
                raise


def create_sqs_queues(client, prefix: str):
    queues = [
        f"{prefix}-agent-tasks.fifo",
        f"{prefix}-webex-events.fifo",
        f"{prefix}-agent-tasks-dlq.fifo",
        f"{prefix}-webex-events-dlq.fifo",
    ]
    for queue_name in queues:
        try:
            client.create_queue(
                QueueName=queue_name,
                Attributes={
                    "FifoQueue": "true",
                    "ContentBasedDeduplication": "false",
                },
            )
            print(f"  ✓ Created SQS queue: {queue_name}")
        except ClientError as e:
            if e.response["Error"]["Code"] == "QueueAlreadyExists":
                print(f"  · Queue already exists: {queue_name}")
            else:
                raise


def main():
    parser = argparse.ArgumentParser(description="Initialize AVops AWS resources")
    parser.add_argument("--endpoint", default=None, help="AWS endpoint URL (LocalStack)")
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--prefix", default="avops", help="Resource name prefix")
    args = parser.parse_args()

    kwargs = {"region_name": args.region}
    if args.endpoint:
        kwargs["endpoint_url"] = args.endpoint

    print(f"\nInitializing AVops AWS resources (prefix={args.prefix})")
    if args.endpoint:
        print(f"Using endpoint: {args.endpoint}")
    print()

    print("DynamoDB tables:")
    create_dynamodb_tables(boto3.client("dynamodb", **kwargs), args.prefix)

    print("\nS3 buckets:")
    create_s3_buckets(boto3.client("s3", **kwargs), args.prefix)

    print("\nSQS queues:")
    create_sqs_queues(boto3.client("sqs", **kwargs), args.prefix)

    print("\n✓ All resources initialized successfully")
    print("\nNext steps:")
    print("  1. Copy .env.example to .env and fill in WEBEX_BOT_TOKEN + ANTHROPIC_API_KEY")
    print("  2. Run: uvicorn avops.main:app --reload --port 8080")
    print("  3. Register your Webex webhook at: POST https://webexapis.com/v1/webhooks")
    print("     pointing to: https://your-domain.com/api/webhooks/webex")


if __name__ == "__main__":
    main()
