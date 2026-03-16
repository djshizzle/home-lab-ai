"""Tests for the task decomposition data models."""

from avops.decomposition.models import (
    DecompositionReport,
    ParentTask,
    Subtask,
    SubtaskResult,
    SubtaskType,
    TaskStatus,
)


class TestParentTask:
    def test_to_prompt_context_minimal(self):
        task = ParentTask(
            task_id="AVA-1",
            title="Test Task",
            description="A simple test task.",
        )
        ctx = task.to_prompt_context()
        assert "AVA-1" in ctx
        assert "Test Task" in ctx
        assert "A simple test task." in ctx

    def test_to_prompt_context_full(self):
        task = ParentTask(
            task_id="AVA-13",
            title="DJ Admin UI",
            description="Build the admin UI.",
            acceptance_criteria=["AC1", "AC2"],
            context_files=["CLAUDE.md"],
            constraints=["Must be fast"],
        )
        ctx = task.to_prompt_context()
        assert "## Acceptance Criteria" in ctx
        assert "- AC1" in ctx
        assert "## Context Files" in ctx
        assert "`CLAUDE.md`" in ctx
        assert "## Constraints" in ctx
        assert "- Must be fast" in ctx


class TestSubtask:
    def test_defaults(self):
        st = Subtask()
        assert st.subtask_id.startswith("SUB-")
        assert st.status == TaskStatus.PENDING
        assert st.subtask_type == SubtaskType.IMPLEMENTATION

    def test_to_agent_prompt(self):
        st = Subtask(
            title="Research patterns",
            description="Find existing code patterns.",
            acceptance_criteria=["Patterns documented"],
            input_files=["src/main.py"],
            output_files=["findings.md"],
        )
        prompt = st.to_agent_prompt()
        assert "Research patterns" in prompt
        assert "Find existing code patterns." in prompt
        assert "[ ] Patterns documented" in prompt
        assert "`src/main.py`" in prompt
        assert "`findings.md`" in prompt
        assert "Working Protocol" in prompt


class TestSubtaskResult:
    def test_default_status(self):
        r = SubtaskResult()
        assert r.status == TaskStatus.PENDING
        assert r.completed_at is None

    def test_with_errors(self):
        r = SubtaskResult(
            subtask_id="SUB-abc",
            status=TaskStatus.FAILED,
            errors=["Connection timeout"],
        )
        assert r.status == TaskStatus.FAILED
        assert "Connection timeout" in r.errors


class TestDecompositionReport:
    def test_to_markdown(self):
        report = DecompositionReport(
            parent_task_id="AVA-13",
            parent_title="DJ Admin UI",
            total_subtasks=3,
            completed=2,
            failed=1,
            subtask_results=[
                SubtaskResult(
                    subtask_id="SUB-001",
                    status=TaskStatus.COMPLETED,
                    agent_id="agent-abc",
                    summary="Research complete",
                    duration_seconds=12.5,
                ),
                SubtaskResult(
                    subtask_id="SUB-002",
                    status=TaskStatus.COMPLETED,
                    agent_id="agent-def",
                    summary="Architecture designed",
                    files_created=["arch.md"],
                    duration_seconds=25.3,
                ),
                SubtaskResult(
                    subtask_id="SUB-003",
                    status=TaskStatus.FAILED,
                    errors=["API timeout"],
                    duration_seconds=60.0,
                ),
            ],
        )
        md = report.to_markdown()
        assert "AVA-13" in md
        assert "DJ Admin UI" in md
        assert "67%" in md  # 2/3 success rate
        assert "SUB-001" in md
        assert "Research complete" in md
        assert "`arch.md`" in md
        assert "API timeout" in md

    def test_success_rate_zero_tasks(self):
        report = DecompositionReport()
        assert report._success_rate() == "N/A"

    def test_success_rate_all_passed(self):
        report = DecompositionReport(total_subtasks=4, completed=4)
        assert report._success_rate() == "100%"
