"""Scoring engine for the AV Operations Assessment Tool."""

from __future__ import annotations

from assessment.constants import (
    DOMAIN_WEIGHTS,
    MATURITY_THRESHOLDS,
    SCORE_MAX_PER_QUESTION,
)
from assessment.models import AssessmentResult, DomainResult, QuestionScore

# Per-domain findings templates keyed by question_id and score
_FINDINGS: dict[str, dict[int, str]] = {
    "dh_01": {
        0: "No AV device inventory exists — asset tracking is absent.",
        1: "Device inventory is incomplete; key fields (IP, firmware, location) are missing for some devices.",
    },
    "dh_02": {
        0: "No automated device monitoring — faults discovered only via user complaints.",
        1: "Monitoring coverage is below 70%; some devices are unobserved.",
    },
    "dh_03": {
        0: "Firmware updates are ad-hoc with no tracking or defined cadence.",
        1: "Firmware tracking exists but coverage or cadence is inconsistent.",
    },
    "dh_04": {
        0: "End-of-life devices are not tracked and no replacement planning exists.",
        1: "EOL devices identified informally but no funded replacement roadmap.",
    },
    "dh_05": {
        0: "No MTTR data captured — performance against SLA cannot be measured.",
        1: "Tickets are logged but MTTR is not measured or reported.",
    },
    "dh_06": {
        0: "Control system programs not backed up — programs exist only on devices.",
        1: "Ad-hoc backups exist but are not versioned or systematically maintained.",
    },
    "om_01": {
        0: "No written SOPs — all operational knowledge is tribal and verbal.",
        1: "SOPs exist but are incomplete, outdated, or inconsistently followed.",
    },
    "om_02": {
        0: "No ticketing system in use — all requests handled informally.",
        1: "Ticketing system available but AV team usage is inconsistent.",
    },
    "om_03": {
        0: "Changes to AV systems are made ad-hoc with no approval process.",
        1: "Informal change approval exists but no structured change control or rollback plan.",
    },
    "om_04": {
        0: "No preventive maintenance program — all maintenance is reactive.",
        1: "Some PM activities occur but no defined schedule or complete documentation.",
    },
    "om_05": {
        0: "No incident response runbooks — staff improvise during critical failures.",
        1: "Informal incident guidance exists but not documented as formal runbooks.",
    },
    "om_06": {
        0: "No AV system usage or room utilization data is collected or reviewed.",
        1: "Utilization data available but not regularly reviewed or acted upon.",
    },
    "ai_01": {
        0: "AV devices are not segmented — on the corporate LAN or mixed VLANs.",
        1: "AV VLAN exists but segmentation is inconsistent or incomplete.",
    },
    "ai_02": {
        0: "Dante/AES67 routing is not locked — anyone on the network can change audio routes.",
        1: "Dante in use but routing not locked or not regularly audited.",
    },
    "ai_03": {
        0: "No signal path documentation exists for any AV system.",
        1: "Signal path documentation is incomplete — not all major systems covered.",
    },
    "ai_04": {
        0: "No manual override procedures — rooms are unusable if the control system fails.",
        1: "Manual override is possible but not documented or communicated to staff.",
    },
    "ai_05": {
        0: "AVoIP infrastructure is undocumented and unmonitored.",
        1: "Partial AVoIP documentation or monitoring — coverage is incomplete.",
    },
    "sc_01": {
        0: "Default credentials confirmed or no policy requiring credential changes.",
        1: "Credential change policy exists but is not consistently enforced or audited.",
    },
    "sc_02": {
        0: "Credentials stored in plain-text files, spreadsheets, or shared documents.",
        1: "Secure storage used inconsistently across the team.",
    },
    "sc_03": {
        0: "AV devices are directly internet-accessible or remote access is uncontrolled.",
        1: "VPN required but remote access sessions are not logged or reviewed.",
    },
}

