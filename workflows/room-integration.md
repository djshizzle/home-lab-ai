# Workflow: AV Room Integration

> Use this workflow for greenfield room builds, renovations, or full room AV upgrades.
> This is the most comprehensive workflow — it covers design, implementation, device
> onboarding (multiple devices), control system programming, UC integration, and full
> as-built documentation.
>
> Room Types: HUDDLE | CONF_SMALL | CONF_MEDIUM | CONF_LARGE | BOARDROOM | EVENT_SPACE | BROADCAST_STUDIO
>
> Agents: Orchestrator → Researcher (×3 parallel) → Planner → Implementer → Tester → Reviewer → Documenter

---

## Prerequisites

- [ ] Room ID assigned: {building}-{floor}{room_number} (e.g., hq-3b)
- [ ] Room type confirmed (see room type definitions in CLAUDE.md)
- [ ] Equipment list / BOQ (Bill of Quantities) confirmed
- [ ] Network pre-work completed: AV VLAN created, switch ports patched, IP reservations made
- [ ] Physical installation complete or in-progress (rack, displays, cable runs)
- [ ] Vendor-approved control system template available (or greenfield design needed)
- [ ] UC platform confirmed: MTR | Zoom Rooms | Webex | None
- [ ] Maintenance window: rooms under construction don't need a window;
      renovation of active rooms does

---

## Phase 1: Setup (Orchestrator)

```
[ ] 1.1  Gather required info (AskUserQuestion if any are missing):
         - Room ID, display name, building, floor
         - Room type (from CLAUDE.md standard templates)
         - Complete equipment list (make, model, firmware, quantity)
         - IP address or DHCP reservation for each device
         - UC platform and account/license details
         - Control system platform (Crestron | AMX | QSC | Extron)
         - Touch panel model and UI requirements
         - Dante requirements: clock domain, device names, latency
         - Integration requirements: room scheduling, signage, BYOD wireless

[ ] 1.2  Create .agent-workspace/task.md with full room spec

[ ] 1.3  Create .agent-workspace/signal-path-map.md (initial draft from equipment list)

[ ] 1.4  Create TodoWrite task list
```

---

## Phase 2: Research (Researcher ×3 → Parallel Explore agents)

Launch all three simultaneously:

```
[ ] 2.1  Agent A — Device Driver Research:
         For each device in the equipment list:
         - Does a driver exist? Which version?
         - API type: REST | TCP | RS-232 | SNMP
         - Known firmware bugs for specified versions
         - Dante device name conventions for audio devices
         Output: .agent-workspace/research-device-drivers.md

[ ] 2.2  Agent B — Control System Template Research:
         - Find existing room template closest to this room type
           (check control_systems/templates/)
         - Identify which SIMPL+ modules / Q-SYS components to reuse
         - Find existing touch panel UI templates
         - Identify UC integration modules (MTR peripheral mode, etc.)
         Output: .agent-workspace/research-control-system.md

[ ] 2.3  Agent C — Network & Infrastructure Research:
         - Confirm AV VLAN number and subnet from network config
         - Confirm managed switch port assignments for this room
         - Check IGMP snooping and QoS config on the switch
         - Verify Dante clock domain assignments for the building
         - Check if NDI is used and multicast routing is configured
         Output: .agent-workspace/research-network-infra.md

[ ] 2.4  Wait for all three research files, then review:
         - Are all device drivers available or can existing ones be extended?
         - Is there a control system template to start from?
         - Is the network ready (VLAN, QoS, IGMP)?
         If gaps: re-run targeted Researcher for missing areas
```

---

## Phase 3: Planning (Planner → Plan agent)

```
[ ] 3.1  Launch Planner with all three research files as input
         Plan must cover these sections:

         INFRASTRUCTURE:
         - Switch port configurations needed
         - VLAN assignments per device

         DEVICE ONBOARDING (per device — follow onboarding sequence):
         - network/infra → DSP → video → control → UC → scheduling → signage

         CONTROL SYSTEM:
         - Starting template + customizations needed
         - All device integrations (RS-232 strings, TCP commands, REST calls)
         - Button/preset logic
         - Startup sequence with timing

         TOUCH PANEL UI:
         - Screens and navigation
         - Device control widgets

         UC INTEGRATION:
         - MTR | Zoom Rooms | Webex setup steps
         - Camera, mic, speaker routing in UC mode vs. local mode

         DANTE / AUDIO:
         - Device names for each audio device
         - Subscriptions to create in Dante Controller
         - Gain structure and preset names
         - Clock master assignment

         MONITORING:
         - SNMP OIDs to poll per device
         - Alert thresholds

[ ] 3.2  Planner must define the as-built template in the plan:
         Signal path diagram (ASCII art acceptable)
         Equipment table with rack positions

[ ] 3.3  ⚠ HUMAN REVIEW GATE ⚠ — MANDATORY for room integrations
         "Here is the full AV integration plan for {room_id}. This is a significant
          change. Please review — especially:
          1. Signal path: does it match your design intent?
          2. Control system logic: does the startup sequence match AV policy?
          3. Dante: is the clock master assignment correct for your network?
          4. UC platform: is the peripheral mode setup correct for {MTR/Zoom/Webex}?
          5. Maintenance window: is the window sufficient for this scope?"
         [Wait for explicit approval — do NOT proceed without it]
```

