# Usage Limits Review & Recommendations — AVops Agent Team

> **Date:** 2026-03-13
> **Scope:** All documented API, device, and operational limits across the AVops codebase
> **Goal:** Prevent hitting limits in production by identifying gaps and recommending safeguards

---

## 1. Vendor API Rate Limits

### Current Documented Limits

| Vendor | Rate Limit | Source |
|--------|-----------|--------|
| Crestron | 60 req/min | CLAUDE.md, agents/06-reviewer.md |
| Q-SYS | 30 req/min | CLAUDE.md, agents/06-reviewer.md |
| Biamp | 60 req/min | agents/06-reviewer.md |
| Poly | 30 req/min | agents/06-reviewer.md |

### Gaps Identified

1. **No runtime rate limiter exists.** The `API_RATE_LIMIT` constant is defined on device drivers but there is no middleware or decorator that enforces it at runtime. A driver making rapid calls (e.g., polling a fleet) will exceed limits silently.
2. **Missing limits for several device categories.** No documented rate limits for: Samsung/LG displays, Epson/Sony projectors, Extron SIS/GCP, AMX ICSP, BrightSign, Shure IntelliMix, Crown/Lab.gruppen amplifiers, Crestron NVX, or Dante Controller API.
3. **No per-device vs. per-API distinction.** Some vendors rate-limit per device endpoint; others rate-limit per API key or source IP. This is not documented.

### Recommendations

- **R1: Implement a `RateLimiter` class in `src/middleware/rate_limit.py`** that wraps `DeviceBase` API calls using a token-bucket or sliding-window algorithm. Each driver's `API_RATE_LIMIT` constant should feed directly into this limiter.
- **R2: Add a fleet-aware rate budget.** When polling N devices of the same vendor from one management host, the aggregate request rate must stay under the vendor's per-source-IP limit (if applicable). Example: polling 20 Poly devices at 30 req/min each = 600 req/min from one IP — confirm with Poly whether this is allowed or if there's a global cap.
- **R3: Document rate limits for all supported vendors.** Add a `docs/vendor-rate-limits.md` reference table. For vendors without published limits, test empirically and document the safe threshold found.
- **R4: Add 429 response handling to all REST drivers.** When a device returns HTTP 429, the driver should: (a) respect the `Retry-After` header, (b) log the event, (c) back off exponentially, and (d) alert monitoring if it happens repeatedly.

---

## 2. Request Timeouts

### Current State

- Recommended timeout: **10 seconds** for device REST APIs (agents/06-reviewer.md:181)
- No enforced default — each driver must set `timeout=10` manually on every `requests.get()` / `requests.post()` call

### Gaps Identified

1. **No default timeout in `DeviceBase`.** If a developer forgets `timeout=`, the request blocks indefinitely on an unresponsive device.
2. **Serial (RS-232/RS-485) timeouts not standardized.** Serial commands can also hang if a device is offline or unresponsive.
3. **Different device types may need different timeouts.** A projector warm-up command can take 30-60s; a status poll should return in <5s.

### Recommendations

- **R5: Set a default timeout in `DeviceBase.__init__`** (e.g., `self.default_timeout = 10`). All HTTP calls in base methods should use it. Drivers can override per-command where needed.
- **R6: Define timeout tiers:**

  | Operation Type | Recommended Timeout |
  |---------------|-------------------|
  | Status poll | 5s |
  | Config read | 10s |
  | Config write | 15s |
  | Reboot / power | 30s |
  | Firmware upload | 300s (5 min) |

- **R7: Add serial port timeouts.** All RS-232/RS-485 connections should use `serial.Serial(timeout=5)` with a per-command override option.

---

## 3. Retry & Backoff Logic

### Current State

- Documented requirement: exponential backoff, not tight loops (agents/06-reviewer.md:182)
- No shared retry utility exists in the codebase

### Gaps Identified

1. **No shared retry decorator or utility.** Each driver would implement its own retry logic, leading to inconsistency and bugs.
2. **No maximum retry count defined.** Without a cap, a failed device could generate infinite retries.
3. **No circuit breaker pattern.** If a device is down, the system will keep retrying at the backoff interval forever instead of marking it offline.

### Recommendations

- **R8: Create a shared `@retry_with_backoff` decorator** in `src/utils/retry.py`:
  - Default: 3 retries, exponential backoff (1s, 2s, 4s), jitter
  - Configurable per driver/command
  - Logs each retry with device_id and attempt number
- **R9: Implement a circuit breaker.** After N consecutive failures (e.g., 5), mark the device as `UNREACHABLE` for a cooldown period (e.g., 60s) before attempting again. This prevents a downed device from consuming API budget and log space.
- **R10: Combine rate limiting with retries.** Retried requests must still count toward the rate limit budget — a retry loop should not bypass the rate limiter.

---

## 4. Dante / AES67 Audio Network Limits

### Current State

- Dante subscriptions take 2-5s to establish
- Q-SYS startup requires ≥5s `Timer.CallAfter` delay
- Dante Controller lock must be checked before applying changes
- Latency: ≥1ms local, ≥5ms WAN

### Gaps Identified

