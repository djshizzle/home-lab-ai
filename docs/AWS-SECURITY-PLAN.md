# AVops Webex Support Agents — AWS Architecture & Corporate AI Security Posture Plan

> **Status:** Phase 1 (Home-Lab / Dev) deployed. Roadmap to Phase 3 (Corp AI Posture).
> **Last updated:** 2026-03-09

---

## 1. Current Architecture (Phase 1 — AWS Dev/Home-Lab)

```
 Webex Space
     │  webhook POST
     ▼
 FastAPI (port 8080)
     │
     ├─► DynamoDB (tickets, devices, agent-state)
     ├─► S3 (logs, reports, firmware)
     ├─► SQS FIFO (agent-tasks, webex-events)
     └─► Anthropic API (7-agent pipeline)
              │
              claude-opus-4-6 (Orchestrator, Researcher, Planner,
                                Implementer, Tester, Reviewer, Documenter)
```

### Phase 1 AWS Services

| Service | Purpose | Table / Resource |
|---------|---------|-----------------|
| DynamoDB | Tickets, devices, rooms, agent state | 4 tables, PAY_PER_REQUEST |
| S3 | Logs archive, reports, firmware | 3 buckets, AES-256 SSE |
| SQS FIFO | Agent task dispatch, Webex event buffer | 2 queues + DLQs |
| Secrets Manager | Webex token, Anthropic API key, SQS URLs | 3 secrets |
| IAM | App role with least-privilege | 1 role |

### Phase 1 Deployment Options

```bash
# Option A: Local / Home-Lab (Docker Compose)
docker compose up -d          # FastAPI + React on localhost
# Set AWS_PROFILE or IAM role for DynamoDB/S3/SQS access

# Option B: EC2 / ECS Fargate (manual)
pip install -e ".[dev]"
uvicorn avops.main:app --host 0.0.0.0 --port 8080

# Option C: CDK deploy (creates all AWS resources)
cd infrastructure/cdk
pip install -r requirements.txt
cdk deploy -c env=dev -c account=YOUR_ACCOUNT -c region=us-east-1
```

---

## 2. Phase 2 — Staging (Pre-Production Hardening)

### 2.1 Networking

- **VPC** with private subnets for ECS tasks
- **NAT Gateway** for outbound-only internet (Webex webhook, Anthropic API)
- **VPC Endpoints** for DynamoDB, S3, SQS, Secrets Manager (no internet traversal)
- **Security Groups**: ECS tasks only accept traffic from ALB; no direct inbound

```
Internet → ALB (public subnet) → ECS Fargate (private subnet)
                                        │
                              VPC Endpoints → DynamoDB / S3 / SQS
```

### 2.2 Authentication & Authorization

- **Amazon Cognito User Pool** — dashboard login for AV engineers
- **API Gateway** in front of FastAPI with Cognito JWT authorizer
- `enable_auth = true` in Settings → FastAPI validates JWT on all routes
- RBAC: `av-engineer` (read-only), `av-admin` (read-write), `av-ops` (full)

### 2.3 Encryption Upgrades

| Resource | Phase 1 | Phase 2 Upgrade |
|----------|---------|-----------------|
| DynamoDB | AWS-managed key | CMK (Customer Managed Key) via KMS |
| S3 | SSE-S3 (AES-256) | SSE-KMS with CMK |
| SQS | Default encryption | KMS CMK |
| Secrets Manager | Default | CMK rotation enabled |

### 2.4 Logging & Monitoring

- **AWS CloudTrail** — all API calls logged to S3
- **CloudWatch Logs** — FastAPI structlog → CloudWatch Log Groups
- **CloudWatch Metrics** — tickets/min, agent latency, error rate
- **CloudWatch Alarms** — DLQ depth > 0, API 5xx rate > 1%
- **AWS Config** — drift detection on DynamoDB, S3 policy changes

### 2.5 WAF (Web Application Firewall)

- **AWS WAF** on ALB:
  - AWS Managed Rules (Core Rule Set, Known Bad Inputs)
  - Rate limiting: 100 requests/5min per IP
  - Geo-blocking: restrict to corporate office IPs / Webex IP ranges
  - Custom rule: block non-Webex User-Agent on webhook endpoint

---

## 3. Phase 3 — Corporate AI Security Posture

### 3.1 AI Model Governance

| Requirement | Implementation |
|-------------|---------------|
| Model approval | Only Anthropic Claude models — no open-weight models |
| Data residency | All prompts/responses stay in US-East-1 |
| PII scrubbing | Strip emails/device passwords from Anthropic API payloads |
| Prompt injection defence | Input sanitisation before agent dispatch |
| Output validation | JSON schema validation on all agent outputs |
| Cost controls | `max_budget_usd` per ticket, CloudWatch billing alarm |
| Audit trail | Every Anthropic API call logged with ticket_id, tokens, model |

### 3.2 Zero-Trust Network

```
Corporate Users → AWS SSO / IAM Identity Center
                      │
              Cognito User Pool (MFA enforced)
                      │
              API Gateway (private, VPC endpoint)
                      │
              ECS Fargate (no public IP)
                      │
         ┌────────────┴────────────┐
    DynamoDB                    Secrets Mgr
    (VPC endpoint)              (VPC endpoint)
```

### 3.3 Data Classification

| Data Type | Classification | Controls |
|-----------|---------------|---------|
| Webex messages | Confidential | Encrypted at rest + in transit, 365-day retention |
| Device credentials | Secret | Secrets Manager only, never logged |
| Agent transcripts | Internal | S3 SSE-KMS, 365-day lifecycle |
| Support tickets | Internal | DynamoDB CMK, PITR enabled |
| Firmware files | Public | S3 standard, no PII |