# Per-domain recommendations keyed by maturity level
_RECOMMENDATIONS: dict[str, dict[int, list[str]]] = {
    "device_health": {
        1: [
            "Immediately create a complete AV device inventory with model, serial, IP, firmware, and location.",
            "Implement basic ICMP/SNMP monitoring (PRTG, Zabbix, or Crestron XiO) for all managed devices.",
            "Back up all control system programs (Crestron, Q-SYS, AMX) to a shared network location.",
            "Identify all end-of-life devices and escalate replacement to capital planning.",
        ],
        2: [
            "Define a quarterly firmware audit cadence and assign ownership.",
            "Expand monitoring coverage to all AV endpoints with alerting to on-call staff.",
            "Implement version control (Git) for control system program backups.",
            "Establish MTTR tracking within the ticketing system.",
        ],
        3: [
            "Automate inventory reconciliation against monitoring data.",
            "Integrate firmware audit results into the change management process.",
            "Build EOL device replacement into a 3-year capital refresh cycle.",
        ],
        4: [
            "Adopt a vendor fleet management platform (Crestron XiO Cloud, Q-SYS Reflect).",
            "Implement automated MTTR reporting and SLA dashboards.",
        ],
        5: [],
    },
    "operations_maturity": {
        1: [
            "Create SOPs for the top 5 most common AV tasks and post them in a shared wiki.",
            "Adopt a ticketing system (ServiceNow, Jira) and require all AV requests to be logged.",
            "Define a simple change request form and require approval before any AV system change.",
            "Establish a minimum quarterly PM schedule with documented checklists.",
        ],
        2: [
            "Review and update all SOPs annually — add 'last reviewed' dates.",
            "Create incident response runbooks for the top 3 critical failure scenarios.",
            "Integrate AV change requests into the IT Change Advisory Board (CAB) process.",
            "Begin pulling room utilization data from MTR/Zoom/Webex admin portals.",
        ],
        3: [
            "Expand runbooks to cover all critical failure scenarios with manual override steps.",
            "Report MTTR and ticket volume monthly to AV leadership.",
            "Use utilization data to right-size rooms and justify AV investments.",
        ],
        4: [
            "Automate PM scheduling and completion tracking.",
            "Measure SLA compliance and report to stakeholders quarterly.",
        ],
        5: [],
    },
    "av_infrastructure": {
        1: [
            "Immediately place all AV devices on a dedicated AV VLAN — coordinate with network team.",
            "Lock Dante/AES67 routing in Dante Controller for all active deployments.",
            "Document signal paths for the top 5 most-used conference rooms.",
            "Create manual override quick-reference cards and post them in all critical rooms.",
        ],
        2: [
            "Create a Dante network topology diagram and update it after every change.",
            "Document signal paths for all remaining AV systems as-built.",
            "Inventory all AVoIP endpoints (encoders, decoders) with IPs and stream assignments.",
            "Verify IGMP snooping is enabled on all switches carrying AVoIP/Dante traffic.",
        ],
        3: [
            "Implement health monitoring for AVoIP infrastructure.",
            "Conduct annual review of firewall rules between AV VLAN and corporate LAN.",
        ],
        4: [
            "Adopt AVoIP management platform (NVX Director, Extron NAV) for centralized monitoring.",
        ],
        5: [],
    },
    "security_compliance": {
        1: [
            "Immediately audit and change all default credentials on AV devices.",
            "Migrate all device credentials from spreadsheets to a password manager (1Password, Bitwarden).",
            "Remove any direct internet exposure of AV devices — require VPN for remote access.",
        ],
        2: [
            "Implement annual credential rotation policy and assign ownership.",
            "Enable and review remote access logs monthly.",
            "Add AV device credential audit to the onboarding/offboarding checklist for staff.",
        ],
        3: [
            "Adopt role-based access control for AV device management credentials.",
            "Integrate AV device patch compliance into IT security reporting.",
        ],
        4: [],
        5: [],
    },
}


def calculate_maturity(score: float) -> tuple[int, str]:
    """Return (maturity_level, maturity_label) for a given 0–100 score."""
    for min_score, level, label in MATURITY_THRESHOLDS:
        if score >= min_score:
            return level, label
    return 1, "Initial"


