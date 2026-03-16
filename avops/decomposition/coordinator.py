"""Parallel coordinator that spawns sub-agents and collects results.

Uses the Claude Agent SDK to run multiple agents concurrently, each
assigned one subtask. Collects results into a unified DecompositionReport.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ResultMessage,
    query,
)

from avops.decomposition.models import (
    DecompositionReport,
    ParentTask,
    Subtask,
    SubtaskResult,
    TaskStatus,
)

logger = logging.getLogger(__name__)


class ParallelCoordinator:
    """Spawns parallel sub-agents for independent subtasks and collects results.

    The coordinator:
    1. Topologically sorts subtasks by dependencies
    2. Launches independent subtasks in parallel waves
    3. Waits for each wave to complete before launching dependents
    4. Collects all results into a DecompositionReport
    """

    def __init__(
        self,
        max_parallel: int = 4,
        cwd: str | Path | None = None,
        permission_mode: str = "default",
    ):
        self.max_parallel = max_parallel
        self.cwd = cwd
        self.permission_mode = permission_mode

    def execute(
        self, parent_task: ParentTask, subtasks: list[Subtask]
    ) -> DecompositionReport:
        """Execute subtasks in dependency order, parallelizing where possible.

        Returns a DecompositionReport with results from all sub-agents.
        """
        logger.info(
            "Coordinating %d subtasks for %s",
            len(subtasks),
            parent_task.task_id,
        )

        waves = self._plan_execution_waves(subtasks)
        all_results: list[SubtaskResult] = []

        for wave_idx, wave in enumerate(waves):
            logger.info(
                "Executing wave %d/%d (%d subtasks)",
                wave_idx + 1,
                len(waves),
                len(wave),
            )
            wave_results = asyncio.run(self._execute_wave(wave))
            all_results.extend(wave_results)

            # Check for failures — stop if a dependency wave failed
            failures = [
                r for r in wave_results if r.status == TaskStatus.FAILED
            ]
            if failures and wave_idx < len(waves) - 1:
                logger.error(
                    "Wave %d had %d failures. Stopping execution.",
                    wave_idx + 1,
                    len(failures),
                )
                for remaining_wave in waves[wave_idx + 1 :]:
                    for subtask in remaining_wave:
                        all_results.append(
                            SubtaskResult(
                                subtask_id=subtask.subtask_id,
                                status=TaskStatus.FAILED,
                                summary="Skipped: upstream dependency failed",
                            )
                        )
                break

        report = self._build_report(parent_task, all_results)
        logger.info(
            "Coordination complete: %d/%d succeeded",
            report.completed,
            report.total_subtasks,
        )
        return report

    async def _execute_wave(
        self, subtasks: list[Subtask]
    ) -> list[SubtaskResult]:
        """Execute a wave of independent subtasks concurrently."""
        tasks = [self._run_subagent(st) for st in subtasks]
        return await asyncio.gather(*tasks)

    async def _run_subagent(self, subtask: Subtask) -> SubtaskResult:
        """Spawn a single sub-agent via claude_agent_sdk.query()."""
        start_time = time.monotonic()
        subtask.status = TaskStatus.IN_PROGRESS

        try:
            result = await self._spawn_agent(subtask)
            elapsed = time.monotonic() - start_time

            return SubtaskResult(
                subtask_id=subtask.subtask_id,
                status=TaskStatus.COMPLETED,
                agent_id=result.get("session_id", ""),
                summary=result.get("result", ""),
                duration_seconds=elapsed,
                raw_output=result.get("result", ""),
                completed_at=datetime.now(timezone.utc),
            )
        except Exception as exc:
            elapsed = time.monotonic() - start_time
            logger.error(
                "Sub-agent for %s failed: %s", subtask.subtask_id, exc
            )
            return SubtaskResult(
                subtask_id=subtask.subtask_id,
                status=TaskStatus.FAILED,
                errors=[str(exc)],
                duration_seconds=elapsed,
                completed_at=datetime.now(timezone.utc),
            )

    async def _spawn_agent(self, subtask: Subtask) -> dict:
        """Spawn a Claude Agent SDK sub-agent using query().

        Each sub-agent runs autonomously with its own tools and model,
        executing the subtask prompt and returning a result.
        """
        model = self._resolve_model(subtask.agent_model)

        # Configure tools based on agent type
        tools = self._tools_for_agent_type(subtask.agent_type)

        options = ClaudeAgentOptions(
            model=model,
            permission_mode=self.permission_mode,
            system_prompt=(
                f"You are a specialized {subtask.agent_type} agent. "
                f"Complete the assigned subtask autonomously. "
                f"Read all referenced files before making changes. "
                f"Report what you accomplished and any blockers."
            ),
            max_turns=20,
            tools=tools,
        )
        if self.cwd:
            options.cwd = str(self.cwd)

        prompt = subtask.to_agent_prompt()
        result_data: dict = {"session_id": "", "result": ""}

        async for message in query(prompt=prompt, options=options):
            if isinstance(message, ResultMessage):
                result_data["session_id"] = message.session_id
                result_data["result"] = message.result or ""
                result_data["is_error"] = message.is_error
                result_data["duration_ms"] = message.duration_ms
                break

        if result_data.get("is_error"):
            raise RuntimeError(
                f"Agent returned error: {result_data.get('result', 'unknown')}"
            )

        return result_data

    def _plan_execution_waves(
        self, subtasks: list[Subtask]
    ) -> list[list[Subtask]]:
        """Topologically sort subtasks into parallel execution waves.

        Subtasks with no dependencies go in wave 0. Subtasks whose
        dependencies are all in earlier waves go in the next wave.
        """
        title_to_subtask = {st.title: st for st in subtasks}
        title_to_wave: dict[str, int] = {}

        def get_wave(title: str, visited: set[str] | None = None) -> int:
            if title in title_to_wave:
                return title_to_wave[title]
            if visited is None:
                visited = set()
            if title in visited:
                logger.warning("Circular dependency detected at %s", title)
                return 0
            visited.add(title)

            st = title_to_subtask.get(title)
            if not st or not st.dependencies:
                title_to_wave[title] = 0
                return 0

            max_dep_wave = 0
            for dep_title in st.dependencies:
                if dep_title in title_to_subtask:
                    dep_wave = get_wave(dep_title, visited)
                    max_dep_wave = max(max_dep_wave, dep_wave + 1)

            title_to_wave[title] = max_dep_wave
            return max_dep_wave

        for st in subtasks:
            get_wave(st.title)

        # Group into waves
        max_wave = max(title_to_wave.values()) if title_to_wave else 0
        waves: list[list[Subtask]] = [[] for _ in range(max_wave + 1)]
        for st in subtasks:
            wave_idx = title_to_wave.get(st.title, 0)
            waves[wave_idx].append(st)

        # Enforce max_parallel within each wave
        limited_waves: list[list[Subtask]] = []
        for wave in waves:
            for i in range(0, len(wave), self.max_parallel):
                limited_waves.append(wave[i : i + self.max_parallel])

        return limited_waves

    def _build_report(
        self,
        parent_task: ParentTask,
        results: list[SubtaskResult],
    ) -> DecompositionReport:
        """Build the unified decomposition report."""
        completed = sum(
            1 for r in results if r.status == TaskStatus.COMPLETED
        )
        failed = sum(1 for r in results if r.status == TaskStatus.FAILED)

        return DecompositionReport(
            parent_task_id=parent_task.task_id,
            parent_title=parent_task.title,
            total_subtasks=len(results),
            completed=completed,
            failed=failed,
            subtask_results=results,
        )

    @staticmethod
    def _tools_for_agent_type(agent_type: str) -> list[str]:
        """Return appropriate tool list for each agent type."""
        tool_sets = {
            "researcher": ["Read", "Glob", "Grep", "Bash", "WebSearch", "WebFetch"],
            "planner": ["Read", "Glob", "Grep", "Bash"],
            "implementer": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
            "tester": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
            "reviewer": ["Read", "Glob", "Grep", "Bash"],
            "documenter": ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
        }
        return tool_sets.get(agent_type, ["Read", "Glob", "Grep", "Bash"])

    @staticmethod
    def _resolve_model(model_hint: str) -> str:
        """Map short model names to full model IDs."""
        model_map = {
            "haiku": "claude-haiku-4-5-20251001",
            "sonnet": "claude-sonnet-4-6",
            "opus": "claude-opus-4-6",
        }
        return model_map.get(model_hint, model_hint)
