# Workflow: AV Device Onboarding

> Use this workflow when adding a new AV device to the enterprise network and inventory.
> Covers: any device category — displays, control systems, DSPs, cameras, codecs,
> switchers, AVoIP encoders/decoders, amplifiers, room scheduling panels, signage players.
>
> Agents: Orchestrator → Researcher → Planner → Implementer → Tester → Reviewer → Documenter

---

## Prerequisites

- [ ] `.agent-workspace/` directory exists (run `./scripts/init-agent-team.sh` if not)
- [ ] Device is physically installed and powered on
- [ ] IP address or DHCP reservation confirmed
- [ ] AV VLAN assignment confirmed with network team
- [ ] Vendor default credentials available (will be changed during onboarding)
- [ ] Maintenance window approved (if device is in an active room)

---

## Phase 1: Setup (Orchestrator)

```
[ ] 1.1  Receive onboarding request from user
         Required info to gather (use AskUserQuestion if missing):
         - Device make / model / hardware revision
         - Firmware version (on box label or web UI)
         - Target room ID and building
         - IP address or hostname (if already assigned)
         - AV VLAN number
         - UC platform (if applicable: MTR | Zoom Rooms | Webex | None)

[ ] 1.2  Create .agent-workspace/task.md:
         task_type: onboarding
         device_scope: {model} — {hostname}
         room_scope: {room_id}
         acceptance_criteria:
           - Device driver implemented and returns status
           - Device appears in inventory with correct details
           - Room config updated with new device entry
           - Default credentials changed
           - Device reachable via ping and API
           - Documentation updated (as-built, inventory)

[ ] 1.3  Create TodoWrite task list with all phases below
[ ] 1.4  Snapshot current device inventory:
         python scripts/sync_inventory.py --room {room_id} --export \
           > .agent-workspace/device-inventory-snapshot.json
```

---

## Phase 2: Research (Researcher → Explore agent)

```
[ ] 2.1  Launch Researcher with onboarding checklist focus:
         Questions to answer:
         1. Does a device driver already exist for this model?
            (check src/devices/ — may be for older firmware)
         2. What is the vendor API? (REST, TCP, RS-232, SNMP?)
            Fetch vendor integration guide if available.
         3. What is the correct device ID and hostname format for this room?
         4. What existing room config template applies to this room type?
         5. Are there firmware-specific API differences from the research notes?
         6. What Dante device name convention is used if this is an audio device?

[ ] 2.2  Wait for .agent-workspace/research-findings.md

[ ] 2.3  Orchestrator checks:
         - Is there an existing driver to extend (preferred) or must a new one be created?
         - Is the vendor API documented well enough to implement?
         - Any known firmware bugs for this version that affect integration?
         If vendor docs needed: re-run Researcher with WebFetch focus
```

**Research output:** `.agent-workspace/research-findings.md`

---

## Phase 3: Planning (Planner → Plan agent)

```
[ ] 3.1  Launch Planner with onboarding context
         Key planning decisions:
         - New driver vs. extend existing driver?
         - REST vs. TCP vs. RS-232 control?
         - Which room config YAML to update?
         - Credential storage: which env var name?
         - Dante clock domain assignment (if audio device)?

[ ] 3.2  Plan must include:
         - Device driver implementation steps (if new)
         - Inventory update steps
         - Room config update steps
         - Credential setup steps
         - Default credential change procedure (document only — Implementer executes via API)
         - Test plan: connectivity + API + schema validation
         - Rollback: how to remove device from inventory/config if onboarding fails

[ ] 3.3  ⚠ HUMAN REVIEW GATE ⚠
         Present plan to user:
         "Here is the onboarding plan for {model}. Please review — especially:
          1. Is the device ID format correct for your naming convention?
          2. Is the Dante device name correct (if applicable)?
          3. Is the maintenance window acceptable for the room config change?"
         [Wait for approval]
```

**Planning output:** `.agent-workspace/implementation-plan.md`

---

## Phase 4: Implementation (Implementer → general-purpose agent)

