"""Report generation for the AV Operations Assessment Tool."""

from __future__ import annotations

import json
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.text import Text

from assessment.models import AssessmentResult

console = Console()

# Maturity level color mapping for terminal output
MATURITY_COLORS = {
    1: "red",
    2: "dark_orange",
    3: "yellow",
    4: "cyan",
    5: "green",
}


def _maturity_badge(level: int, label: str) -> str:
    """Return a markdown maturity badge string."""
    icons = {1: "🔴", 2: "🟠", 3: "🟡", 4: "🔵", 5: "🟢"}
    icon = icons.get(level, "⚪")
    return f"{icon} **Level {level} — {label}**"


def _score_bar(score: float, width: int = 20) -> str:
    """Return a simple text progress bar for a 0–100 score."""
    filled = int((score / 100) * width)
    bar = "█" * filled + "░" * (width - filled)
    return f"`{bar}` {score:.1f}%"


def render_markdown(result: AssessmentResult) -> str:
    """Render the full assessment result as a Markdown string."""
    lines: list[str] = []

    # ── Header ──────────────────────────────────────────────────────────────
    lines += [
        "# AV Operations Assessment Report",
        "",
        f"**Organization:** {result.org}  ",
        f"**Site:** {result.site}  ",
        f"**Date:** {result.date}  ",
        f"**Assessor:** {result.assessor}  ",
        "",
        "---",
        "",
    ]

    # ── Executive Summary ────────────────────────────────────────────────────
    lines += [
        "## Executive Summary",
        "",
        f"Overall Score: {_score_bar(result.overall_score)}",
        "",
        f"Overall Maturity: {_maturity_badge(result.overall_maturity, result.overall_maturity_label)}",
        "",
    ]

    if result.skipped_probes:
        lines += [
            "> **Note:** Automated device probes were skipped. "
            "Scores in Device Health reflect checklist responses only.",
            "",
        ]

    # Summary narrative based on overall maturity
    narratives = {
        1: (
            "The AV operations team is operating at an **Initial** level. "
            "Critical gaps exist in device tracking, process documentation, and infrastructure controls. "
            "Immediate action is required to establish foundational practices."
        ),
        2: (
            "The AV operations team is at a **Developing** level. "
            "Some practices are in place but coverage is inconsistent. "
            "Focus on formalizing processes and expanding monitoring coverage."
        ),
        3: (
            "The AV operations team operates at a **Defined** level. "
            "Core processes are documented and followed. "
            "The next priority is measuring and managing performance against defined targets."
        ),
        4: (
            "The AV operations team is at a **Managed** level. "
            "Processes are well-defined, measured, and actively managed. "
            "Focus on automation, continuous improvement, and proactive optimization."
        ),
        5: (
            "The AV operations team is at an **Optimizing** level — best-in-class operations. "
            "Continue investing in automation and industry leadership."
        ),
    }
    lines += [narratives.get(result.overall_maturity, ""), "", "---", ""]

    # ── Scope ────────────────────────────────────────────────────────────────
    lines += [
        "## Assessment Scope",
        "",
        "This assessment evaluated the following domains:",
        "",
    ]
    for domain in result.domain_results:
        lines.append(f"- {domain.domain_name}")
    lines += ["", "---", ""]

    # ── Domain Scores Summary Table ──────────────────────────────────────────
    lines += [
        "## Domain Scores Summary",
        "",
        "| Domain | Score | Maturity |",
        "|--------|-------|----------|",
    ]
    for domain in result.domain_results:
        badge = _maturity_badge(domain.maturity_level, domain.maturity_label)
        lines.append(f"| {domain.domain_name} | {domain.score:.1f}% | {badge} |")
    lines += ["", "---", ""]

    # ── Per-Domain Detail ────────────────────────────────────────────────────
    for domain in result.domain_results:
        lines += [
            f"## {domain.domain_name}",
            "",
            f"**Score:** {_score_bar(domain.score)}  ",
            f"**Maturity:** {_maturity_badge(domain.maturity_level, domain.maturity_label)}",
            "",
        ]

        if domain.findings:
            lines += ["### Findings", ""]
            for finding in domain.findings:
                lines.append(f"- {finding}")
            lines.append("")

        if domain.recommendations:
            lines += ["### Recommendations", ""]
            for rec in domain.recommendations:
                lines.append(f"- [ ] {rec}")
            lines.append("")

        lines += ["---", ""]

    # ── Probe Appendix ───────────────────────────────────────────────────────
    if result.probe_summary and not result.skipped_probes:
        ps = result.probe_summary
        lines += [
            "## Appendix A: Device Probe Results",
            "",
            f"- **Hosts probed:** {ps.get('total_hosts', 0)}",
            f"- **Online:** {ps.get('online_count', 0)} "
            f"({ps.get('online_ratio', 0):.0%})",
            f"- **SNMP responding:** {ps.get('snmp_count', 0)} "
            f"({ps.get('snmp_ratio', 0):.0%})",
            "",
            "| Host | Online | SNMP | System Name | Description |",
            "|------|--------|------|-------------|-------------|",
        ]
        for device in ps.get("devices", []):
            online_icon = "✅" if device.get("online") else "❌"
            snmp_icon = "✅" if device.get("snmp_ok") else "❌"
            name = device.get("sys_name") or "—"
            descr = (device.get("sys_descr") or "—")[:60]
            lines.append(
                f"| {device['host']} | {online_icon} | {snmp_icon} | {name} | {descr} |"
            )
        lines += ["", "---", ""]

    # ── Raw Question Responses ───────────────────────────────────────────────
    lines += ["## Appendix B: Raw Question Responses", ""]
    for domain in result.domain_results:
        lines += [f"### {domain.domain_name}", ""]
        lines += [
            "| Question ID | Score | Source | Notes |",
            "|-------------|-------|--------|-------|",
        ]
        for qs in domain.question_scores:
            score_label = {0: "0 — Not present", 1: "1 — Partial", 2: "2 — Fully met"}.get(
                qs.score, str(qs.score)
            )
            notes = qs.notes or "—"
            lines.append(
                f"| {qs.question_id} | {score_label} | {qs.source} | {notes} |"
            )
        lines.append("")

    return "\n".join(lines)


