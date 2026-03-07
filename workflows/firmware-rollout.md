# Workflow: Firmware Rollout

> Use this workflow when updating firmware on one or more AV devices.
> This applies to: control processors, DSPs, displays, cameras, codecs, switchers,
> AVoIP nodes, amplifiers, scheduling panels, and signage players.
>
> ⚠ Firmware updates are high-risk: always back up configs first, always test on
> one device before fleet-wide rollout.
>
> Agents: Orchestrator → Researcher → Planner → Implementer → Tester → Reviewer → Documenter

---

## Prerequisites

- [ ] Target firmware version confirmed (not just "latest" — specify exact version)
- [ ] Firmware file downloaded from vendor portal and checksum verified
- [ ] Maintenance window approved for each affected room/building
- [ ] Config backup procedure confirmed (device must support export)
- [ ] Rollback firmware available (keep previous version on hand)
- [ ] Staging/lab device available for first test flash (highly recommended)

---

## Phase 1: Setup (Orchestrator)

```
[ ] 1.1  Gather required info (AskUserQuestion if missing):
         - Target device model(s)
         - Scope: single device | single room | building | fleet-wide
         - Current firmware version(s)
         - Target firmware version
         - Vendor firmware download URL or local file path
         - Approved maintenance window(s)
         - Staging device available? (Y/N)

[ ] 1.2  Create .agent-workspace/task.md:
         task_type: firmware
         device_scope: {model(s)} — {hostnames or "fleet"}
         acceptance_criteria:
           - All target devices running target firmware version
           - Config preserved post-upgrade (no preset/setting loss)
           - Device online and API responsive after upgrade
           - Dante subscriptions restored (if audio device)
           - All rooms confirmed operational post-upgrade

[ ] 1.3  Snapshot all affected devices:
         python scripts/firmware_audit.py --scope {scope} \
           > .agent-workspace/firmware-pre-upgrade-snapshot.json

[ ] 1.4  Create TodoWrite task list
```

---

## Phase 2: Research (Researcher → Explore agent)

```
[ ] 2.1  Launch TWO Researchers in PARALLEL:
         Agent A: Codebase research
         - Find all device driver files for target model
         - Find inventory records for all affected devices
         - Find current firmware versions per device
         - Identify any API changes between current and target firmware
           (driver may need updating for new API version)

         Agent B: Vendor research (web-heavy)
         - Fetch release notes for target firmware from vendor site
         - Identify: new features, breaking changes, deprecated APIs
         - Identify: known post-upgrade issues and mitigations
         - Identify: upgrade path (can we go direct, or is intermediate required?)
         - Check Dante firmware compatibility matrix if audio device

[ ] 2.2  Wait for both research files:
         .agent-workspace/research-codebase.md
         .agent-workspace/research-vendor-docs.md

[ ] 2.3  Orchestrator reviews:
         STOP and escalate to user if:
         - Release notes show breaking API changes that require driver updates
         - Intermediate firmware step is required (can't skip versions)
         - Known critical bug in target firmware that affects this device's use case
         - Dante firmware incompatibility with other devices on same network
```

**Research output:** `.agent-workspace/research-codebase.md` + `.agent-workspace/research-vendor-docs.md`

---

## Phase 3: Planning (Planner → Plan agent)

```
[ ] 3.1  Launch Planner with firmware rollout context
         Plan must include:

         Pre-upgrade steps (PER DEVICE):
         a. Export/backup device configuration
         b. Document current firmware version
         c. Verify network path to device upgrade interface

         Upgrade steps:
         d. Flash firmware (device-specific method: web UI, TFTP, vendor tool, API)
         e. Wait for reboot (documented reboot time per model)
         f. Verify firmware version via API or web UI
         g. Restore config if required
         h. Restore Dante subscriptions if audio device

         Driver update steps (if API changed):
         i. Update Python driver for new API
         j. Update integration tests
         k. Validate driver against new firmware

         Rollout strategy:
         - Phase 1: staging/lab device (if available) — validate before proceeding
         - Phase 2: one production device — validate
         - Phase 3: remaining devices (parallel if same model, sequential if different)

         Rollback plan (per device):
         - Re-flash previous firmware from local file
         - Restore pre-upgrade config backup
         - Verify device operational

[ ] 3.2  ⚠ HUMAN REVIEW GATE ⚠
         "Here is the firmware rollout plan. Please review — specifically:
          1. Is the rollout order (lab → 1 prod → fleet) acceptable?
          2. Are the maintenance windows correct for each phase?
          3. Does the rollback procedure meet your risk tolerance?"
         [Wait for approval before proceeding]
```

**Planning output:** `.agent-workspace/implementation-plan.md`

---

## Phase 4: Implementation (Implementer → general-purpose agent)

