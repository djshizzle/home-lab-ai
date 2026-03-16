"""CLI runner for the task decomposition system.

Provides both programmatic and command-line interfaces for decomposing
parent tasks and executing them through parallel sub-agents.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

from avops.decomposition.coordinator import ParallelCoordinator
from avops.decomposition.decomposer import TaskDecomposer
from avops.decomposition.models import ParentTask

logger = logging.getLogger(__name__)

WORKSPACE_DIR = Path(".claude/workspace")


def run_decomposition(
    task: ParentTask,
    *,
    use_ai_decomposition: bool = True,
    execute: bool = False,
    max_parallel: int = 4,
    output_dir: Path | None = None,
) -> dict:
    """Run the full decomposition pipeline for a parent task.

    Args:
        task: The parent task to decompose.
        use_ai_decomposition: If True, use Claude to decompose. If False,
            use rule-based heuristic.
        execute: If True, spawn sub-agents to execute subtasks.
        max_parallel: Maximum number of parallel sub-agents.
        output_dir: Directory for output files. Defaults to .claude/workspace/.

    Returns:
        Dict with decomposition results and optional execution report.
    """
    output_dir = output_dir or WORKSPACE_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    decomposer = TaskDecomposer()

    # Step 1: Decompose
    if use_ai_decomposition:
        subtasks = decomposer.decompose(task)
    else:
        subtasks = decomposer.decompose_static(task)

    # Write decomposition plan
    plan_dir = output_dir / "plans"
    plan_dir.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    plan_path = plan_dir / f"{date_str}-{task.task_id}-decomposition.md"

    plan_content = _render_decomposition_plan(task, subtasks)
    plan_path.write_text(plan_content)
    logger.info("Decomposition plan written to %s", plan_path)

    result = {
        "task_id": task.task_id,
        "title": task.title,
        "subtask_count": len(subtasks),
        "subtasks": [
            {
                "id": st.subtask_id,
                "title": st.title,
                "type": st.subtask_type.value,
                "agent_type": st.agent_type,
                "agent_model": st.agent_model,
                "dependencies": st.dependencies,
            }
            for st in subtasks
        ],
        "plan_path": str(plan_path),
    }

    # Step 2: Execute (optional)
    if execute:
        coordinator = ParallelCoordinator(max_parallel=max_parallel)
        report = coordinator.execute(task, subtasks)

        report_dir = output_dir / "reviews"
        report_dir.mkdir(parents=True, exist_ok=True)
        report_path = report_dir / f"{date_str}-{task.task_id}-report.md"
        report_path.write_text(report.to_markdown())
        logger.info("Execution report written to %s", report_path)

        result["execution"] = {
            "completed": report.completed,
            "failed": report.failed,
            "report_path": str(report_path),
        }

    return result


def _render_decomposition_plan(
    task: ParentTask, subtasks: list
) -> str:
    """Render the decomposition plan as markdown."""
    lines = [
        f"# Decomposition Plan: {task.task_id} — {task.title}",
        f"**Generated**: {datetime.now(timezone.utc).isoformat()}",
        f"**Status**: DRAFT",
        "",
        "## Parent Task",
        task.description,
        "",
        "## Subtasks",
        "",
        "| # | ID | Title | Type | Agent | Model | Dependencies |",
        "|---|-----|-------|------|-------|-------|-------------|",
    ]
    for i, st in enumerate(subtasks, 1):
        deps = ", ".join(st.dependencies) if st.dependencies else "—"
        lines.append(
            f"| {i} | {st.subtask_id} | {st.title} | "
            f"{st.subtask_type.value} | {st.agent_type} | "
            f"{st.agent_model} | {deps} |"
        )

    lines.append("")
    lines.append("## Subtask Details")
    lines.append("")

    for st in subtasks:
        lines.append(f"### {st.subtask_id}: {st.title}")
        lines.append(f"**Type**: {st.subtask_type.value}")
        lines.append(f"**Agent**: {st.agent_type} ({st.agent_model})")
        lines.append("")
        lines.append(st.description)
        lines.append("")
        if st.acceptance_criteria:
            lines.append("**Acceptance Criteria**:")
            for ac in st.acceptance_criteria:
                lines.append(f"- [ ] {ac}")
            lines.append("")
        if st.input_files:
            lines.append("**Input files**: " + ", ".join(
                f"`{f}`" for f in st.input_files
            ))
        if st.output_files:
            lines.append("**Output files**: " + ", ".join(
                f"`{f}`" for f in st.output_files
            ))
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


# ── AVA-13 Proof of Concept ──────────────────────────────────────────


def build_ava13_task() -> ParentTask:
    """Build the AVA-13 DJ Admin UI architecture blueprint parent task."""
    return ParentTask(
        task_id="AVA-13",
        title="DJ Admin UI Architecture Blueprint",
        description="""\