def render_json(result: AssessmentResult) -> str:
    """Serialize the assessment result to a formatted JSON string."""
    return json.dumps(result.to_dict(), indent=2)


def write_reports(result: AssessmentResult, output_dir: str) -> dict[str, str]:
    """
    Write Markdown and JSON reports to output_dir.

    Returns a dict with keys 'markdown' and 'json' pointing to the written file paths.
    """
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Sanitize date for filename
    date_slug = result.date.replace("-", "").replace("/", "").replace(" ", "")
    org_slug = result.org.lower().replace(" ", "_")[:20]
    base_name = f"assessment_{org_slug}_{date_slug}"

    md_path = out / f"{base_name}.md"
    json_path = out / f"{base_name}.json"

    md_path.write_text(render_markdown(result), encoding="utf-8")
    json_path.write_text(render_json(result), encoding="utf-8")

    console.print("\n[green]Reports written:[/green]")
    console.print(f"  Markdown → {md_path}")
    console.print(f"  JSON     → {json_path}")

    return {"markdown": str(md_path), "json": str(json_path)}


def print_terminal_summary(result: AssessmentResult) -> None:
    """Print a color-coded summary table to the terminal using rich."""
    console.print()

    # Overall score panel
    color = MATURITY_COLORS.get(result.overall_maturity, "white")
    console.print(
        f"\n[bold {color}]"
        f"Overall Score: {result.overall_score:.1f}%  |  "
        f"Maturity: Level {result.overall_maturity} — {result.overall_maturity_label}"
        f"[/bold {color}]\n"
    )

    # Domain summary table
    table = Table(
        title=f"AV Operations Assessment — {result.org} / {result.site}",
        show_header=True,
        header_style="bold blue",
    )
    table.add_column("Domain", style="white", min_width=30)
    table.add_column("Score", justify="right", min_width=8)
    table.add_column("Maturity", min_width=20)
    table.add_column("Top Finding", min_width=40)

    for domain in result.domain_results:
        color = MATURITY_COLORS.get(domain.maturity_level, "white")
        score_text = Text(f"{domain.score:.1f}%", style=f"bold {color}")
        maturity_text = Text(
            f"L{domain.maturity_level} {domain.maturity_label}", style=color
        )
        top_finding = domain.findings[0][:60] + "…" if domain.findings else "No findings"
        table.add_row(domain.domain_name, score_text, maturity_text, top_finding)

    console.print(table)
    console.print()