1. **No automated Dante lock check.** The checklist says "check Dante Controller lock" but there's no tooling to verify this programmatically before pushing audio route changes.
2. **No clock master conflict detection.** Multiple clock masters on the same subnet is a documented risk, but no validation script exists.
3. **Subscription count limits not documented.** Dante devices have maximum subscription counts (varies by model) — exceeding this silently drops audio.

### Recommendations

- **R11: Add a `scripts/dante_preflight.py`** that queries Dante Controller API to verify: (a) no lock conflicts, (b) single clock master per subnet, (c) subscription count within device limits.
- **R12: Document per-model Dante subscription limits** in the vendor rate limits table. Example: Shure MXA920 supports max 10 Dante TX channels simultaneously.
- **R13: Add Dante subscription count to device `get_status()`.** Monitor proximity to the limit and alert at 80% capacity.

---

## 5. FastAPI / Application-Level Limits

### Current State

- `AGENT-TEAM-SETUP.md` references a planned rate limiter: 10 req/min per IP for `/api/upload`
- No implementation exists yet

### Gaps Identified

1. **No API rate limiting middleware.** The FastAPI application has no protection against abuse or accidental tight loops from integration clients.
2. **No connection pool limits defined for PostgreSQL.** Unbounded connections under load will exhaust DB capacity.
3. **No concurrent device operation limits.** A bulk operation (e.g., "reboot all 50 devices") with no concurrency cap could overwhelm the network and hit every vendor limit simultaneously.

### Recommendations

- **R14: Add `slowapi` or custom middleware** for API endpoint rate limiting. Suggested defaults:

  | Endpoint Pattern | Rate Limit |
  |-----------------|-----------|
  | `GET /devices/*/status` | 120/min per IP |
  | `POST /devices/*/reboot` | 5/min per IP |
  | `POST /devices/*/config` | 10/min per IP |
  | `POST /api/upload` | 10/min per IP |
  | `GET /rooms/*` | 60/min per IP |

- **R15: Configure PostgreSQL connection pooling.** Use SQLAlchemy's `pool_size=10, max_overflow=20` (or equivalent) and document the limits.
- **R16: Add a concurrency semaphore for bulk operations.** Limit parallel device commands to a configurable max (e.g., 5 concurrent) and process the rest in a queue. This naturally stays within vendor rate limits.

---

## 6. SNMP Polling Limits

### Current State

- SNMP polling referenced in `src/utils/snmp.py:poll_device()`
- Used for monitoring uptime, temperature, and alerts
- No polling interval or concurrency limits documented

### Recommendations

- **R17: Define SNMP polling intervals.** Suggested: status polls every 60s, temperature every 300s. Polling too frequently can overload older devices (especially via SNMPv2c).
- **R18: Limit concurrent SNMP polls.** Use asyncio semaphore (max 10 concurrent) to avoid UDP storm on the AV VLAN.

---

## 7. Operational / Process Limits

### Current State

| Limit | Value | Source |
|-------|-------|--------|
| Maintenance window | Not during 8am-6pm without approval | CLAUDE.md |
| Max review cycles | 2 before escalation | agents/06-reviewer.md |
| Crestron API | 60 req/min | CLAUDE.md |
| Q-SYS API | 30 req/min | CLAUDE.md |

### Recommendations

- **R19: Add a maintenance window checker** to the Orchestrator agent. Before any device config push, programmatically check the current time against the 8am-6pm window and block without explicit override.
- **R20: Add a "dry run" mode to all device config operations.** This lets you validate changes without consuming rate limit budget on the actual device.

---

## Summary: Priority Actions

| Priority | Rec | Action | Impact |
|----------|-----|--------|--------|
| **HIGH** | R1 | Implement runtime `RateLimiter` class | Prevents vendor API bans/throttling |
| **HIGH** | R5 | Default timeout in `DeviceBase` | Prevents hung threads on dead devices |
| **HIGH** | R8 | Shared retry decorator with backoff | Prevents tight-loop failures |
| **HIGH** | R9 | Circuit breaker for offline devices | Prevents wasting rate budget on dead devices |
| **HIGH** | R4 | Handle HTTP 429 in all REST drivers | Graceful degradation when limits hit |
| **MEDIUM** | R14 | FastAPI rate limiting middleware | Protects API from abuse |
| **MEDIUM** | R16 | Bulk operation concurrency cap | Prevents fleet-wide limit breaches |
| **MEDIUM** | R3 | Document all vendor rate limits | Knowledge gap for half the device categories |
| **MEDIUM** | R11 | Dante preflight script | Prevents audio routing failures |
| **LOW** | R6 | Timeout tiers per operation type | Better UX for slow operations |
| **LOW** | R15 | PostgreSQL connection pool config | Prevents DB exhaustion under load |
| **LOW** | R17 | SNMP polling interval standards | Prevents overloading old devices |
| **LOW** | R20 | Dry run mode for config changes | Saves rate budget during testing |

---

## Next Steps

1. Start with **R1 + R5 + R8** — these are foundational and every driver will build on them
2. Add **R4** (429 handling) to the `DeviceBase` class so all drivers inherit it
3. Create **R3** (`docs/vendor-rate-limits.md`) as a living document — fill in as each device is onboarded
4. Implement **R9** (circuit breaker) before deploying to a fleet of >10 devices
5. Add **R14** (API rate limiting) before exposing the FastAPI app to any network beyond localhost
