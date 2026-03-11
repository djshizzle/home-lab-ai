"""Interactive checklist runner for the AV Operations Assessment Tool."""

from __future__ import annotations

import sys
from pathlib import Path

import yaml
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.rule import Rule
from rich.text import Text

from assessment.models import QuestionScore

console = Console()


def load_questions(yaml_path: str) -> dict[str, list[dict]]:
    """Load and index questions from the YAML question bank by domain ID."""
    path = Path(yaml_path)
    if not path.exists():
        console.print(f"[red]Question bank not found: {yaml_path}[/red]")
        sys.exit(1)

    with path.open() as f:
        data = yaml.safe_load(f)

    indexed: dict[str, list[dict]] = {}
    for domain in data.get("domains", []):
        domain_id = domain["id"]
        questions = domain.get("questions", [])
        # Attach domain metadata to each question for display
        for q in questions:
            q["domain_name"] = domain["name"]
        indexed[domain_id] = questions

    return indexed


def load_domain_metadata(yaml_path: str) -> dict[str, str]:
    """Return a mapping of domain_id -> domain_name."""
    path = Path(yaml_path)
    with path.open() as f:
        data = yaml.safe_load(f)

    return {d["id"]: d["name"] for d in data.get("domains", [])}


def prompt_question(question: dict, index: int, total: int) -> QuestionScore:
    """Display a single question and collect the auditor's score."""
    q_id = question["id"]
    text = question["text"]
    guidance = question.get("guidance", "").strip()
    weight = question.get("weight", 1)
    score_options: dict = question.get("score_options", {})

    console.print()
    console.print(Rule(f"[bold cyan]Question {index}/{total}  [{q_id}][/bold cyan]"))
    console.print(f"\n[bold white]{text}[/bold white]\n")

    if guidance:
        console.print(
            Panel(
                Text(guidance, style="dim"),
                title="[yellow]What to look for[/yellow]",
                border_style="yellow",
                padding=(0, 1),
            )
        )
        console.print()

    # Display score options
    for score_val in sorted(score_options.keys()):
        label = score_options[score_val]
        color = {0: "red", 1: "yellow", 2: "green"}.get(int(score_val), "white")
        console.print(f"  [bold {color}]{score_val}[/bold {color}] — {label}")

    console.print()

    # Collect score
    while True:
        raw = Prompt.ask(
            "[bold]Score[/bold] (0/1/2) or [dim]s[/dim] to skip",
            default="",
            console=console,
        ).strip().lower()

        if raw == "s":
            console.print("[dim]Skipped — recorded as 0[/dim]")
            score = 0
            break
        if raw in ("0", "1", "2"):
            score = int(raw)
            break

        console.print("[red]Please enter 0, 1, 2, or 's' to skip.[/red]")

    # Optional notes
    notes = Prompt.ask(
        "[dim]Notes (optional, press Enter to skip)[/dim]",
        default="",
        console=console,
    ).strip()

    return QuestionScore(
        question_id=q_id,
        score=score,
        notes=notes,
        source="checklist",
        weight=weight,
    )


def run_domain_checklist(
    domain_id: str,
    domain_name: str,
    questions: list[dict],
) -> list[QuestionScore]:
    """Run the interactive checklist for a single domain."""
    console.print()
    console.print(
        Panel(
            f"[bold white]{domain_name}[/bold white]\n"
            f"[dim]{len(questions)} questions[/dim]",
            title=f"[bold cyan]Domain: {domain_id}[/bold cyan]",
            border_style="cyan",
        )
    )

    scores: list[QuestionScore] = []
    total = len(questions)
    for i, question in enumerate(questions, start=1):
        score = prompt_question(question, index=i, total=total)
        scores.append(score)

    return scores


def run_full_checklist(
    questions_path: str,
    domains: list[str] | None = None,
) -> dict[str, list[QuestionScore]]:
    """
    Run the full interactive checklist across all (or selected) domains.

    Returns a dict of domain_id -> list of QuestionScore.
    """
    all_questions = load_questions(questions_path)
    domain_meta = load_domain_metadata(questions_path)

    # Filter to requested domains if specified
    domain_ids = domains if domains else list(all_questions.keys())
    invalid = [d for d in domain_ids if d not in all_questions]
    if invalid:
        console.print(f"[red]Unknown domain(s): {', '.join(invalid)}[/red]")
        console.print(f"Available: {', '.join(all_questions.keys())}")
        sys.exit(1)

    console.print()
    console.print(
        Panel(
            "[bold]AV Operations Assessment — Interactive Checklist[/bold]\n\n"
            "For each question, enter:\n"
            "  [bold green]2[/bold green] = Fully met\n"
            "  [bold yellow]1[/bold yellow] = Partially met\n"
            "  [bold red]0[/bold red] = Not present\n"
            "  [bold dim]s[/bold dim] = Skip (counts as 0)",
            border_style="blue",
        )
    )

    results: dict[str, list[QuestionScore]] = {}
    for domain_id in domain_ids:
        questions = all_questions[domain_id]
        domain_name = domain_meta.get(domain_id, domain_id)
        scores = run_domain_checklist(domain_id, domain_name, questions)
        results[domain_id] = scores

    console.print()
    console.print("[bold green]Checklist complete.[/bold green]")
    return results