---

## Phase 4: Implementation (Implementer → general-purpose agent)

```
[ ] 4.1  SPLIT implementation into logical groups — run sequentially:

         Batch 1 — Device drivers and inventory:
         - Create/extend all new device drivers in src/devices/
         - Add all devices to inventory YAML
         - Create src/rooms/{room_id}/config.yaml from room template

         Batch 2 — Control system:
         - Adapt control system template for this room
         - Implement all device integrations
         - Create touch panel UI project

         Batch 3 — Python API integrations:
         - Room control API endpoints (if needed)
         - Monitoring integrations
         - Scheduler integrations

         Batch 4 — Tests:
         - Device driver unit tests
         - Room config validation tests
         - Control system logic tests (if testable)

[ ] 4.2  After each batch: review implementation-summary.md before launching next batch
         Do not batch-launch all 4 simultaneously — dependencies exist between batches.
```

---

## Phase 5: Testing (Tester → general-purpose agent)

```
[ ] 5.1  Unit test scope:
         - All new device drivers
         - Room config YAML schema validation
         - Inventory validation
         - Python API endpoint tests

[ ] 5.2  Integration test checklist (human in the room):
         Tester documents this checklist in test-results.md — not executed by agent

         SIGNAL PATH:
         [ ] All video sources route to correct displays
         [ ] No HDCP errors on any input-output combination
         [ ] Audio routes from all expected sources (local mic, UC far-end, PC audio)
         [ ] Dante subscriptions active in Dante Controller

         CONTROL:
         [ ] System startup from touch panel — all devices come online in sequence
         [ ] System shutdown — all displays power off, lights activate if integrated
         [ ] Each button and preset on touch panel works as designed
         [ ] Room scheduling panel (if present) shows correct room name and calendar

         UC PLATFORM:
         [ ] Camera, mic, speaker selectable in Teams/Zoom/Webex settings
         [ ] Content sharing works (HDMI and wireless)
         [ ] BYOD laptop auto-detects room system
         [ ] Echo cancellation active — no audio feedback loop

         MONITORING:
         [ ] Device appears in SNMP monitoring
         [ ] Alert thresholds trigger correctly in test
```

---

## Phase 6: Code Review (Reviewer → general-purpose agent)

```
[ ] 6.1  Reviewer focus for room integrations:
         Security:
         - No hardcoded credentials in any file
         - AV devices on correct VLAN (not bridged to corporate LAN)
         - REST calls use HTTPS

         Reliability:
         - Control system startup has correct timing delays
         - Q-SYS / Crestron handles all device-offline states
         - Dante startup delay present if audio device integrated
         - Manual override procedure is possible (no single point of failure)

         Completeness:
         - Every device in the equipment list has a driver
         - Every device is in the room config YAML
         - Signal path complete in config (all inputs and outputs)

[ ] 6.2  Verdict — BLOCK if:
         - Any hardcoded credentials
         - Any missing Dante startup delay for audio devices
         - Control system has no handling for device-offline states in a boardroom/critical room
```

---

## Phase 7: Documentation (Documenter → general-purpose agent)

```
[ ] 7.1  Create full as-built document:
         docs/as-built/{building}-{room}.md
         Must include:
         - Complete equipment table (device ID, model, FW, IP, rack position)
         - Full signal path diagram (video AND audio AND control)
         - Startup and shutdown procedure
         - Emergency manual override steps for each major system
         - Known quirks or limitations

[ ] 7.2  Create startup runbook:
         docs/runbooks/{room_id}-startup.md
         Step-by-step for a new user or helpdesk technician

[ ] 7.3  Create quick-reference card (for printing and posting in room):
         docs/quick-ref/{room_id}-quick-ref.md
         One page: how to start, how to share content, who to call for help

[ ] 7.4  Update building inventory:
         docs/inventory/{building}.md — add all new devices

[ ] 7.5  CHANGELOG entry:
         "feat({room_id}): complete AV integration — {room_type} with {UC_platform}"

[ ] 7.6  Create PR
```

---

## Phase 8: Completion

```
[ ] 8.1  Summarize for user:
         Room: {room_id} — {display_name}
         Type: {room_type}
         Devices onboarded: {count}
         UC Platform: {platform}
         Control system: {platform} — program: {filename}
         Dante devices: {list of Dante device names}
         As-built: docs/as-built/{building}-{room}.md
         Quick-ref: docs/quick-ref/{room_id}-quick-ref.md
         PR: {URL}

[ ] 8.2  Post-integration human checklist (for AV team):
         [ ] Change all default passwords (update IT vault)
         [ ] Add all devices to monitoring (SNMP)
         [ ] Run Dante Controller — verify all subscriptions
         [ ] Conduct user acceptance test with stakeholder
         [ ] Post quick-reference card in room
         [ ] Update digital signage room directory if applicable
         [ ] Schedule 30-day follow-up check
```
