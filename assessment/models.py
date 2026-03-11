"""Data models for the AV Operations Assessment Tool."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class QuestionScore:
    """Score for a single checklist question."""

    question_id: str
    score: int  # 0 = not present, 1 = partial, 2 = fully met
    notes: str = ""
    source: str = "checklist"  # "checklist" | "probe"
    weight: int = 1


@dataclass
class DomainResult:
    """Scored result for one assessment domain."""

    domain_id: str
    domain_name: str
    score: float  # 0–100
    maturity_level: int  # 1–5
    maturity_label: str
    question_scores: list[QuestionScore] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)


@dataclass
class AssessmentResult:
    """Top-level container for a completed assessment."""

    org: str
    site: str
    date: str
    assessor: str
    overall_score: float
    overall_maturity: int
    overall_maturity_label: str
    domain_results: list[DomainResult] = field(default_factory=list)
    probe_summary: dict[str, Any] = field(default_factory=dict)
    skipped_probes: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a plain dict for JSON output."""
        return {
            "org": self.org,
            "site": self.site,
            "date": self.date,
            "assessor": self.assessor,
            "overall_score": round(self.overall_score, 1),
            "overall_maturity": self.overall_maturity,
            "overall_maturity_label": self.overall_maturity_label,
            "skipped_probes": self.skipped_probes,
            "domains": [
                {
                    "domain_id": d.domain_id,
                    "domain_name": d.domain_name,
                    "score": round(d.score, 1),
                    "maturity_level": d.maturity_level,
                    "maturity_label": d.maturity_label,
                    "findings": d.findings,
                    "recommendations": d.recommendations,
                    "questions": [
                        {
                            "question_id": q.question_id,
                            "score": q.score,
                            "weight": q.weight,
                            "notes": q.notes,
                            "source": q.source,
                        }
                        for q in d.question_scores
                    ],
                }
                for d in self.domain_results
            ],
            "probe_summary": self.probe_summary,
        }
