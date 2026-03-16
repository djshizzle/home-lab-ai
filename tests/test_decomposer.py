"""Tests for the TaskDecomposer."""

import json
from unittest.mock import MagicMock, patch

import pytest

from avops.decomposition.decomposer import TaskDecomposer
from avops.decomposition.models import ParentTask, SubtaskType


def _make_task() -> ParentTask:
    return ParentTask(
        task_id="AVA-13",
        title="DJ Admin UI Architecture Blueprint",
        description="Design the architecture for a DJ request admin UI.",
        acceptance_criteria=["Component diagram", "API contracts"],
        context_files=["CLAUDE.md"],
    )


class TestDecomposeStatic:
    def test_returns_four_subtasks(self):
        decomposer = TaskDecomposer()
        subtasks = decomposer.decompose_static(_make_task())
        assert len(subtasks) == 4

    def test_first_subtask_is_research(self):
        decomposer = TaskDecomposer()
        subtasks = decomposer.decompose_static(_make_task())
        assert subtasks[0].subtask_type == SubtaskType.RESEARCH
        assert subtasks[0].agent_type == "researcher"
        assert subtasks[0].agent_model == "haiku"

    def test_second_subtask_is_architecture(self):
        decomposer = TaskDecomposer()
        subtasks = decomposer.decompose_static(_make_task())
        assert subtasks[1].subtask_type == SubtaskType.ARCHITECTURE
        assert subtasks[1].agent_type == "planner"
        assert subtasks[1].agent_model == "opus"

    def test_parent_task_id_propagated(self):
        decomposer = TaskDecomposer()
        subtasks = decomposer.decompose_static(_make_task())
        for st in subtasks:
            assert st.parent_task_id == "AVA-13"

    def test_testing_subtask_has_dependency(self):
        decomposer = TaskDecomposer()
        subtasks = decomposer.decompose_static(_make_task())
        test_subtask = subtasks[3]
        assert test_subtask.subtask_type == SubtaskType.TESTING
        assert len(test_subtask.dependencies) > 0


class TestDecomposeAI:
    def test_parse_subtasks_valid_json(self):
        decomposer = TaskDecomposer()
        raw = json.dumps([
            {
                "title": "Research UI patterns",
                "description": "Explore existing UI code.",
                "subtask_type": "research",
                "acceptance_criteria": ["Patterns found"],
                "input_files": ["src/"],
                "output_files": ["research.md"],
                "dependencies": [],
                "agent_type": "researcher",
                "agent_model": "haiku",
            },
            {
                "title": "Design components",
                "description": "Create component hierarchy.",
                "subtask_type": "architecture",
                "acceptance_criteria": ["Diagram created"],
                "input_files": [],
                "output_files": ["arch.md"],
                "dependencies": ["Research UI patterns"],
                "agent_type": "planner",
                "agent_model": "opus",
            },
            {
                "title": "Implement dashboard",
                "description": "Build the DJ dashboard.",
                "subtask_type": "implementation",
                "acceptance_criteria": ["Dashboard renders"],
                "input_files": ["arch.md"],
                "output_files": ["src/dashboard.tsx"],
                "dependencies": ["Design components"],
                "agent_type": "implementer",
                "agent_model": "sonnet",
            },
        ])
        subtasks = decomposer._parse_subtasks(raw, "AVA-13")
        assert len(subtasks) == 3
        assert subtasks[0].title == "Research UI patterns"
        assert subtasks[0].subtask_type == SubtaskType.RESEARCH
        assert subtasks[1].dependencies == ["Research UI patterns"]
        assert subtasks[2].agent_model == "sonnet"

    def test_parse_subtasks_with_markdown_fencing(self):
        decomposer = TaskDecomposer()
        raw = '```json\n' + json.dumps([
            {
                "title": "Task A",
                "description": "Do A.",
                "subtask_type": "implementation",
                "agent_type": "implementer",
                "agent_model": "sonnet",
            },
            {
                "title": "Task B",
                "description": "Do B.",
                "subtask_type": "testing",
                "agent_type": "tester",
                "agent_model": "sonnet",
            },
            {
                "title": "Task C",
                "description": "Do C.",
                "subtask_type": "review",
                "agent_type": "reviewer",
                "agent_model": "opus",
            },
        ]) + '\n```'
        subtasks = decomposer._parse_subtasks(raw, "TEST-1")
        assert len(subtasks) == 3
        assert all(st.parent_task_id == "TEST-1" for st in subtasks)

    def test_parse_subtasks_invalid_json_raises(self):
        decomposer = TaskDecomposer()
        with pytest.raises(json.JSONDecodeError):
            decomposer._parse_subtasks("not json at all", "X")

    def test_parse_subtasks_not_array_raises(self):
        decomposer = TaskDecomposer()
        with pytest.raises(ValueError, match="Expected JSON array"):
            decomposer._parse_subtasks('{"key": "value"}', "X")

    def test_decompose_calls_api(self):
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(
                text=json.dumps([
                    {
                        "title": "Research",
                        "description": "Research task.",
                        "subtask_type": "research",
                        "agent_type": "researcher",
                        "agent_model": "haiku",
                    },
                    {
                        "title": "Implement",
                        "description": "Implement task.",
                        "subtask_type": "implementation",
                        "agent_type": "implementer",
                        "agent_model": "sonnet",
                    },
                    {
                        "title": "Test",
                        "description": "Test task.",
                        "subtask_type": "testing",
                        "agent_type": "tester",
                        "agent_model": "sonnet",
                    },
                ])
            )
        ]
        mock_client.messages.create.return_value = mock_response

        decomposer = TaskDecomposer(client=mock_client)
        subtasks = decomposer.decompose(_make_task())

        assert len(subtasks) == 3
        mock_client.messages.create.assert_called_once()
        call_kwargs = mock_client.messages.create.call_args.kwargs
        assert call_kwargs["model"] == "claude-sonnet-4-6"
        assert "AVA-13" in call_kwargs["messages"][0]["content"]
