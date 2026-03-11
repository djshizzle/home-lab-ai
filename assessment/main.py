"""CLI entry point for the AV Operations Assessment Tool.

Usage:
    python assessment/main.py run --org "Acme Corp" --site "HQ" --output ./reports/
    python assessment/main.py run --org "Acme Corp" --site "HQ" --skip-probes --output ./reports/
    python assessment/main.py probe --hosts 10.10.20.0/24 --community public
    python assessment/main.py list-domains
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date
from pathlib import Path

from rich.console import Console

console = Console()

# Resolve paths relative to this file's directory
_TOOL_DIR = Path(__file__).parent
_DEFAULT_QUESTIONS_PATH = str(_TOOL_DIR / "data" / "checklist_questions.yaml")
_DEFAULT_OUTPUT_DIR = str(Path.cwd() / "reports")


def _ensure_assessment_importable() -> None:
    """Add the repo root to sys.path so `assessment` is importable as a package."""
    repo_root = str(_TOOL_DIR.parent)
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)


_ensure_assessment_importable()


def cmd_run(args: argparse.Namespace) -> None:
    """Run the full interactive assessment (checklist + optional probes)."""
    from assessment.checklist import load_domain_metadata, run_full_checklist
    from assessment.device_probe import build_probe_summary, probe_range, score_probe_results
    from assessment.report import print_terminal_summary, write_reports
    from assessment.scoring import build_assessment_result

    questions_path = args.questions or _DEFAULT_QUESTIONS_PATH
    output_dir = args.output or _DEFAULT_OUTPUT_DIR
    assessment_date = args.date or str(date.today())
    assessor = args.assessor or os.environ.get("USER", "unknown")

    console.print(
        f"\n[bold blue]AV Operations Assessment[/bold blue]"
        f"\n  Org: [cyan]{args.org}[/cyan]"
        f"\n  Site: [cyan]{args.site}[/cyan]"
        f"\n  Date: [cyan]{assessment_date}[/cyan]"
        f"\n  Assessor: [cyan]{assessor}[/cyan]\n"
    )

    # 1. Run interactive checklist
    domains = args.domains.split(",") if args.domains else None
    checklist_scores = run_full_checklist(questions_path, domains=domains)

    # 2. Run automated probes
    probe_scores = None
    probe_summary = {}
    skipped_probes = args.skip_probes

    if not skipped_probes:
        if not args.hosts:
            console.print(
                "\n[yellow]No --hosts specified. Skipping automated device probes.[/yellow]"
                "\nTip: use --hosts 10.10.20.0/24 to probe a subnet, or --skip-probes to suppress this message.\n"
            )
            skipped_probes = True
        else:
            probe_results = probe_range(
                args.hosts,
                community=args.community or "public",
            )
            probe_scores = score_probe_results(probe_results)
            probe_summary = build_probe_summary(probe_results)

    # 3. Load domain metadata (names)
    domain_metadata = load_domain_metadata(questions_path)

    # 4. Score and build result
    result = build_assessment_result(
        org=args.org,
        site=args.site,
        date=assessment_date,
        assessor=assessor,
        checklist_scores=checklist_scores,
        domain_metadata=domain_metadata,
        probe_scores=probe_scores,
        probe_summary=probe_summary,
        skipped_probes=skipped_probes,
    )

    # 5. Print terminal summary
    print_terminal_summary(result)

    # 6. Write reports
    write_reports(result, output_dir)


def cmd_probe(args: argparse.Namespace) -> None:
    """Run a standalone probe against one or more hosts."""
    from assessment.device_probe import build_probe_summary, probe_range

    if not args.hosts:
        console.print("[red]Error: --hosts is required for the probe command.[/red]")
        sys.exit(1)

    probe_results = probe_range(
        args.hosts,
        community=args.community or "public",
    )
    summary = build_probe_summary(probe_results)

    console.print("\n[bold]Probe Summary[/bold]")
    console.print(f"  Hosts probed: {summary.get('total_hosts', 0)}")
    console.print(f"  Online: {summary.get('online_count', 0)} ({summary.get('online_ratio', 0):.0%})")
    console.print(
        f"  SNMP responding: {summary.get('snmp_count', 0)} ({summary.get('snmp_ratio', 0):.0%})"
    )

    if args.verbose:
        console.print("\n[bold]Device Details:[/bold]")
        for device in probe_results:
            status = "[green]ONLINE[/green]" if device["online"] else "[red]OFFLINE[/red]"
            snmp = "[cyan]SNMP OK[/cyan]" if device["snmp_ok"] else "[dim]no SNMP[/dim]"
            name = device.get("sys_name") or ""
            descr = (device.get("sys_descr") or "")[:60]
            console.print(f"  {device['host']:18s} {status}  {snmp}  {name}  {descr}")


def cmd_list_domains(args: argparse.Namespace) -> None:  # noqa: ARG001
    """List all available assessment domains and question counts."""
    from assessment.checklist import load_questions

    questions_path = args.questions if hasattr(args, "questions") and args.questions else _DEFAULT_QUESTIONS_PATH
    all_questions = load_questions(questions_path)

    console.print("\n[bold]Available Assessment Domains:[/bold]\n")
    for domain_id, questions in all_questions.items():
        console.print(f"  [cyan]{domain_id}[/cyan]  ({len(questions)} questions)")
    console.print()


def build_parser() -> argparse.ArgumentParser:
    """Build and return the CLI argument parser."""
    parser = argparse.ArgumentParser(
        prog="avops-assess",
        description="AV Operations Assessment Tool — internal audit framework for enterprise AV teams.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # ── run ──────────────────────────────────────────────────────────────────
    run_p = subparsers.add_parser("run", help="Run a full assessment (checklist + probes)")
    run_p.add_argument("--org", required=True, help="Organization name")
    run_p.add_argument("--site", required=True, help="Site or building name")
    run_p.add_argument("--assessor", help="Assessor name (defaults to $USER)")
    run_p.add_argument("--date", help="Assessment date (YYYY-MM-DD, defaults to today)")
    run_p.add_argument("--output", default=_DEFAULT_OUTPUT_DIR, help="Output directory for reports")
    run_p.add_argument(
        "--questions",
        default=_DEFAULT_QUESTIONS_PATH,
        help="Path to checklist_questions.yaml",
    )
    run_p.add_argument(
        "--domains",
        help="Comma-separated list of domain IDs to assess (default: all)",
    )
    run_p.add_argument(
        "--hosts",
        help="IP, CIDR range, or comma-separated list to probe (e.g. 10.10.20.0/24)",
    )
    run_p.add_argument(
        "--community",
        default="public",
        help="SNMP community string (default: public)",
    )
    run_p.add_argument(
        "--skip-probes",
        action="store_true",
        help="Skip automated device probes and use checklist responses only",
    )
    run_p.set_defaults(func=cmd_run)

    # ── probe ─────────────────────────────────────────────────────────────────
    probe_p = subparsers.add_parser("probe", help="Run standalone device probes")
    probe_p.add_argument(
        "--hosts",
        required=True,
        help="IP, CIDR range, or comma-separated targets",
    )
    probe_p.add_argument("--community", default="public", help="SNMP community string")
    probe_p.add_argument("--verbose", "-v", action="store_true", help="Show per-device details")
    probe_p.set_defaults(func=cmd_probe)

    # ── list-domains ──────────────────────────────────────────────────────────
    list_p = subparsers.add_parser("list-domains", help="List available assessment domains")
    list_p.add_argument("--questions", default=_DEFAULT_QUESTIONS_PATH)
    list_p.set_defaults(func=cmd_list_domains)

    return parser


def main() -> None:
    """Main CLI entry point."""
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
