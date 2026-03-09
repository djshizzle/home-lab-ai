"""Intent classification and triage for incoming Webex support messages."""

import re

from avops.constants.devices import WEBEX_SUPPORT_INTENTS


def classify_intent(text: str) -> str:
    """
    Simple keyword-based intent classifier.

    Returns the best matching intent key from WEBEX_SUPPORT_INTENTS.
    In production this is augmented by the Claude-based Orchestrator agent.
    """
    normalized = text.lower()
    scores: dict[str, int] = {}
    for intent, keywords in WEBEX_SUPPORT_INTENTS.items():
        if intent == "general":
            continue
        scores[intent] = sum(1 for kw in keywords if kw in normalized)
    if not scores or max(scores.values()) == 0:
        return "general"
    return max(scores, key=lambda k: scores[k])


def extract_room_code(text: str) -> str:
    """
    Try to extract a room/building code from free text.
    Matches patterns like: conf-3b, hq-031, floor3-room5, 3B, etc.
    Returns empty string if none found.
    """
    pattern = r"\b([a-z]{2,6}-\d{1,4}[a-z]?|\d{1,2}[a-z])\b"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(0).lower() if match else ""


def classify_priority(text: str, intent: str) -> str:
    """
    Assign a priority based on urgency language and intent type.
    Returns: critical | high | medium | low
    """
    normalized = text.lower()
    if any(w in normalized for w in ("urgent", "emergency", "asap", "critical", "down now", "p1")):
        return "critical"
    if intent == "device_offline":
        return "high"
    if any(w in normalized for w in ("meeting in", "in 5 min", "starting now", "exec", "board")):
        return "high"
    if any(w in normalized for w in ("later", "when you get a chance", "no rush", "low priority")):
        return "low"
    return "medium"