```
[ ] 4.1  Launch Implementer with onboarding implementation focus
         Step sequence (follow this order):
         a. Create/extend device driver in src/devices/
         b. Add device to src/inventory/devices.yaml (or room-specific inventory)
         c. Update src/rooms/{room_id}/config.yaml with new device entry
         d. Create test file in tests/devices/
         e. Document credential env var name (in .agent-workspace, NOT source)

[ ] 4.2  Implementer must:
         - Backup existing room config before editing:
           cp src/rooms/{room}/config.yaml .agent-workspace/backups/{room}-config.yaml.bak
         - Use DeviceBase inheritance for the driver
         - Set API_RATE_LIMIT from vendor documentation
         - Use env var for credentials (never hardcode)
         - Device ID format: {building}-{room}-{type}-{index}

[ ] 4.3  Wait for .agent-workspace/implementation-summary.md

[ ] 4.4  Review summary:
         - All steps completed?
         - Backup created?
         - No hardcoded credentials?
```

**Implementation output:** `.agent-workspace/implementation-summary.md` + code changes

---

## Phase 5: Testing (Tester → general-purpose agent)

```
[ ] 5.1  Launch Tester — unit tests only (no live device access)
         Tests to run:
         - pytest tests/devices/test_{model}.py -v
         - pytest tests/rooms/test_{room_id}.py -v
         - python scripts/validate_room_configs.py --room {room_id}
         - python scripts/validate_device_inventory.py
         - ruff check src/devices/{model}.py

[ ] 5.2  Acceptance criteria for PASS:
         - Driver inherits DeviceBase ✓
         - API_RATE_LIMIT defined ✓
         - Credentials from env var ✓
         - Device ID format valid ✓
         - Room config YAML validates against schema ✓
         - Signal path entries complete ✓
         - All test stubs run (even if marked pytest.mark.integration for lab) ✓

[ ] 5.3  If FAIL: route back to Implementer with specific failure + fix suggestion

[ ] 5.4  If PASS: proceed to Phase 6
```

**Testing output:** `.agent-workspace/test-results.md`

---

## Phase 6: Code Review (Reviewer → general-purpose agent)

```
[ ] 6.1  Launch Reviewer — focus on security and AV standards:
         - No hardcoded credentials (BLOCK if found)
         - HTTPS used for REST calls (not HTTP) — BLOCK if plain HTTP to device
         - DeviceBase inheritance correct
         - API rate limit defined and correct per vendor docs
         - Device ID and hostname follow naming conventions
         - Room config complete (all required fields present)

[ ] 6.2  Verdict handling:
         APPROVE → Phase 7
         REQUEST CHANGES → Implementer → Tester → Reviewer (max 2 cycles)
         BLOCK → Stop, escalate to user
```

**Review output:** `.agent-workspace/review-report.md`

---

## Phase 7: Documentation (Documenter → general-purpose agent)

```
[ ] 7.1  Launch Documenter with onboarding docs focus:
         Files to update:
         - docs/as-built/{building}-{room}.md — add device to equipment list
           and update signal path if applicable
         - docs/inventory/{building}.md — add device row with ID, model, FW, hostname
         - docs/runbooks/{room}-startup.md — update if startup sequence changes
         - CHANGELOG.md — add entry: "device({room}): add {model} {device_id}"

[ ] 7.2  As-built must include:
         - Rack position or physical location
         - All cable connections (what connects to what)
         - Manual override procedure for emergency
         - Default credential change confirmation note

[ ] 7.3  Confirm PR creation with user before running gh pr create
```

**Documentation output:** Updated docs + `.agent-workspace/pr-description.md`

---

## Phase 8: Completion (Orchestrator)

```
[ ] 8.1  Mark all TodoWrite tasks complete
[ ] 8.2  Summarize for user:
         - Device: {make} {model} — {device_id}
         - Room: {room_id}
         - Driver: {new | extended existing}
         - Firmware: {version} (check against known-issues list)
         - Docs updated: as-built, inventory, CHANGELOG
         - PR: {URL}
         - Next steps: change default password in production (if not done via API)
[ ] 8.3  Credential reminder: "Please ensure the default password has been changed
         on {hostname} before this goes to production. Set env var {ENV_VAR_NAME}."
```

---

## Post-Onboarding Checklist (for human technician)

```
[ ] Change default device password (use IT password vault)
[ ] Set static IP or confirm DHCP reservation in DNS
[ ] Add to SNMP monitoring (Nagios / PRTG / LibreNMS)
[ ] Test all signal paths end-to-end in the room
[ ] Verify Dante routing in Dante Controller (if audio device)
[ ] Label the device with the device ID (asset tag)
[ ] Update the room's posted quick-reference card if startup procedure changed
```