Design and document the architecture for a DJ Request Application admin UI.
The admin UI allows DJs to manage song requests during live events, with
real-time updates, queue management, and audience interaction features.

Key features:
1. Real-time song request queue with drag-and-drop reordering
2. DJ dashboard showing current track, upcoming requests, and audience stats
3. Request filtering and moderation (approve/reject/flag)
4. Audience interaction panel (shoutouts, polls, dedications)
5. Event configuration (genres, block list, request limits)
6. Analytics view (popular requests, peak times, audience engagement)

Technical requirements:
- React/TypeScript frontend with responsive design
- WebSocket for real-time updates
- REST API backend (FastAPI/Python)
- PostgreSQL for persistence
- Redis for real-time queue state
- Mobile-responsive for tablet use in DJ booth\
""",
        acceptance_criteria=[
            "Component hierarchy diagram with all major UI sections",
            "State management architecture (global vs local state boundaries)",
            "API contract definitions (REST endpoints + WebSocket events)",
            "Data model schema for requests, events, users, and queue",
            "Real-time update flow (WebSocket message types and handlers)",
            "Responsive layout strategy for desktop and tablet breakpoints",
        ],
        context_files=[
            "CLAUDE.md",
            "AGENT-TEAM-SETUP.md",
        ],
        constraints=[
            "Must support concurrent DJs on separate events",
            "Queue operations must be atomic (no lost requests)",
            "WebSocket reconnection with state recovery",
            "Admin actions must be audit-logged",
        ],
    )


def run_ava13_proof_of_concept(
    *, execute: bool = False, use_ai: bool = True
) -> dict:
    """Run the AVA-13 DJ Admin UI architecture task as a proof of concept.

    This demonstrates the full decomposition pipeline:
    1. Creates the AVA-13 parent task
    2. Decomposes it into parallel subtasks
    3. Optionally executes via sub-agents

    Args:
        execute: If True, spawn sub-agents (requires ANTHROPIC_API_KEY).
        use_ai: If True, use Claude for decomposition. False uses heuristic.

    Returns:
        Decomposition results dict.
    """
    task = build_ava13_task()
    return run_decomposition(
        task,
        use_ai_decomposition=use_ai,
        execute=execute,
    )


# ── CLI Entry Point ──────────────────────────────────────────────────


def main() -> None:
    """CLI entry point for the task decomposition system."""
    parser = argparse.ArgumentParser(
        description="AVops Parallel Task Decomposition System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  # Decompose AVA-13 using AI (requires ANTHROPIC_API_KEY)
  python -m avops.decomposition.runner --task ava13

  # Decompose AVA-13 using static heuristic (no API key needed)
  python -m avops.decomposition.runner --task ava13 --static

  # Decompose and execute with sub-agents
  python -m avops.decomposition.runner --task ava13 --execute

  # Decompose a custom task from JSON
  python -m avops.decomposition.runner --json task.json
""",
    )
    parser.add_argument(
        "--task",
        choices=["ava13"],
        help="Run a built-in proof-of-concept task",
    )
    parser.add_argument(
        "--json",
        type=str,
        help="Path to a JSON file defining a custom ParentTask",
    )
    parser.add_argument(
        "--static",
        action="store_true",
        help="Use static/rule-based decomposition instead of AI",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Execute subtasks via parallel sub-agents",
    )
    parser.add_argument(
        "--max-parallel",
        type=int,
        default=4,
        help="Maximum number of parallel sub-agents (default: 4)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        help="Output directory (default: .claude/workspace/)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    if args.task == "ava13":
        task = build_ava13_task()
    elif args.json:
        task = _load_task_from_json(args.json)
    else:
        parser.print_help()
        sys.exit(1)

    output_dir = Path(args.output_dir) if args.output_dir else None

    result = run_decomposition(
        task,
        use_ai_decomposition=not args.static,
        execute=args.execute,
        max_parallel=args.max_parallel,
        output_dir=output_dir,
    )

    print(json.dumps(result, indent=2))


def _load_task_from_json(path: str) -> ParentTask:
    """Load a ParentTask from a JSON file."""
    with open(path) as f:
        data = json.load(f)
    return ParentTask(
        task_id=data["task_id"],
        title=data["title"],
        description=data["description"],
        acceptance_criteria=data.get("acceptance_criteria", []),
        context_files=data.get("context_files", []),
        constraints=data.get("constraints", []),
    )


if __name__ == "__main__":
    main()
