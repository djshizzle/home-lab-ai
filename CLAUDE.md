# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Identity

AVops Webex Support Agents — a 7-agent Claude AI pipeline that receives AV support requests from Webex, triages them, runs them through a sequenced agent workflow, and posts resolutions back to the requester. State is persisted to AWS (DynamoDB, S3, SQS).

**Stack:** Python 3.12 · FastAPI · Anthropic Claude API · AWS (DynamoDB / S3 / SQS / Secrets Manager) · React/Vite frontend · Docker Compose + LocalStack for local dev

---

## Commands

```bash
# Install (includes dev extras: pytest, ruff, moto, mypy)
pip install -e ".[dev]"

# Run API locally (hot-reload)
uvicorn avops.main:app --reload --port 8080

# Run with LocalStack (full AWS stack locally)
docker compose up -d

# Tests
pytest -x -v tests/                      # all tests
pytest tests/unit/test_triage.py -v      # single file
pytest -k "test_classify_intent" -v      # single test

# Lint / format
ruff check . && ruff format --check .
ruff format .                            # auto-fix formatting

# Type check
mypy avops/

# Create AWS resources (after CDK deploy or LocalStack up)
python scripts/init_aws_resources.py

# Generate plan PDF
python scripts/generate_pdf.py docs/AVops-AWS-Security-Plan.pdf
```

---

## Architecture

### Request flow

```
Webex message
    │  POST /api/webex/webhook
    ▼
avops/webex/bot.py  handle_webhook_event()
    │  1. Fetch full message via Webex API
    │  2. triage.py: keyword classify intent + priority
    │  3. TicketStore.create() → DynamoDB
    │  4. send_ack() back to Webex
    │  5. Enqueue to SQS (or inline fallback in dev)
    ▼
avops/agents/orchestrator.py  run_support_workflow()
    │  Chains 7 agents in sequence; each agent output
    │  becomes previous_agent_output for the next.
    │  State tracked in avops-agent-state DynamoDB table.
    ▼
avops/webex/client.py  send_resolution()  →  Webex room
avops/aws/s3.py        LogStore.save_ticket_log()  →  S3
```

### Agent pipeline (`avops/agents/`)

| File | Purpose |
|------|---------|
| `base.py` | `BaseAgent` — wraps Anthropic streaming API with tenacity retry (3 attempts, exponential backoff). All agents extend this. |
| `team.py` | 7 concrete agent classes (Orchestrator through Documenter). Each calls `_call(system, user_message)` with its role-specific system prompt. |
| `prompts.py` | All 7 system prompts as module-level constants. |
| `orchestrator.py` | `run_support_workflow()` — sequences agents, persists state, handles workflow variants. |

**Two model tiers** (set in `avops/config.py`):
- `claude_model` = `claude-sonnet-4-6` — Orchestrator and heavy analysis agents
- `claude_fast_model` = `claude-haiku-4-5-20251001` — triage/routing agents (`use_fast_model = True` on subclass)

**Workflow routing** (selected in `bot.py._select_workflow()`):
- `incident-response` — critical priority or `device_offline` intent: skips Planner + Reviewer for speed
- `firmware-rollout` — full 7-agent pipeline
- `standard-feature` — default full pipeline

**Agent context propagation:** Each agent receives a dict with `ticket_id`, `intent`, `priority`, `room_id`, `message`, `person_email`, `device_inventory`, and `previous_agent_output`. `_build_context_message()` in `team.py` serialises this to a human-readable string.

