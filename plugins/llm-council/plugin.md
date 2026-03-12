# Plugin: LLM Council

> **Source:** https://github.com/karpathy/llm-council
> **Author:** Andrej Karpathy
> **License:** MIT
> **Purpose:** Query multiple LLMs simultaneously and synthesize their responses via a
> designated Chairman model. Useful for high-stakes AV design decisions, device
> troubleshooting, and getting consensus across AI models before committing to a plan.

---

## What It Does

LLM Council runs a local web app that:

1. **Broadcasts** your query to a configurable panel of LLMs in parallel (via OpenRouter)
2. **Cross-evaluates** — each model anonymously reviews and ranks the other models' answers
3. **Synthesizes** — a designated Chairman model produces a final consolidated answer

This is particularly valuable in AVops contexts where a single model's answer may miss
vendor-specific nuances (e.g., Crestron SIMPL+ edge cases, Q-SYS Lua timing bugs,
Dante routing conflicts). Getting 4+ model perspectives before the Planner commits to an
implementation approach reduces the risk of wrong assumptions.

---

## Installation

Requires **Python 3.10+**, **Node.js 18+**, and the `uv` package manager.

```bash
# Clone the repo (outside this project — it runs as a sidecar service)
git clone https://github.com/karpathy/llm-council ~/tools/llm-council
cd ~/tools/llm-council

# Install Python backend dependencies
uv sync

# Install frontend dependencies
cd frontend && npm install && cd ..
```

---

## Configuration

Copy the example env file and fill in your key:

```bash
cp plugins/llm-council/config.example.env ~/tools/llm-council/.env
# Then edit ~/tools/llm-council/.env with your actual OPENROUTER_API_KEY
```

**Required env var:**

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `OPENROUTER_API_KEY` | API key for OpenRouter (routes to all major LLMs) | https://openrouter.ai |

**Optional — customize council members** by editing `backend/config.py` in the llm-council
repo:

```python
COUNCIL_MODELS = [
    "anthropic/claude-sonnet-4-5",
    "openai/gpt-4o",
    "google/gemini-pro-1.5",
    "meta-llama/llama-3.1-405b-instruct",
]

# Model that produces the final synthesis
CHAIRMAN_MODEL = "anthropic/claude-sonnet-4-5"
```

---

## Running the Service

```bash
# One-command startup (runs both backend and frontend)
cd ~/tools/llm-council && ./start.sh

# Or manually:
# Terminal 1 — backend (FastAPI on port 8000)
cd ~/tools/llm-council && uv run python -m backend.main

# Terminal 2 — frontend (React/Vite on port 5173)
cd ~/tools/llm-council/frontend && npm run dev
```

Access the UI at: **http://localhost:5173**

> **Note:** LLM Council runs as a local sidecar — it does not integrate via Python import
> or REST API into avops. Agents interact with it through the browser UI or by pasting
> responses into `.agent-workspace/` hand-off files.

---

## Integration with the 7-Agent Workflow

LLM Council is invoked **between the Researcher and Planner stages** for complex or
ambiguous tasks. The Orchestrator decides when to invoke it based on task complexity.

```
Orchestrator
    │
    ├── launches ──► Researcher (02)   → research-findings.md
    │
    │  [HIGH-STAKES or AMBIGUOUS?]
    │       │
    │       ▼
    │  Orchestrator pastes research findings into LLM Council
    │  Orchestrator captures council-synthesis into:
    │       → .agent-workspace/council-synthesis.md
    │       │
    ├── launches ──► Planner (03)      reads ← research-findings.md
    │                                          + council-synthesis.md
    │                                  writes → implementation-plan.md
    ...
```

### When to Use LLM Council

| Scenario | Use Council? |
|----------|-------------|
| Ambiguous AV protocol choice (RS-232 vs TCP vs REST for a device) | Yes |
| Multi-vendor interop design (Crestron + Q-SYS + Dante interaction) | Yes |
| Security architecture for AVoIP VLAN segmentation | Yes |
| Routine bug fix with clear root cause | No |
| Simple device config update | No |
| Firmware version compatibility question | Yes (vendor docs may conflict) |

### Workflow Steps

1. **Orchestrator** identifies a high-stakes or ambiguous question during task routing
2. **Orchestrator** composes a precise query (see template below)
3. **User** pastes query into LLM Council at http://localhost:5173 and runs it
4. **User** copies the Chairman's synthesis into `.agent-workspace/council-synthesis.md`
5. **Planner** reads `council-synthesis.md` alongside `research-findings.md` when
   designing the implementation plan

See the full workflow: → [workflows/llm-council-query.md](../../workflows/llm-council-query.md)

---

## Query Template

Use this template when formulating queries for LLM Council to ensure consistent,
actionable answers:

```
## AV Design Question

**Context:**
- System: [room type, device models, firmware versions]
- Goal: [what we're trying to achieve]
- Constraints: [VLAN rules, vendor API limits, maintenance window, etc.]

**Question:**
[The specific technical question — be precise]

**Options considered:**
1. [Option A] — [brief description]
2. [Option B] — [brief description]

**Please evaluate each option and recommend the best approach, including:**
- Trade-offs
- Compatibility risks
- Implementation order
- Any edge cases specific to AV control systems
```

---

## Hand-off File Format

After running the council, save the Chairman's synthesis to:

**`.agent-workspace/council-synthesis.md`**

```markdown
# LLM Council Synthesis

## Query Summary
[One sentence describing what was asked]

## Chairman's Recommendation
[Paste Chairman model's final synthesis here verbatim]

## Dissenting Views (if any)
[Note any significant disagreement from council members worth flagging to the Planner]

## Council Run Details
- Date: YYYY-MM-DD
- Models: [list of council members used]
- Chairman: [chairman model]
- Query reference: [filename or ticket ID]
```

---

## Security Notes

- `OPENROUTER_API_KEY` must be stored in `~/tools/llm-council/.env` — never in this repo
- LLM Council sends queries to third-party AI providers via OpenRouter — **do not paste**
  device credentials, internal hostnames, or sensitive network topology into queries
- Sanitize queries: use generic identifiers (`room-a`, `device-1`) instead of real
  building/room codes when submitting to external LLMs
- LLM Council stores conversations in `~/tools/llm-council/data/conversations/` —
  review and purge as needed per your data retention policy

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Backend won't start | Missing `uv` or Python version | Install `uv`: `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| `OPENROUTER_API_KEY not found` | `.env` not in llm-council root | Copy `config.example.env` to `~/tools/llm-council/.env` and fill in key |
| Frontend blank / 404 | Frontend not built | Run `cd frontend && npm install && npm run dev` |
| Model returns empty response | OpenRouter credit exhausted | Top up credits at https://openrouter.ai |
| Council hangs on Stage 2 | Rate limit hit | Reduce `COUNCIL_MODELS` list in `backend/config.py` |
