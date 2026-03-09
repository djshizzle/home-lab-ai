"""Base agent class — wraps Anthropic API calls with retry, logging, and state tracking."""

import json
from typing import Any

import anthropic
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from avops.config import get_settings

log = structlog.get_logger(__name__)


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=get_settings().anthropic_api_key)


class BaseAgent:
    """
    Single-turn Claude agent with structured JSON output.

    Each agent gets:
    - A system prompt defining its role
    - The ticket context as user message
    - Returns parsed JSON dict or raw text fallback
    """

    name: str = "base"
    model: str = ""           # Set by subclass; defaults to settings value
    use_fast_model: bool = False

    def __init__(self):
        self._client = _client()
        settings = get_settings()
        if not self.model:
            self.model = (
                settings.claude_fast_model if self.use_fast_model else settings.claude_model
            )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    def _call(
        self,
        system: str,
        user_message: str,
        max_tokens: int | None = None,
    ) -> dict[str, Any] | str:
        """Call Claude and return parsed JSON or raw text."""
        settings = get_settings()
        max_tok = max_tokens or settings.claude_max_tokens

        log.info("agent.call_start", agent=self.name, model=self.model)

        with self._client.messages.stream(
            model=self.model,
            max_tokens=max_tok,
            thinking={"type": "adaptive"},
            system=system,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            response = stream.get_final_message()

        # Extract text blocks (skip thinking blocks)
        text_blocks = [b.text for b in response.content if b.type == "text"]
        raw_text = "\n".join(text_blocks)

        log.info(
            "agent.call_complete",
            agent=self.name,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )

        return self._parse_json(raw_text)

    def _parse_json(self, text: str) -> dict[str, Any] | str:
        """Extract JSON from response text, handling markdown code fences."""
        stripped = text.strip()

        # Try direct parse
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass

        # Try extracting from ```json ... ``` fence
        if "```json" in stripped:
            start = stripped.index("```json") + 7
            end = stripped.index("```", start)
            try:
                return json.loads(stripped[start:end].strip())
            except (json.JSONDecodeError, ValueError):
                pass

        # Try extracting any ``` ... ``` fence
        if "```" in stripped:
            start = stripped.index("```") + 3
            end = stripped.index("```", start)
            try:
                return json.loads(stripped[start:end].strip())
            except (json.JSONDecodeError, ValueError):
                pass

        # Return raw text as fallback
        log.warning("agent.json_parse_failed", agent=self.name, length=len(text))
        return stripped

    def run(self, context: dict[str, Any]) -> dict[str, Any] | str:
        raise NotImplementedError
