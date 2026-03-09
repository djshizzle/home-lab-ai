"""
AWS CDK Stack — AVops Webex Support Agents

Provisions all AWS infrastructure required for the AVops support system:
  - DynamoDB tables (tickets, devices, rooms, agent-state)
  - S3 buckets (logs, reports, firmware)
  - SQS FIFO queues (agent tasks, Webex events)
  - Secrets Manager secrets (Webex, Anthropic, SQS URLs)
  - IAM roles with least-privilege policies
  - (Optional) ECS Fargate service for API + worker

Future corp AI security posture additions are marked with # SECURITY-UPGRADE
"""

import aws_cdk as cdk
from aws_cdk import (
    Duration,
    RemovalPolicy,
    Stack,
    aws_dynamodb as dynamodb,
    aws_iam as iam,
    aws_s3 as s3,
    aws_secretsmanager as sm,
    aws_sqs as sqs,
)
from constructs import Construct


class AvopsWebexSupportStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        env_name = self.node.try_get_context("env") or "dev"
        prefix = f"avops-{env_name}"

        # ── DynamoDB Tables ───────────────────────────────────────────────────

        # Support Tickets table
        self.tickets_table = dynamodb.Table(
            self,
            "TicketsTable",
            table_name=f"{prefix}-support-tickets",
            partition_key=dynamodb.Attribute(
                name="ticket_id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="created_at", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,  # Never delete tickets
            point_in_time_recovery=True,
            # SECURITY-UPGRADE: enable_server_side_encryption=True + CMK
        )

        # GSI: query by Webex room
        self.tickets_table.add_global_secondary_index(
            index_name="webex_room_id-created_at-index",
            partition_key=dynamodb.Attribute(
                name="webex_room_id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="created_at", type=dynamodb.AttributeType.STRING
            ),
        )

        # GSI: query by status
        self.tickets_table.add_global_secondary_index(
            index_name="status-created_at-index",
            partition_key=dynamodb.Attribute(
                name="status", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="created_at", type=dynamodb.AttributeType.STRING
            ),
        )

        # Devices table
        self.devices_table = dynamodb.Table(
            self,
            "DevicesTable",
            table_name=f"{prefix}-devices",
            partition_key=dynamodb.Attribute(
                name="device_id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="room_id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,
            point_in_time_recovery=True,
        )

        # GSI: query all devices by room
        self.devices_table.add_global_secondary_index(
            index_name="room_id-index",
            partition_key=dynamodb.Attribute(
                name="room_id", type=dynamodb.AttributeType.STRING
            ),
        )

        # Rooms table
        self.rooms_table = dynamodb.Table(
            self,
            "RoomsTable",
            table_name=f"{prefix}-rooms",
            partition_key=dynamodb.Attribute(
                name="room_id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,
        )

        # Agent State table (session tracking)
        self.agent_state_table = dynamodb.Table(
            self,
            "AgentStateTable",
            table_name=f"{prefix}-agent-state",
            partition_key=dynamodb.Attribute(
                name="ticket_id", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="session_id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,  # Ephemeral session state
            time_to_live_attribute="ttl",  # Auto-expire old sessions
        )

        # ── S3 Buckets ────────────────────────────────────────────────────────

        bucket_common = {
            "encryption": s3.BucketEncryption.S3_MANAGED,
            # SECURITY-UPGRADE: change to S3_KMS with CMK
            "block_public_access": s3.BlockPublicAccess.BLOCK_ALL,
            "enforce_ssl": True,
            "versioned": True,
        }

        self.logs_bucket = s3.Bucket(
            self,
            "LogsBucket",
            bucket_name=f"{prefix}-support-logs-{self.account}",
            lifecycle_rules=[
                s3.LifecycleRule(
                    expiration=Duration.days(365),
                    transitions=[
                        s3.Transition(
                            storage_class=s3.StorageClass.INFREQUENT_ACCESS,
                            transition_after=Duration.days(30),
                        )
                    ],
                )
            ],
            removal_policy=RemovalPolicy.RETAIN,
            **bucket_common,
        )

        self.reports_bucket = s3.Bucket(
            self,
            "ReportsBucket",
            bucket_name=f"{prefix}-reports-{self.account}",
            lifecycle_rules=[
                s3.LifecycleRule(expiration=Duration.days(730))
            ],
            removal_policy=RemovalPolicy.RETAIN,
            **bucket_common,
        )

        self.firmware_bucket = s3.Bucket(
            self,
            "FirmwareBucket",
            bucket_name=f"{prefix}-firmware-{self.account}",
            removal_policy=RemovalPolicy.RETAIN,
            **bucket_common,
        )

        # ── SQS FIFO Queues ───────────────────────────────────────────────────

        # Dead-letter queues
        agent_dlq = sqs.Queue(
            self,
            "AgentDLQ",
            queue_name=f"{prefix}-agent-tasks-dlq.fifo",
            fifo=True,
            retention_period=Duration.days(14),
        )

        webex_event_dlq = sqs.Queue(
            self,
            "WebexEventDLQ",
            queue_name=f"{prefix}-webex-events-dlq.fifo",
            fifo=True,
            retention_period=Duration.days(7),
        )

        # Agent task queue (FIFO — one workflow per ticket at a time)
        self.agent_queue = sqs.Queue(
            self,
            "AgentTaskQueue",
            queue_name=f"{prefix}-agent-tasks.fifo",
            fifo=True,
            content_based_deduplication=False,  # Use explicit dedup IDs
            visibility_timeout=Duration.minutes(10),  # Agent workflow timeout
            dead_letter_queue=sqs.DeadLetterQueue(
                max_receive_count=3, queue=agent_dlq
            ),
        )

        # Webex event buffer queue
        self.webex_event_queue = sqs.Queue(
            self,
            "WebexEventQueue",
            queue_name=f"{prefix}-webex-events.fifo",
            fifo=True,
            content_based_deduplication=False,
            visibility_timeout=Duration.seconds(30),
            dead_letter_queue=sqs.DeadLetterQueue(
                max_receive_count=5, queue=webex_event_dlq
            ),
        )

        # ── Secrets Manager ───────────────────────────────────────────────────

        self.webex_secret = sm.Secret(
            self,
            "WebexSecret",
            secret_name=f"avops/webex",
            description="Webex bot token and webhook secret",
            generate_secret_string=sm.SecretStringGenerator(
                secret_string_template='{"WEBEX_BOT_TOKEN": "", "WEBEX_WEBHOOK_SECRET": ""}',
                generate_string_key="_placeholder",
                exclude_punctuation=True,
            ),
        )

        self.anthropic_secret = sm.Secret(
            self,
            "AnthropicSecret",
            secret_name=f"avops/anthropic",
            description="Anthropic API key",
            generate_secret_string=sm.SecretStringGenerator(
                secret_string_template='{"ANTHROPIC_API_KEY": ""}',
                generate_string_key="_placeholder",
                exclude_punctuation=True,
            ),
        )

        self.sqs_urls_secret = sm.Secret(
            self,
            "SqsUrlsSecret",
            secret_name=f"avops/sqs-urls",
            description="SQS queue URLs for agent dispatch",
            secret_string_value=cdk.SecretValue.unsafe_plain_text(
                f'{{"SQS_AGENT_QUEUE_URL": "{self.agent_queue.queue_url}", '
                f'"SQS_WEBEX_EVENT_QUEUE_URL": "{self.webex_event_queue.queue_url}"}}'
            ),
        )

        # ── IAM Role (ECS Task / Lambda / EC2 app) ────────────────────────────

        self.app_role = iam.Role(
            self,
            "AppRole",
            role_name=f"{prefix}-app-role",
            assumed_by=iam.CompositePrincipal(
                iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
                iam.ServicePrincipal("lambda.amazonaws.com"),
                # SECURITY-UPGRADE: restrict to specific ECS cluster ARN
            ),
            description="IAM role for AVops Webex Support application",
        )

        # DynamoDB permissions
        for table in [
            self.tickets_table,
            self.devices_table,
            self.rooms_table,
            self.agent_state_table,
        ]:
            table.grant_read_write_data(self.app_role)

        # S3 permissions
        self.logs_bucket.grant_read_write(self.app_role)
        self.reports_bucket.grant_read_write(self.app_role)
        self.firmware_bucket.grant_read(self.app_role)

        # SQS permissions
        self.agent_queue.grant_send_messages(self.app_role)
        self.agent_queue.grant_consume_messages(self.app_role)
        self.webex_event_queue.grant_send_messages(self.app_role)
        self.webex_event_queue.grant_consume_messages(self.app_role)

        # Secrets Manager — read only
        for secret in [self.webex_secret, self.anthropic_secret, self.sqs_urls_secret]:
            secret.grant_read(self.app_role)

        # ── CloudFormation Outputs ────────────────────────────────────────────

        cdk.CfnOutput(self, "TicketsTableName", value=self.tickets_table.table_name)
        cdk.CfnOutput(self, "DevicesTableName", value=self.devices_table.table_name)
        cdk.CfnOutput(self, "AgentQueueUrl", value=self.agent_queue.queue_url)
        cdk.CfnOutput(self, "WebexEventQueueUrl", value=self.webex_event_queue.queue_url)
        cdk.CfnOutput(self, "LogsBucketName", value=self.logs_bucket.bucket_name)
        cdk.CfnOutput(self, "ReportsBucketName", value=self.reports_bucket.bucket_name)
        cdk.CfnOutput(self, "AppRoleArn", value=self.app_role.role_arn)


app = cdk.App()
AvopsWebexSupportStack(
    app,
    "AvopsWebexSupportStack",
    env=cdk.Environment(
        account=app.node.try_get_context("account") or "123456789012",
        region=app.node.try_get_context("region") or "us-east-1",
    ),
)
app.synth()
