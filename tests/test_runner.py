"""Tests for the runner module and AVA-13 proof of concept."""

from avops.decomposition.runner import build_ava13_task


class TestBuildAva13Task:
    def test_task_id(self):
        task = build_ava13_task()
        assert task.task_id == "AVA-13"

    def test_title(self):
        task = build_ava13_task()
        assert "DJ Admin UI" in task.title

    def test_has_acceptance_criteria(self):
        task = build_ava13_task()
        assert len(task.acceptance_criteria) >= 4

    def test_has_constraints(self):
        task = build_ava13_task()
        assert len(task.constraints) >= 2

    def test_has_context_files(self):
        task = build_ava13_task()
        assert "CLAUDE.md" in task.context_files

    def test_description_covers_key_features(self):
        task = build_ava13_task()
        desc = task.description.lower()
        assert "real-time" in desc
        assert "queue" in desc
        assert "websocket" in desc
        assert "react" in desc or "typescript" in desc

    def test_to_prompt_context(self):
        task = build_ava13_task()
        ctx = task.to_prompt_context()
        assert "AVA-13" in ctx
        assert "## Acceptance Criteria" in ctx
        assert "## Constraints" in ctx