### 3.4 IAM Hardening

```python
# Fine-grained DynamoDB permissions (not table-level grant_read_write_data)
iam.PolicyStatement(
    effect=iam.Effect.ALLOW,
    actions=["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Query"],
    resources=[tickets_table.table_arn, f"{tickets_table.table_arn}/index/*"],
    conditions={"StringEquals": {"aws:RequestedRegion": "us-east-1"}},
)
# No dynamodb:Scan, no dynamodb:DeleteItem, no dynamodb:DescribeTable
```

### 3.5 Secrets Rotation

```
Webex Bot Token     → Secrets Manager auto-rotation every 90 days
                      (Lambda rotation function calls Webex API)
Anthropic API Key   → Manual rotation every 90 days (no rotation API)
Device Credentials  → Vault or CyberArk integration (future)
```

### 3.6 Compliance Controls

| Framework | Controls Required |
|-----------|-----------------|
| SOC 2 Type II | CloudTrail, Config, VPC Flow Logs, WAF, PITR |
| NIST 800-53 | CMK, MFA, least-privilege IAM, audit logging |
| Corp AI Policy | Model registry, PII stripping, cost cap, human override |
| GDPR (if EU data) | Data residency, right-to-erasure API, consent logging |

---

## 4. Scaling Architecture (Phase 3 Target State)

```
                    ┌─────────────────────────────────────┐
                    │         AWS us-east-1                │
                    │                                      │
  Webex Bot         │  ALB (WAF + Cognito)                │
  Webhook ──────────►    │                                 │
                    │    ├─ ECS Fargate (FastAPI)          │
  Corp Users ───────►    │     └─ Port 8080               │
  (Cognito JWT)     │    │                                 │
                    │    └─ ECS Fargate (SQS Worker)       │
                    │          └─ Consumes agent-tasks.fifo│
                    │               └─ Claude API          │
                    │                   (7-agent pipeline) │
                    │                                      │
                    │  DynamoDB (Multi-AZ, CMK)           │
                    │  S3 (Cross-region replication)      │
                    │  SQS FIFO (2 queues)                │
                    │  Secrets Manager (rotation enabled) │
                    │  CloudWatch (metrics + alarms)      │
                    │  CloudTrail (all regions)           │
                    │  AWS Config (compliance rules)      │
                    └─────────────────────────────────────┘
```

### Scaling Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| SQS agent queue depth | > 50 messages | Scale ECS worker +2 tasks |
| FastAPI p99 latency | > 2s | Scale FastAPI +2 tasks |
| DynamoDB consumed RCU | > 80% | Enable auto-scaling |
| Anthropic API rate limit | 429 response | Exponential backoff (built-in) |

---

## 5. Implementation Checklist

### Phase 1 → Phase 2 (Staging)

- [ ] Deploy CDK stack (`infrastructure/cdk/avops_stack.py`)
- [ ] Populate Secrets Manager with real Webex token + Anthropic key
- [ ] Set `USE_SECRETS_MANAGER=true` in ECS task definition
- [ ] Create Cognito User Pool + app client
- [ ] Set `ENABLE_AUTH=true` + Cognito env vars
- [ ] Enable WAF on ALB
- [ ] Configure CloudWatch alarms (DLQ depth, 5xx rate)
- [ ] Enable CloudTrail in all regions

### Phase 2 → Phase 3 (Corp AI Posture)

- [ ] Create KMS CMKs for DynamoDB, S3, SQS
- [ ] Enable Secrets Manager rotation for Webex token
- [ ] Implement PII scrubber before Anthropic API calls
- [ ] Add `max_budget_usd` cap per ticket to BaseAgent
- [ ] Deploy VPC + private subnets + VPC endpoints
- [ ] Configure Cognito MFA (TOTP or SMS)
- [ ] Run SOC 2 gap assessment
- [ ] Document AI model registry entry for claude-opus-4-6
- [ ] Add human override webhook for critical tickets (PagerDuty)

---

## 6. Cost Estimates (Monthly)

### Phase 1 (Dev — low volume ~500 tickets/month)

| Service | Cost |
|---------|------|
| DynamoDB (PAY_PER_REQUEST) | ~$2 |
| S3 (logs + reports) | ~$1 |
| SQS | ~$0.01 |
| Secrets Manager | ~$1.50 |
| Anthropic Claude (7 agents × 500 tickets) | ~$35–85 |
| **Total** | **~$40–90/month** |

### Phase 3 (Production — ~5,000 tickets/month)

| Service | Cost |
|---------|------|
| ECS Fargate (2 services, 2 AZs) | ~$80 |
| DynamoDB | ~$20 |
| S3 | ~$5 |
| SQS + DLQs | ~$1 |
| Secrets Manager | ~$3 |
| WAF | ~$10 |
| CloudWatch + CloudTrail | ~$15 |
| KMS (CMKs) | ~$6 |
| Anthropic Claude | ~$350–850 |
| **Total** | **~$490–990/month** |

---

## 7. Open Items / Decisions Needed

1. **Webex Bot scope**: Should the bot respond in individual DMs only, or also in group support spaces?
2. **AI model approval**: Does corp AI policy require claude-opus-4-6 to be on the approved model registry?
3. **Device credential vault**: CyberArk vs AWS Secrets Manager for device passwords?
4. **GDPR applicability**: Are any European employees/rooms in scope? If yes, data residency config needed.
5. **On-call integration**: PagerDuty escalation for `priority=critical` tickets?
6. **Rate limit for Anthropic**: Current plan tier — confirm tokens/min before production rollout.
