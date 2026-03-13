# Vendor API Rate Limits Reference (R3)

> **Living document.** Update as each device is onboarded and vendor docs are confirmed.
> Last updated: 2026-03-13

---

## REST / HTTP APIs

| Vendor | Rate Limit | Per | Timeout | Auth Method | Source |
|--------|-----------|-----|---------|-------------|--------|
| Crestron | 60 req/min | Device IP | 10s | Token/Bearer | Crestron API Guide v2 |
| Q-SYS | 30 req/min | Device IP | 10s | Bearer token | Q-SYS Designer Help |
| Biamp | 60 req/min | Device IP | 10s | Basic auth (HTTPS only) | Biamp TTP Guide |
| Poly | 30 req/min | Device IP | 10s | Bearer token | Poly API v4 docs |
| Cisco (Webex devices) | 30 req/min | Device IP | 10s | Bearer token | Cisco xAPI docs |
| Logitech | 30 req/min | Device IP | 10s | API key | Logitech Sync API |
| Neat | 30 req/min | Device IP | 10s | Bearer token | Neat Pulse API |
| BrightSign | 60 req/min | Device IP | 10s | API key | BSN.cloud API docs |
| Extron (REST) | 60 req/min | Device IP | 10s | Basic auth | Extron Control API |

## Serial / TCP Protocols

| Vendor | Protocol | Max Command Rate | Timeout | Notes |
|--------|----------|-----------------|---------|-------|
| Extron (SIS) | TCP/RS-232 | ~30 cmd/min | 5s | Wait for response before next command |
| AMX (ICSP) | TCP | ~30 cmd/min | 5s | Event-driven, respect WAIT in NetLinx |
| Samsung (MDC) | RS-232/TCP | ~20 cmd/min | 5s | Serial queue, one command at a time |
| LG (RS-232C) | RS-232 | ~20 cmd/min | 5s | Slow ACK, wait for response |
| Sony (ADCP) | RS-232/TCP | ~20 cmd/min | 5s | Projector warm-up can take 30-60s |
| Epson (ESC/VP21) | RS-232/TCP | ~20 cmd/min | 5s | Projector warm-up can take 30-60s |
| Crown/Lab.gruppen | TCP/HiQnet | ~30 cmd/min | 5s | |

## SNMP

| Use Case | Recommended Interval | Concurrency Limit |
|----------|---------------------|-------------------|
| Device status poll | 60s | 10 concurrent |
| Temperature monitoring | 300s | 10 concurrent |
| Uptime check | 60s | 10 concurrent |
| Alert/trap check | 30s | 10 concurrent |

## Dante / AES67

| Device Model | Max TX Channels | Max RX Channels | Max Subscriptions | Clock Role |
|-------------|----------------|----------------|-------------------|------------|
| QSC Core 110f | 64 | 64 | 64 | Follower (preferred) |
| QSC Core 510i | 128 | 128 | 128 | Master or Follower |
| Shure MXA920 | 10 | 0 | 10 | Follower only |
| Shure MXA910 | 10 | 0 | 10 | Follower only |
| Shure IntelliMix P300 | 8 | 8 | 8 | Follower only |
| Biamp Tesira SERVER-IO | 64 | 64 | 64 | Follower (preferred) |
| Biamp Tesira Forte X | 32 | 32 | 32 | Follower (preferred) |

**Rules:**
- Exactly one PTP grandmaster (clock master) per subnet
- Latency: >=1ms local network, >=5ms WAN
- Alert at 80% of subscription limit
- Always check Dante Controller lock before programmatic route changes

## Notes

- "Per Device IP" means each physical device has its own rate limit bucket
- For fleet polling from a single management host, implement per-vendor global caps if vendor docs indicate source-IP-based throttling
- All REST calls must use HTTPS — plain HTTP is a BLOCK condition in code review
- Community strings and API keys must come from environment variables, never hardcoded
