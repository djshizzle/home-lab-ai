"""Task decomposition engine using Claude Agent SDK.

Analyzes a parent task and breaks it into 3-6 independent subtasks
with clear acceptance criteria, agent assignments, and dependency ordering.
"""

from __future__ import annotations

import json
import logging

import anthropic

from avops.decomposition.models import ParentTask, Subtask, SubtaskType

logger = logging.getLogger(__name__)

DECOMPOSITION_SYSTEM_PROMPT = """\
You are a task decomposition specialist for an enterprise AV operations system.

Given a parent task, break it into 3-6 independent subtasks that can be executed
in parallel by separate agents. Each subtask must be self-contained and testable.

Rules:
- Each subtask must have a clear title, description, and acceptance criteria
- Subtasks should be independent (parallelizable) where possible
- Mark dependencies between subtasks only when strictly required
- Assign appropriate subtask_type: research, implementation, testing, review,
  documentation, or architecture
- Assign agent_type: "researcher" for read-only exploration, "implementer" for
  code writing, "tester" for test execution, "reviewer" for quality review,
  "documenter" for docs
- Assign agent_model: "haiku" for fast research, "sonnet" for implementation/testing,
  "opus" for architecture/review

Respond with a JSON array of subtask objects. Each object must have:
{
  "title": "string",
  "description": "string — detailed instructions for the agent",
  "subtask_type": "research|implementation|testing|review|documentation|architecture",
  "acceptance_criteria": ["criterion 1", "criterion 2"],
  "input_files": ["file paths the agent should read"],
  "output_files": ["file paths the agent should create/modify"],
  "dependencies": ["subtask titles this depends on, if any"],
  "agent_type": "researcher|implementer|tester|reviewer|documenter",
  "agent_model": "haiku|sonnet|opus"
}

Return ONLY valid JSON. No markdown fencing, no explanation outside the JSON.\
"""


class TaskDecomposer:
    """Decomposes a parent task into parallel subtasks using Claude."""

    def __init__(
        self,
        client: anthropic.Anthropic | None = None,
        model: str = "claude-sonnet-4-6",
    ):
        self.client = client or anthropic.Anthropic()
        self.model = model

    def decompose(self, task: ParentTask) -> list[Subtask]:
        """Break a parent task into 3-6 independent subtasks.

        Calls Claude to analyze the task description and produce structured
        subtask definitions with acceptance criteria and agent assignments.
        """
        logger.info("Decomposing task %s: %s", task.task_id, task.title)

        message = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=DECOMPOSITION_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": task.to_prompt_context(),
                }
            ],
        )

        raw_text = message.content[0].text
        subtasks = self._parse_subtasks(raw_text, task.task_id)

        logger.info(
            "Decomposed %s into %d subtasks", task.task_id, len(subtasks)
        )
        return subtasks

    def _parse_subtasks(
        self, raw_json: str, parent_task_id: str
    ) -> list[Subtask]:
        """Parse Claude's JSON response into Subtask objects."""
        # Strip markdown fencing if present
        text = raw_json.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        data = json.loads(text)
        if not isinstance(data, list):
            raise ValueError(
                f"Expected JSON array, got {type(data).__name__}"
            )
        if not 3 <= len(data) <= 6:
            logger.warning(
                "Expected 3-6 subtasks, got %d. Proceeding anyway.", len(data)
            )

        subtasks = []
        type_map = {t.value: t for t in SubtaskType}
        model_map = {
            "haiku": "haiku",
            "sonnet": "sonnet",
            "opus": "opus",
        }
        agent_type_map = {
            "researcher": "researcher",
            "implementer": "implementer",
            "tester": "tester",
            "reviewer": "reviewer",
            "documenter": "documenter",
        }

        for item in data:
            st = Subtask(
                parent_task_id=parent_task_id,
                title=item["title"],
                description=item["description"],
                subtask_type=type_map.get(
                    item.get("subtask_type", "implementation"),
                    SubtaskType.IMPLEMENTATION,
                ),
                acceptance_criteria=item.get("acceptance_criteria", []),
                input_files=item.get("input_files", []),
                output_files=item.get("output_files", []),
                dependencies=item.get("dependencies", []),
                agent_type=agent_type_map.get(
                    item.get("agent_type", "implementer"),
                    "general-purpose",
                ),
                agent_model=model_map.get(
                    item.get("agent_model", "sonnet"), "sonnet"
                ),
            )
            subtasks.append(st)

        return subtasks

    def decompose_static(self, task: ParentTask) -> list[Subtask]:
        """Decompose without calling Claude — uses a rule-based heuristic.

        Useful for testing, offline mode, or when the task structure is
        predictable (e.g., standard feature workflows).
        """
        subtasks = [
            Subtask(
                parent_task_id=task.task_id,
                title=f"Research existing patterns for {task.title}",
                description=(
                    f"Explore the codebase to understand existing patterns, "
                    f"conventions, and reusable code relevant to: {task.title}. "
                    f"Read CLAUDE.md for project conventions. Map the directory "
                    f"structure. Identify files to reuse or extend."
                ),
                subtask_type=SubtaskType.RESEARCH,
                acceptance_criteria=[
                    "Directory structure mapped",
                    "Existing patterns documented",
                    "Reusable code identified",
                ],
                input_files=task.context_files or ["CLAUDE.md"],
                output_files=[
                    ".claude/workspace/research/findings.md"
                ],
                agent_type="researcher",
                agent_model="haiku",
            ),
            Subtask(
                parent_task_id=task.task_id,
                title=f"Design architecture for {task.title}",
                description=(
                    f"Based on the parent task description, design the "
                    f"architecture and create an implementation plan. "
                    f"Define file structure, API contracts, data models, "
                    f"and component interactions.\n\n"
                    f"Task details:\n{task.description}"
                ),
                subtask_type=SubtaskType.ARCHITECTURE,
                acceptance_criteria=[
                    "Architecture diagram or description provided",
                    "File structure defined",
                    "API contracts specified",
                    "Data models documented",
                ],
                output_files=[
                    ".claude/workspace/plans/architecture.md"
                ],
                agent_type="planner",
                agent_model="opus",
            ),
            Subtask(
                parent_task_id=task.task_id,
                title=f"Implement core modules for {task.title}",
                description=(
                    f"Implement the core modules as defined in the "
                    f"architecture plan. Follow project conventions from "
                    f"CLAUDE.md. Write clean, tested code.\n\n"
                    f"Task details:\n{task.description}"
                ),
                subtask_type=SubtaskType.IMPLEMENTATION,
                acceptance_criteria=task.acceptance_criteria or [
                    "Core modules implemented",
                    "Code follows project conventions",
                    "No lint errors",
                ],
                input_files=task.context_files,
                agent_type="implementer",
                agent_model="sonnet",
            ),
            Subtask(
                parent_task_id=task.task_id,
                title=f"Write tests for {task.title}",
                description=(
                    f"Write comprehensive tests for all new code. Cover "
                    f"happy paths, edge cases, and error conditions. "
                    f"Use pytest conventions."
                ),
                subtask_type=SubtaskType.TESTING,
                acceptance_criteria=[
                    "Unit tests for all public functions",
                    "Edge case coverage",
                    "All tests pass",
                ],
                dependencies=[f"Implement core modules for {task.title}"],
                agent_type="tester",
                agent_model="sonnet",
            ),
        ]
        return subtasks
