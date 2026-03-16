"""Tests for the ParallelCoordinator."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from avops.decomposition.coordinator import ParallelCoordinator
from avops.decomposition.models import (
    ParentTask,
    Subtask,
    SubtaskType,
    TaskStatus,
)


def _make_parent() -> ParentTask:
    return ParentTask(
        task_id="AVA-13",
        title="DJ Admin UI",
        description="Test parent task.",
    )


def _make_subtask(
    title: str = "Test subtask",
    deps: list[str] | None = None,
) -> Subtask:
    return Subtask(
        parent_task_id="AVA-13",
        title=title,
        description=f"Do {title}.",
        dependencies=deps or [],
    )


class TestPlanExecutionWaves:
    def test_no_dependencies_single_wave(self):
        coord = ParallelCoordinator()
        subtasks = [
            _make_subtask("A"),
            _make_subtask("B"),
            _make_subtask("C"),
        ]
        waves = coord._plan_execution_waves(subtasks)
        assert len(waves) == 1
        assert len(waves[0]) == 3

    def test_linear_dependency_chain(self):
        coord = ParallelCoordinator()
        subtasks = [
            _make_subtask("A"),
            _make_subtask("B", deps=["A"]),
            _make_subtask("C", deps=["B"]),
        ]
        waves = coord._plan_execution_waves(subtasks)
        assert len(waves) == 3
        assert waves[0][0].title == "A"
        assert waves[1][0].title == "B"
        assert waves[2][0].title == "C"

    def test_diamond_dependency(self):
        coord = ParallelCoordinator()
        subtasks = [
            _make_subtask("A"),
            _make_subtask("B", deps=["A"]),
            _make_subtask("C", deps=["A"]),
            _make_subtask("D", deps=["B", "C"]),
        ]
        waves = coord._plan_execution_waves(subtasks)
        # Wave 0: A, Wave 1: B + C, Wave 2: D
        assert len(waves) == 3
        wave_titles = [[st.title for st in w] for w in waves]
        assert wave_titles[0] == ["A"]
        assert sorted(wave_titles[1]) == ["B", "C"]
        assert wave_titles[2] == ["D"]

    def test_max_parallel_splits_waves(self):
        coord = ParallelCoordinator(max_parallel=2)
        subtasks = [
            _make_subtask("A"),
            _make_subtask("B"),
            _make_subtask("C"),
            _make_subtask("D"),
        ]
        waves = coord._plan_execution_waves(subtasks)
        # 4 independent tasks with max_parallel=2 → 2 waves
        assert len(waves) == 2
        assert len(waves[0]) == 2
        assert len(waves[1]) == 2

    def test_circular_dependency_handled(self):
        """Circular deps should not cause infinite recursion."""
        coord = ParallelCoordinator()
        subtasks = [
            _make_subtask("A", deps=["B"]),
            _make_subtask("B", deps=["A"]),
        ]
        # Should not raise — circular deps get wave 0
        waves = coord._plan_execution_waves(subtasks)
        assert len(waves) >= 1


class TestBuildReport:
    def test_report_counts(self):
        coord = ParallelCoordinator()
        from avops.decomposition.models import SubtaskResult

        results = [
            SubtaskResult(subtask_id="S1", status=TaskStatus.COMPLETED),
            SubtaskResult(subtask_id="S2", status=TaskStatus.COMPLETED),
            SubtaskResult(subtask_id="S3", status=TaskStatus.FAILED),
        ]
        report = coord._build_report(_make_parent(), results)
        assert report.total_subtasks == 3
        assert report.completed == 2
        assert report.failed == 1
        assert report.parent_task_id == "AVA-13"


class TestResolveModel:
    def test_haiku(self):
        assert (
            ParallelCoordinator._resolve_model("haiku")
            == "claude-haiku-4-5-20251001"
        )

    def test_sonnet(self):
        assert (
            ParallelCoordinator._resolve_model("sonnet")
            == "claude-sonnet-4-6"
        )

    def test_opus(self):
        assert (
            ParallelCoordinator._resolve_model("opus")
            == "claude-opus-4-6"
        )

    def test_passthrough_full_id(self):
        assert (
            ParallelCoordinator._resolve_model("claude-sonnet-4-6")
            == "claude-sonnet-4-6"
        )
