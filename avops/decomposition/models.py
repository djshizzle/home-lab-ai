"""Data models for the task decomposition system."""

from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


class TaskStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class SubtaskType(enum.Enum):
    RESEARCH = "research"
    IMPLEMENTATION = "implementation"
    TESTING = "testing"
    REVIEW = "review"
    DOCUMENTATION = "documentation"
    ARCHITECTURE = "architecture"


@dataclass
class ParentTask:
    """A high-level task to be decomposed into parallel subtasks."""

    task_id: str
    title: str
    description: str
    acceptance_criteria: list[str] = field(default_factory=list)
    context_files: list[str] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)

    def to_prompt_context(self) -> str:
        """Serialize task into a prompt-friendly string."""
        lines = [
            f"# Parent Task: {self.task_id} — {self.title}",
            "",
            "## Description",
            self.description,
            "",
        ]
        if self.acceptance_criteria:
            lines.append("## Acceptance Criteria")
            for ac in self.acceptance_criteria:
                lines.append(f"- {ac}")
            lines.append("")
        if self.context_files:
            lines.append("## Context Files")
            for f in self.context_files:
                lines.append(f"- `{f}`")
            lines.append("")
        if self.constraints:
            lines.append("## Constraints")
            for c in self.constraints:
                lines.append(f"- {c}")
            lines.append("")
        return "\n".join(lines)


@dataclass
class Subtask:
    """An independent unit of work derived from a parent task."""

    subtask_id: str = field(default_factory=lambda: f"SUB-{uuid.uuid4().hex[:8]}")
    parent_task_id: str = ""
    title: str = ""
    description: str = ""
    subtask_type: SubtaskType = SubtaskType.IMPLEMENTATION
    acceptance_criteria: list[str] = field(default_factory=list)
    input_files: list[str] = field(default_factory=list)
    output_files: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    agent_type: str = "general-purpose"
    agent_model: str = "sonnet"
    status: TaskStatus = TaskStatus.PENDING

    def to_agent_prompt(self) -> str:
        """Build the prompt that will be sent to the sub-agent."""
        lines = [
            f"# Subtask: {self.subtask_id} — {self.title}",
            "",
            "## Instructions",
            self.description,
            "",
        ]
        if self.acceptance_criteria:
            lines.append("## Acceptance Criteria")
            for ac in self.acceptance_criteria:
                lines.append(f"- [ ] {ac}")
            lines.append("")
        if self.input_files:
            lines.append("## Input Files (read these first)")
            for f in self.input_files:
                lines.append(f"- `{f}`")
            lines.append("")
        if self.output_files:
            lines.append("## Expected Output Files")
            for f in self.output_files:
                lines.append(f"- `{f}`")
            lines.append("")
        lines.extend([
            "## Working Protocol",
            "1. Read all input files before starting",
            "2. Implement exactly what is described — do not invent requirements",
            "3. Run lint/tests if applicable",
            "4. Report what you accomplished and any blockers",
        ])
        return "\n".join(lines)


@dataclass
class SubtaskResult:
    """The outcome of a sub-agent executing a subtask."""

    subtask_id: str = ""
    status: TaskStatus = TaskStatus.PENDING
    agent_id: str = ""
    summary: str = ""
    files_created: list[str] = field(default_factory=list)
    files_modified: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    raw_output: str = ""
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None


@dataclass
class DecompositionReport:
    """Unified status report after all sub-agents complete."""

    parent_task_id: str = ""
    parent_title: str = ""
    total_subtasks: int = 0
    completed: int = 0
    failed: int = 0
    subtask_results: list[SubtaskResult] = field(default_factory=list)
    generated_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    def to_markdown(self) -> str:
        """Render a unified markdown status report."""
        lines = [
            f"# Decomposition Report: {self.parent_task_id} — {self.parent_title}",
            f"**Generated**: {self.generated_at.isoformat()}",
            "",
            "## Summary",
            f"| Metric | Value |",
            f"|--------|-------|",
            f"| Total subtasks | {self.total_subtasks} |",
            f"| Completed | {self.completed} |",
            f"| Failed | {self.failed} |",
            f"| Success rate | {self._success_rate()} |",
            "",
            "## Subtask Results",
            "",
        ]
        for r in self.subtask_results:
            status_icon = "✅" if r.status == TaskStatus.COMPLETED else "❌"
            lines.append(f"### {status_icon} {r.subtask_id}")
            lines.append(f"**Status**: {r.status.value}")
            lines.append(f"**Duration**: {r.duration_seconds:.1f}s")
            lines.append(f"**Agent ID**: `{r.agent_id}`")
            lines.append("")
            if r.summary:
                lines.append(f"**Summary**: {r.summary}")
                lines.append("")
            if r.files_created:
                lines.append("**Files created**:")
                for f in r.files_created:
                    lines.append(f"- `{f}`")
                lines.append("")
            if r.files_modified:
                lines.append("**Files modified**:")
                for f in r.files_modified:
                    lines.append(f"- `{f}`")
                lines.append("")
            if r.errors:
                lines.append("**Errors**:")
                for e in r.errors:
                    lines.append(f"- {e}")
                lines.append("")
        return "\n".join(lines)

    def _success_rate(self) -> str:
        if self.total_subtasks == 0:
            return "N/A"
        return f"{(self.completed / self.total_subtasks) * 100:.0f}%"