def generate_findings(question_scores: list[QuestionScore]) -> list[str]:
    """Generate human-readable findings for all questions scored below 2."""
    findings: list[str] = []
    for qs in question_scores:
        if qs.score < 2 and qs.question_id in _FINDINGS:
            template = _FINDINGS[qs.question_id].get(qs.score)
            if template:
                finding = template
                if qs.notes:
                    finding += f" (Note: {qs.notes})"
                findings.append(finding)
    return findings


def generate_recommendations(domain_id: str, maturity_level: int) -> list[str]:
    """Return priority recommendations for a domain based on its maturity level."""
    domain_recs = _RECOMMENDATIONS.get(domain_id, {})
    recs: list[str] = []
    # Include recommendations for all levels up to and including current maturity
    for level in range(1, maturity_level + 1):
        recs.extend(domain_recs.get(level, []))
    return recs


def score_domain(
    domain_id: str,
    domain_name: str,
    question_scores: list[QuestionScore],
) -> DomainResult:
    """Calculate the score and maturity for a single domain."""
    if not question_scores:
        return DomainResult(
            domain_id=domain_id,
            domain_name=domain_name,
            score=0.0,
            maturity_level=1,
            maturity_label="Initial",
            question_scores=[],
            findings=["No questions answered for this domain."],
            recommendations=generate_recommendations(domain_id, 1),
        )

    weighted_sum = sum(qs.score * qs.weight for qs in question_scores)
    max_possible = sum(SCORE_MAX_PER_QUESTION * qs.weight for qs in question_scores)
    score = (weighted_sum / max_possible) * 100 if max_possible > 0 else 0.0

    maturity_level, maturity_label = calculate_maturity(score)
    findings = generate_findings(question_scores)
    recommendations = generate_recommendations(domain_id, maturity_level)

    return DomainResult(
        domain_id=domain_id,
        domain_name=domain_name,
        score=score,
        maturity_level=maturity_level,
        maturity_label=maturity_label,
        question_scores=question_scores,
        findings=findings,
        recommendations=recommendations,
    )


def calculate_overall(
    domain_results: list[DomainResult],
    weights: dict[str, float] | None = None,
) -> tuple[float, int, str]:
    """
    Calculate the weighted overall score and maturity.

    Returns (overall_score, maturity_level, maturity_label).
    """
    if weights is None:
        weights = DOMAIN_WEIGHTS

    total_weight = 0.0
    weighted_score = 0.0

    for domain in domain_results:
        w = weights.get(domain.domain_id, 0.0)
        weighted_score += domain.score * w
        total_weight += w

    overall = weighted_score / total_weight if total_weight > 0 else 0.0
    maturity_level, maturity_label = calculate_maturity(overall)
    return overall, maturity_level, maturity_label


def build_assessment_result(
    org: str,
    site: str,
    date: str,
    assessor: str,
    checklist_scores: dict[str, list[QuestionScore]],
    domain_metadata: dict[str, str],
    probe_scores: list[QuestionScore] | None = None,
    probe_summary: dict | None = None,
    skipped_probes: bool = False,
) -> AssessmentResult:
    """
    Combine checklist + probe scores into a complete AssessmentResult.

    probe_scores are injected into the device_health domain if provided.
    """
    domain_results: list[DomainResult] = []

    for domain_id, scores in checklist_scores.items():
        all_scores = list(scores)

        # Inject probe scores into device_health domain
        if domain_id == "device_health" and probe_scores:
            all_scores = list(scores) + probe_scores

        domain_name = domain_metadata.get(domain_id, domain_id)
        result = score_domain(domain_id, domain_name, all_scores)
        domain_results.append(result)

    overall_score, overall_maturity, overall_label = calculate_overall(domain_results)

    return AssessmentResult(
        org=org,
        site=site,
        date=date,
        assessor=assessor,
        overall_score=overall_score,
        overall_maturity=overall_maturity,
        overall_maturity_label=overall_label,
        domain_results=domain_results,
        probe_summary=probe_summary or {},
        skipped_probes=skipped_probes,
    )