```
[ ] 4.1  The Implementer handles CODE changes only:
         - Update Python device driver if API changed between firmware versions
         - Update firmware version constants in src/constants/devices.py
         - Update device inventory records with new firmware version
         - Generate upgrade scripts if vendor provides CLI/API upgrade path

         ⚠ The Implementer does NOT physically flash devices.
         ⚠ Physical firmware flashing is a separate human/script operation.
         ⚠ Document the exact flash procedure in the plan for the technician.

[ ] 4.2  Backup before driver edits:
         cp src/devices/{model}.py .agent-workspace/backups/{model}.py.bak

[ ] 4.3  Wait for .agent-workspace/implementation-summary.md
```

---

## Phase 4b: Physical Firmware Flash (Human or Automation Script)

```
This step is OUTSIDE the agent's scope — requires human technician or
an approved automation script. Document clearly in the plan.

For each device (in rollout order):

[ ] FW-1  Export current config:
          Method depends on vendor:
          - Crestron: Toolbox → Backup
          - Q-SYS: Designer → File → Backup to Network
          - Extron: System Builder → Backup
          - Biamp: Tesira software → File → Save
          Save to: .agent-workspace/backups/{device_id}-config-pre-{fw_version}.bak

[ ] FW-2  Flash firmware:
          Method depends on vendor:
          - Crestron: Toolbox → Package / Update
          - Q-SYS: Q-SYS Configurator → Upgrade
          - Extron: web UI → Firmware Update
          - Poly: web UI → System → Software Update
          Expected reboot time: {N} minutes (from vendor release notes)

[ ] FW-3  Verify firmware version after reboot:
          curl https://{hostname}/api/system/info | jq '.firmware'
          Must match target version: {target_fw}

[ ] FW-4  Restore config if device factory-reset during upgrade:
          (Most devices preserve config — check release notes for exceptions)

[ ] FW-5  Restore Dante subscriptions (audio devices):
          Open Dante Controller → verify all subscriptions present
          If missing: reload from .agent-workspace/backups/{room}-dante-routing.csv
```

---

## Phase 5: Testing (Tester → general-purpose agent)

```
[ ] 5.1  Launch Tester — two scopes:
         a. Code tests (unit):
            - pytest tests/devices/test_{model}.py -v
            - ruff check src/devices/{model}.py
            - Verify driver works against new firmware API (mock tests)

         b. Integration validation checklist (report on, but don't run live):
            Write test-results.md section listing manual validation steps required
            after each device is physically upgraded.

[ ] 5.2  Manual validation steps to document (for technician):
         [ ] Device responds to ping
         [ ] API returns correct firmware version
         [ ] Config presets loaded correctly
         [ ] Signal path functional (source → display or audio path)
         [ ] Dante subscriptions active (for audio devices)
         [ ] Control system can communicate with device
         [ ] Room end-to-end test: start a meeting, check audio/video
```

---

## Phase 6: Code Review (Reviewer → general-purpose agent)

```
[ ] 6.1  Reviewer focus for firmware rollouts:
         - Driver API changes are backward compatible or versioned
         - No new hardcoded firmware version strings in source (use constants)
         - Rollback procedure is documented and achievable
         - Release notes for breaking changes are reflected in driver
         - Dante compatibility confirmed in research (reviewer checks this was addressed)

[ ] 6.2  Verdict handling as per standard workflow
```

---

## Phase 7: Documentation (Documenter → general-purpose agent)

```
[ ] 7.1  Update per-device firmware versions in:
         - docs/inventory/{building}.md — update firmware column for each device
         - src/inventory/devices.yaml — update firmware field

[ ] 7.2  Update driver documentation:
         - API version compatibility notes in driver file docstring
         - CHANGELOG entry:
           "firmware({scope}): upgrade {model} from {old_fw} to {new_fw}"

[ ] 7.3  If driver API changed:
         - Update docs/api.md if device control API surface changed
         - Note migration path for any API consumers

[ ] 7.4  Create PR
```

---

## Phase 8: Completion

```
[ ] 8.1  Confirm all devices in scope are on target firmware
         Run post-upgrade audit: python scripts/firmware_audit.py --scope {scope}
         Compare against .agent-workspace/firmware-pre-upgrade-snapshot.json

[ ] 8.2  Summarize for user:
         - Devices upgraded: {count}
         - Target firmware: {version}
         - Driver updated: {yes/no}
         - Rooms validated: {list}
         - PR: {URL}

[ ] 8.3  Archive config backups:
         Move .agent-workspace/backups/ → docs/backups/{date}/ (or configured archive)
```

---

## Rollback Decision Tree

```
Post-upgrade issue observed:
      │
      ├─► Device offline after flash?
      │     └─► Check: power cycle, console access, TFTP recovery mode
      │         If unrecoverable: escalate to vendor support
      │
      ├─► Device online but API broken?
      │     └─► Check firmware version (flash may have failed)
      │         If wrong version: re-flash target firmware
      │         If correct version: check driver for API changes missed
      │
      ├─► Config lost after upgrade?
      │     └─► Restore from .agent-workspace/backups/{device_id}-config-pre-{fw}.bak
      │
      ├─► Dante subscriptions lost?
      │     └─► Open Dante Controller → restore from backup .csv
      │
      └─► Critical functionality broken, no fix available?
            └─► ROLLBACK: flash previous firmware version
                Restore previous config backup
                Document in post-mortem
```