**JSON parsing:** `BaseAgent._parse_json()` tries direct parse → extracts from ` ```json ` fence → falls back to raw text. Agents should return JSON; the fallback allows graceful degradation.

### Triage (`avops/webex/triage.py`)

Fast keyword-based pre-classifier that runs before any Claude call:
- `classify_intent()` — scores keywords from `WEBEX_SUPPORT_INTENTS` (defined in `avops/constants/devices.py`); returns highest-scoring intent or `"general"`
- `classify_priority()` — `critical` / `high` / `medium` / `low` based on urgency phrases and intent
- `extract_room_code()` — regex extracts patterns like `conf-3b`, `hq-031`, `3B` from free text

### AWS layer (`avops/aws/`)

| Module | Provides |
|--------|---------|
| `client.py` | `get_dynamodb()` / `get_s3()` / `get_sqs()` — boto3 resource/client singletons respecting `aws_endpoint_url` for LocalStack |
| `dynamodb.py` | `TicketStore`, `DeviceStore`, `AgentStateStore` — typed CRUD classes |
| `s3.py` | `LogStore` — ticket transcript archival |
| `sqs.py` | `AgentTaskQueue` — FIFO enqueue with message dedup |
| `secrets.py` | `load_secrets_into_env()` — loads Secrets Manager values into `os.environ` at startup; no-op when `use_secrets_manager=False` |

**DynamoDB key schemas:**
- `avops-support-tickets`: PK=`ticket_id`, SK=`created_at`; GSI1=`webex_room_id+created_at`; GSI2=`status+created_at`
- `avops-devices`: PK=`device_id`, SK=`room_id`; GSI=`room_id-index`
- `avops-agent-state`: PK=`ticket_id`, SK=`session_id`

### Configuration (`avops/config.py`)

`Settings` uses `pydantic-settings` loaded from `.env`. `get_settings()` is `@lru_cache` — call it anywhere; **invalidate the cache in tests** with `get_settings.cache_clear()`. Key toggles:

- `use_secrets_manager` — `False` in dev, `True` in staging/prod
- `enable_auth` — `False` in dev; enables Cognito JWT validation in prod
- `aws_endpoint_url` — set to `http://localhost:4566` for LocalStack

Copy `.env.example` → `.env` and fill in `WEBEX_BOT_TOKEN`, `ANTHROPIC_API_KEY`, and `WEBEX_WEBHOOK_SECRET` at minimum.

### API routes (`avops/api/routes/`)

- `GET /api/health` — liveness check
- `POST /api/webex/webhook` — Webex webhook receiver (entry point)
- `GET/POST /api/tickets` — ticket CRUD for dashboard
- `GET/POST /api/devices` — device inventory management

### Frontend (`frontend/`)

React + TypeScript + Vite. Served from `frontend/dist/` in production (FastAPI mounts it at `/`). Dev server on port 3000 proxies to the API at 8080 via `VITE_API_BASE`.

### Infrastructure (`infrastructure/cdk/`)

CDK Python stack (`avops_stack.py`) provisions all AWS resources. Deploy with:
```bash
cd infrastructure/cdk && cdk deploy -c env=dev -c account=YOUR_ACCOUNT -c region=us-east-1
```

---

## Testing

Tests use `moto` to mock all AWS calls — no real AWS needed for unit tests.

```python
# Pattern for mocking AWS in tests
from moto import mock_aws

@mock_aws
def test_something():
    # moto intercepts all boto3 calls
    ...
```

`asyncio_mode = "auto"` is set in `pyproject.toml` — all async test functions work without `@pytest.mark.asyncio`.

Run tests against LocalStack (integration) by setting `AWS_ENDPOINT_URL=http://localhost:4566` in the test environment.

---

## Local Dev with Docker Compose

`docker compose up -d` starts:
1. **localstack** — DynamoDB, S3, SQS, Secrets Manager on port 4566
2. **api** — FastAPI on port 8080, `AWS_ENDPOINT_URL` pointed at localstack
3. **frontend** — Vite dev server on port 3000

After first start, initialise AWS resources:
```bash
python scripts/init_aws_resources.py
```

API docs: `http://localhost:8080/api/docs`

---

## Agent Workspace

Inter-agent hand-off files are written to `.agent-workspace/` (gitignored). Scaffold with:
```bash
./scripts/init-agent-team.sh
```

Key workspace files:
- `.agent-workspace/device-inventory-snapshot.json`
- `.agent-workspace/signal-path-map.md`
- `.agent-workspace/maintenance-window.md`

---

## Security Constraints

- All credentials via environment variables — never hardcode
- AV device credentials in Secrets Manager only — never logged
- `enable_auth = true` in staging/prod enforces Cognito JWT on all routes
- **Never push control system changes to live rooms during business hours (08:00–18:00 local) without explicit approval**

## Git Conventions

```
Branch:   feature/<ticket>-description  |  fix/<ticket>-description
          device/<ticket>-model-action  |  chore/<ticket>-description

Commit:   feat|fix|chore|docs|test|refactor|device|firmware(<scope>): <summary>
```
