#!/usr/bin/env python3
"""Generate a professional PDF from the AWS Security Plan markdown document."""

import os
import sys
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.flowables import KeepTogether

# ── Brand colours ─────────────────────────────────────────────────────────────
WEBEX_BLUE   = colors.HexColor("#00BCEB")
DARK_BG      = colors.HexColor("#1B1B2F")
DARK_CARD    = colors.HexColor("#252540")
ACCENT_GREEN = colors.HexColor("#00D68F")
ACCENT_ORANGE= colors.HexColor("#FF6B35")
TEXT_MAIN    = colors.HexColor("#1A1A2E")
TEXT_MUTED   = colors.HexColor("#555577")
WHITE        = colors.white
LIGHT_GREY   = colors.HexColor("#F5F5FA")
BORDER_GREY  = colors.HexColor("#DDDDE8")
CODE_BG      = colors.HexColor("#F0F0F8")

# ── Styles ────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

S = {
    "cover_title": ParagraphStyle("cover_title",
        fontName="Helvetica-Bold", fontSize=28, leading=34,
        textColor=WHITE, alignment=TA_CENTER, spaceAfter=8),
    "cover_sub": ParagraphStyle("cover_sub",
        fontName="Helvetica", fontSize=13, leading=18,
        textColor=colors.HexColor("#B0D8F0"), alignment=TA_CENTER, spaceAfter=4),
    "cover_meta": ParagraphStyle("cover_meta",
        fontName="Helvetica", fontSize=10,
        textColor=colors.HexColor("#88AABB"), alignment=TA_CENTER),
    "h1": ParagraphStyle("h1",
        fontName="Helvetica-Bold", fontSize=18, leading=22,
        textColor=DARK_BG, spaceBefore=20, spaceAfter=8,
        borderPad=0),
    "h2": ParagraphStyle("h2",
        fontName="Helvetica-Bold", fontSize=13, leading=17,
        textColor=WEBEX_BLUE, spaceBefore=14, spaceAfter=6),
    "h3": ParagraphStyle("h3",
        fontName="Helvetica-Bold", fontSize=11, leading=15,
        textColor=TEXT_MAIN, spaceBefore=10, spaceAfter=4),
    "body": ParagraphStyle("body",
        fontName="Helvetica", fontSize=10, leading=15,
        textColor=TEXT_MAIN, spaceAfter=6),
    "bullet": ParagraphStyle("bullet",
        fontName="Helvetica", fontSize=10, leading=14,
        textColor=TEXT_MAIN, leftIndent=16, spaceAfter=3,
        bulletIndent=6),
    "sub_bullet": ParagraphStyle("sub_bullet",
        fontName="Helvetica", fontSize=9.5, leading=13,
        textColor=TEXT_MUTED, leftIndent=32, spaceAfter=2,
        bulletIndent=22),
    "code": ParagraphStyle("code",
        fontName="Courier", fontSize=8.5, leading=12,
        textColor=colors.HexColor("#2A2A5A"),
        backColor=CODE_BG, leftIndent=10, rightIndent=10,
        spaceAfter=8, spaceBefore=4,
        borderColor=BORDER_GREY, borderWidth=0.5, borderPad=6),
    "callout": ParagraphStyle("callout",
        fontName="Helvetica-Oblique", fontSize=10, leading=14,
        textColor=colors.HexColor("#004466"),
        backColor=colors.HexColor("#E0F7FF"),
        leftIndent=12, rightIndent=12, spaceAfter=10, spaceBefore=4,
        borderColor=WEBEX_BLUE, borderWidth=1, borderPad=8),
    "footer": ParagraphStyle("footer",
        fontName="Helvetica", fontSize=8,
        textColor=TEXT_MUTED, alignment=TA_CENTER),
    "toc_entry": ParagraphStyle("toc_entry",
        fontName="Helvetica", fontSize=10, leading=16,
        textColor=TEXT_MAIN, leftIndent=12),
    "toc_sub": ParagraphStyle("toc_sub",
        fontName="Helvetica", fontSize=9.5, leading=15,
        textColor=TEXT_MUTED, leftIndent=28),
    "phase_label": ParagraphStyle("phase_label",
        fontName="Helvetica-Bold", fontSize=9,
        textColor=WHITE, alignment=TA_CENTER),
}


def b(text):  # bold inline
    return f"<b>{text}</b>"

def it(text):  # italic inline
    return f"<i>{text}</i>"

def code_inline(text):
    return f'<font name="Courier" size="9" color="#2A2A5A">{text}</font>'


# ── Table helpers ─────────────────────────────────────────────────────────────
HEADER_STYLE = TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), WEBEX_BLUE),
    ("TEXTCOLOR",  (0, 0), (-1, 0), WHITE),
    ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE",   (0, 0), (-1, 0), 9),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
    ("FONTNAME",   (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE",   (0, 1), (-1, -1), 9),
    ("TEXTCOLOR",  (0, 1), (-1, -1), TEXT_MAIN),
    ("GRID",       (0, 0), (-1, -1), 0.4, BORDER_GREY),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_GREY]),
])

CHECKLIST_STYLE = TableStyle([
    ("FONTNAME",  (0, 0), (-1, -1), "Helvetica"),
    ("FONTSIZE",  (0, 0), (-1, -1), 9.5),
    ("TEXTCOLOR", (0, 0), (-1, -1), TEXT_MAIN),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING", (0, 0), (0, -1), 4),
    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, LIGHT_GREY]),
    ("GRID", (0, 0), (-1, -1), 0.3, BORDER_GREY),
])


def make_table(headers, rows, col_widths=None):
    data = [[Paragraph(b(h), S["body"]) for h in headers]] + \
           [[Paragraph(str(c), S["body"]) for c in row] for row in rows]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(HEADER_STYLE)
    return t


def phase_badge(label, color):
    data = [[Paragraph(label, S["phase_label"])]]
    t = Table(data, colWidths=[1.2 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), color),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ("TOPPADDING", (0, 0), (0, 0), 3),
        ("BOTTOMPADDING", (0, 0), (0, 0), 3),
    ]))
    return t


def divider():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER_GREY, spaceAfter=8, spaceBefore=4)


# ── Page template ─────────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = LETTER
    # Header bar
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, h - 0.45 * inch, w, 0.45 * inch, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(WEBEX_BLUE)
    canvas.drawString(0.5 * inch, h - 0.28 * inch, "AVops Webex Support Agents")
    canvas.setFillColor(colors.HexColor("#88AABB"))
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 0.5 * inch, h - 0.28 * inch,
                           "AWS Architecture & Security Posture Plan")
    # Footer bar
    canvas.setFillColor(LIGHT_GREY)
    canvas.rect(0, 0, w, 0.4 * inch, fill=1, stroke=0)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(0.5 * inch, 0.15 * inch, "INTERNAL — AVops Engineering")
    canvas.drawCentredString(w / 2, 0.15 * inch, f"Page {doc.page}")
    canvas.drawRightString(w - 0.5 * inch, 0.15 * inch, f"Generated {date.today()}")
    canvas.restoreState()


# ── Cover page ────────────────────────────────────────────────────────────────
def build_cover():
    w, h = LETTER
    elements = []

    # Dark hero band
    class CoverBand:
        def wrap(self, aw, ah): return (aw, 3.2 * inch)
        def draw(self): pass

    # We'll use a Table as the dark hero
    hero_content = [
        [Paragraph("AVops Webex Support Agents", S["cover_title"])],
        [Paragraph("AWS Architecture &amp; Corporate AI Security Posture Plan", S["cover_sub"])],
        [Spacer(1, 0.15 * inch)],
        [Paragraph("Phase 1 → Phase 3 Roadmap  ·  Confidential — Internal Use Only", S["cover_meta"])],
        [Paragraph(f"Prepared by AVops Engineering  ·  {date.today().strftime('%B %d, %Y')}", S["cover_meta"])],
    ]
    hero = Table(hero_content, colWidths=[6.5 * inch])
    hero.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), DARK_BG),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",   (0, 0), (-1, -1), 24),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 24),
    ]))
    elements.append(Spacer(1, 0.3 * inch))
    elements.append(hero)
    elements.append(Spacer(1, 0.3 * inch))

    # Phase summary cards
    phases = [
        ("Phase 1\nHome-Lab / Dev", ACCENT_GREEN, "NOW", "DynamoDB · S3 · SQS · Secrets Manager"),
        ("Phase 2\nStaging", WEBEX_BLUE, "NEXT", "VPC · Cognito · WAF · KMS CMKs · CloudTrail"),
        ("Phase 3\nCorp AI Posture", ACCENT_ORANGE, "TARGET", "Zero-Trust · PII Scrub · SOC 2 · GDPR"),
    ]
    phase_rows = []
    for title, color, timing, desc in phases:
        phase_rows.append([
            Paragraph(f'<font color="white"><b>{title}</b></font>', ParagraphStyle(
                "pt", fontName="Helvetica-Bold", fontSize=9.5, textColor=WHITE,
                leading=13, alignment=TA_CENTER)),
            Paragraph(f'<font color="white">{timing}</font>', ParagraphStyle(
                "pt2", fontName="Helvetica-Bold", fontSize=10, textColor=WHITE,
                alignment=TA_CENTER)),
            Paragraph(desc, ParagraphStyle(
                "pd", fontName="Helvetica", fontSize=9, textColor=WHITE,
                leading=13, alignment=TA_CENTER)),
        ])

    pt = Table(phase_rows, colWidths=[1.8 * inch, 0.9 * inch, 3.8 * inch])
    pt.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), ACCENT_GREEN),
        ("BACKGROUND",    (0, 1), (-1, 1), WEBEX_BLUE),
        ("BACKGROUND",    (0, 2), (-1, 2), ACCENT_ORANGE),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("LINEBELOW",     (0, 0), (-1, -2), 1, WHITE),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    elements.append(pt)
    elements.append(Spacer(1, 0.35 * inch))

    # Table of Contents
    toc_header = Table([[Paragraph(b("Table of Contents"), S["h2"])]],
                       colWidths=[6.5 * inch])
    toc_header.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (0, 0), LIGHT_GREY),
        ("TOPPADDING",    (0, 0), (0, 0), 6),
        ("BOTTOMPADDING", (0, 0), (0, 0), 6),
        ("LEFTPADDING",   (0, 0), (0, 0), 10),
        ("LINEBELOW",     (0, 0), (0, 0), 1, WEBEX_BLUE),
    ]))
    elements.append(toc_header)
    elements.append(Spacer(1, 0.1 * inch))

    toc = [
        ("1.", "Current Architecture (Phase 1 — AWS Dev / Home-Lab)"),
        ("2.", "Phase 2 — Staging (Pre-Production Hardening)"),
        ("3.", "Phase 3 — Corporate AI Security Posture"),
        ("4.", "Scaling Architecture (Phase 3 Target State)"),
        ("5.", "Implementation Checklist"),
        ("6.", "Cost Estimates (Monthly)"),
        ("7.", "Open Items / Decisions Needed"),
    ]
    for num, title in toc:
        elements.append(Paragraph(
            f'<font color="#00BCEB"><b>{num}</b></font>  {title}',
            S["toc_entry"]))

    elements.append(PageBreak())
    return elements


# ── Document body ─────────────────────────────────────────────────────────────
def build_body():
    E = []

    def h1(text):
        E.append(divider())
        E.append(Paragraph(text, S["h1"]))

    def h2(text):
        E.append(Paragraph(text, S["h2"]))

    def h3(text):
        E.append(Paragraph(text, S["h3"]))

    def p(text):
        E.append(Paragraph(text, S["body"]))

    def bullet(text, sub=False):
        s = S["sub_bullet"] if sub else S["bullet"]
        E.append(Paragraph(f"• {text}", s))

    def code(text):
        # escape XML but keep formatting
        safe = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        E.append(Paragraph(safe, S["code"]))

    def callout(text):
        E.append(Paragraph(text, S["callout"]))

    def sp(n=0.1):
        E.append(Spacer(1, n * inch))

    # ── Section 1 ─────────────────────────────────────────────────────────────
    h1("1. Current Architecture (Phase 1 — AWS Dev / Home-Lab)")
    callout("Status: Phase 1 deployed. This document is the roadmap from home-lab through "
            "full corporate AI security posture (Phase 3).")

    p("The AVops Webex Support system uses a 7-agent Claude AI pipeline to receive, triage, "
      "diagnose, and resolve AV support requests submitted via Webex. All state is persisted "
      "to AWS-managed services:")

    code(
        "Webex Space\n"
        "    │  webhook POST\n"
        "    ▼\n"
        "FastAPI (port 8080)\n"
        "    │\n"
        "    ├─► DynamoDB (tickets, devices, agent-state)\n"
        "    ├─► S3       (logs, reports, firmware)\n"
        "    ├─► SQS FIFO (agent-tasks, webex-events)\n"
        "    └─► Anthropic API (7-agent pipeline)\n"
        "             │\n"
        "             claude-opus-4-6\n"
        "             (Orchestrator → Researcher → Planner →\n"
        "              Implementer → Tester → Reviewer → Documenter)"
    )

    h2("1.1  Phase 1 AWS Services")
    E.append(make_table(
        ["Service", "Purpose", "Resource / Config"],
        [
            ["DynamoDB", "Tickets, devices, rooms, agent state", "4 tables, PAY_PER_REQUEST billing"],
            ["S3", "Logs archive, reports, firmware files", "3 buckets, AES-256 SSE, versioned"],
            ["SQS FIFO", "Agent task dispatch + Webex event buffer", "2 queues + dead-letter queues"],
            ["Secrets Manager", "Webex token, Anthropic key, SQS URLs", "3 secrets"],
            ["IAM", "Least-privilege app role", "1 role, no wildcard actions"],
        ],
        col_widths=[1.4 * inch, 2.6 * inch, 2.5 * inch],
    ))
    sp()

    h2("1.2  Deployment Options")
    bullet(f"{b('Option A — Local / Home-Lab:')} Docker Compose + LocalStack")
    code("docker compose up -d   # FastAPI + React + LocalStack on localhost")
    bullet(f"{b('Option B — EC2 / ECS Fargate (manual):')}")
    code("pip install -e \".[dev]\"\nuvicorn avops.main:app --host 0.0.0.0 --port 8080")
    bullet(f"{b('Option C — CDK automated deploy (creates all AWS resources):')}")
    code("cd infrastructure/cdk\npip install -r requirements.txt\ncdk deploy -c env=dev -c account=YOUR_ACCOUNT -c region=us-east-1")

    # ── Section 2 ─────────────────────────────────────────────────────────────
    E.append(PageBreak())
    h1("2. Phase 2 — Staging (Pre-Production Hardening)")

    h2("2.1  Networking")
    bullet(f"{b('VPC')} with private subnets for all ECS tasks — no public IPs on app layer")
    bullet(f"{b('NAT Gateway')} for outbound-only internet (Webex webhooks, Anthropic API)")
    bullet(f"{b('VPC Endpoints')} for DynamoDB, S3, SQS, Secrets Manager — traffic never leaves AWS backbone")
    bullet(f"{b('Security Groups:')} ECS tasks accept traffic from ALB only; port 8080 only")
    sp(0.05)
    code(
        "Internet → ALB (public subnet, WAF) → ECS Fargate (private subnet)\n"
        "                                               │\n"
        "                                   VPC Endpoints → DynamoDB / S3 / SQS"
    )

    h2("2.2  Authentication & Authorization")
    bullet(f"{b('Amazon Cognito User Pool')} — dashboard login for AV engineers")
    bullet(f"{b('API Gateway')} in front of FastAPI with Cognito JWT authorizer")
    bullet(f"RBAC roles: {code_inline('av-engineer')} (read-only) · {code_inline('av-admin')} (read-write) · {code_inline('av-ops')} (full)")
    bullet(f"FastAPI: {code_inline('ENABLE_AUTH=true')} enables JWT validation on all protected routes")

    h2("2.3  Encryption Upgrades")
    E.append(make_table(
        ["Resource", "Phase 1", "Phase 2 Upgrade"],
        [
            ["DynamoDB", "AWS-managed key", "CMK (Customer Managed Key) via KMS"],
            ["S3", "SSE-S3 (AES-256)", "SSE-KMS with CMK"],
            ["SQS", "Default encryption", "KMS CMK"],
            ["Secrets Manager", "Default", "CMK + auto-rotation enabled"],
        ],
        col_widths=[1.5 * inch, 2.0 * inch, 3.0 * inch],
    ))
    sp()

    h2("2.4  Logging & Monitoring")
    bullet(f"{b('AWS CloudTrail')} — all API calls logged to dedicated S3 bucket")
    bullet(f"{b('CloudWatch Logs')} — FastAPI structured logs → Log Groups per environment")
    bullet(f"{b('CloudWatch Metrics')} — tickets/min, agent pipeline latency, error rate")
    bullet(f"{b('CloudWatch Alarms')} — DLQ depth > 0, API 5xx rate > 1%, Anthropic 429s")
    bullet(f"{b('AWS Config')} — drift detection on DynamoDB policies, S3 bucket ACLs")

    h2("2.5  Web Application Firewall (WAF)")
    bullet(f"{b('AWS WAF')} attached to Application Load Balancer:")
    bullet("AWS Managed Rules: Core Rule Set + Known Bad Inputs", sub=True)
    bullet("Rate limiting: 100 requests per 5 min per source IP", sub=True)
    bullet("Geo-blocking: restrict to corporate office CIDRs + Webex IP ranges", sub=True)
    bullet("Custom rule: block requests to webhook endpoint with non-Webex User-Agent", sub=True)

    # ── Section 3 ─────────────────────────────────────────────────────────────
    E.append(PageBreak())
    h1("3. Phase 3 — Corporate AI Security Posture")

    h2("3.1  AI Model Governance")
    E.append(make_table(
        ["Requirement", "Implementation"],
        [
            ["Model approval", "Only Anthropic Claude models — no open-weight / self-hosted models"],
            ["Data residency", "All prompts & responses stay in AWS us-east-1"],
            ["PII scrubbing", "Strip emails & device passwords from Anthropic API payloads pre-send"],
            ["Prompt injection", "Input sanitisation layer before every agent dispatch"],
            ["Output validation", "JSON schema validation on all 7 agent outputs"],
            ["Cost controls", "max_budget_usd per ticket + CloudWatch billing alarm"],
            ["Audit trail", "Every API call logged: ticket_id, tokens used, model, latency"],
        ],
        col_widths=[2.0 * inch, 4.5 * inch],
    ))
    sp()

    h2("3.2  Zero-Trust Network Architecture")
    code(
        "Corporate Users → AWS SSO / IAM Identity Center\n"
        "                         │\n"
        "               Cognito User Pool (MFA enforced)\n"
        "                         │\n"
        "               API Gateway (private, VPC endpoint)\n"
        "                         │\n"
        "               ECS Fargate (no public IP)\n"
        "                         │\n"
        "          ┌──────────────┴──────────────┐\n"
        "     DynamoDB                       Secrets Mgr\n"
        "     (VPC endpoint)                 (VPC endpoint)"
    )

    h2("3.3  Data Classification")
    E.append(make_table(
        ["Data Type", "Classification", "Controls"],
        [
            ["Webex messages", "Confidential", "Encrypted at rest + transit · 365-day retention"],
            ["Device credentials", "Secret", "Secrets Manager only · never logged · rotated 90 days"],
            ["Agent transcripts", "Internal", "S3 SSE-KMS · 365-day lifecycle · presigned URLs only"],
            ["Support tickets", "Internal", "DynamoDB CMK · Point-in-time recovery enabled"],
            ["Firmware files", "Public", "S3 standard · no PII · public read restricted"],
        ],
        col_widths=[1.6 * inch, 1.4 * inch, 3.5 * inch],
    ))
    sp()

    h2("3.4  IAM Hardening — Least Privilege Example")
    p("Replace broad table-level grants with fine-grained action-level permissions:")
    code(
        "# Tickets table — only the 4 operations the app actually needs\n"
        "actions = [\n"
        "    \"dynamodb:PutItem\",\n"
        "    \"dynamodb:GetItem\",\n"
        "    \"dynamodb:UpdateItem\",\n"
        "    \"dynamodb:Query\",\n"
        "]\n"
        "# Explicitly denied: Scan, DeleteItem, DescribeTable, BatchWriteItem\n"
        "# Condition: aws:RequestedRegion == us-east-1 only"
    )

    h2("3.5  Secrets Rotation")
    E.append(make_table(
        ["Secret", "Rotation Method", "Frequency"],
        [
            ["Webex Bot Token", "Secrets Manager auto-rotation via Lambda", "Every 90 days"],
            ["Anthropic API Key", "Manual (no rotation API)", "Every 90 days"],
            ["Device Credentials", "CyberArk / Vault integration (future)", "Every 30 days"],
        ],
        col_widths=[1.8 * inch, 3.0 * inch, 1.7 * inch],
    ))
    sp()

    h2("3.6  Compliance Framework Mapping")
    E.append(make_table(
        ["Framework", "Controls Required"],
        [
            ["SOC 2 Type II", "CloudTrail · AWS Config · VPC Flow Logs · WAF · PITR"],
            ["NIST 800-53", "CMK · MFA enforced · Least-privilege IAM · Full audit logging"],
            ["Corp AI Policy", "Model registry · PII stripping · Cost cap · Human override"],
            ["GDPR (if EU data)", "Data residency config · Right-to-erasure API · Consent logging"],
        ],
        col_widths=[1.8 * inch, 4.7 * inch],
    ))

    # ── Section 4 ─────────────────────────────────────────────────────────────
    E.append(PageBreak())
    h1("4. Scaling Architecture (Phase 3 Target State)")
    code(
        "                  ┌──────────────────────────────────────┐\n"
        "                  │          AWS us-east-1               │\n"
        "                  │                                      │\n"
        "  Webex Bot        │  ALB (WAF + Cognito authorizer)     │\n"
        "  Webhook ─────────►    │                                │\n"
        "                  │    ├─ ECS Fargate (FastAPI)          │\n"
        "  Corp Users ──────►    │     └─ Port 8080  (2 AZs)     │\n"
        "  (Cognito JWT)   │    │                                 │\n"
        "                  │    └─ ECS Fargate (SQS Worker)       │\n"
        "                  │         └─ agent-tasks.fifo          │\n"
        "                  │              └─ Claude API           │\n"
        "                  │                  (7 agents)          │\n"
        "                  │                                      │\n"
        "                  │  DynamoDB   S3    SQS   Secrets Mgr  │\n"
        "                  │  CloudWatch  CloudTrail  Config WAF  │\n"
        "                  └──────────────────────────────────────┘"
    )

    h2("Auto-Scaling Triggers")
    E.append(make_table(
        ["Metric", "Threshold", "Action"],
        [
            ["SQS agent queue depth", "> 50 messages", "Scale ECS worker +2 tasks"],
            ["FastAPI p99 latency", "> 2 seconds", "Scale FastAPI service +2 tasks"],
            ["DynamoDB consumed RCU", "> 80% provisioned", "Enable DynamoDB auto-scaling"],
            ["Anthropic API 429 rate", "> 3 in 60 sec", "Exponential backoff (built-in SDK)"],
        ],
        col_widths=[2.2 * inch, 1.8 * inch, 2.5 * inch],
    ))

    # ── Section 5 ─────────────────────────────────────────────────────────────
    E.append(PageBreak())
    h1("5. Implementation Checklist")

    h2("Phase 1 → Phase 2 (Staging)")
    checklist_1 = [
        ["☐", "Deploy CDK stack (infrastructure/cdk/avops_stack.py)"],
        ["☐", "Populate Secrets Manager: Webex Bot Token + Anthropic API Key"],
        ["☐", "Set USE_SECRETS_MANAGER=true in ECS task definition"],
        ["☐", "Create Cognito User Pool + app client"],
        ["☐", "Set ENABLE_AUTH=true + Cognito environment variables"],
        ["☐", "Enable WAF on Application Load Balancer"],
        ["☐", "Configure CloudWatch alarms (DLQ depth, 5xx rate)"],
        ["☐", "Enable CloudTrail in all active regions"],
        ["☐", "Verify Webex webhook signature validation in production"],
        ["☐", "Load test: 100 concurrent tickets through 7-agent pipeline"],
    ]
    t = Table(checklist_1, colWidths=[0.35 * inch, 6.15 * inch])
    t.setStyle(CHECKLIST_STYLE)
    E.append(t)
    sp(0.15)

    h2("Phase 2 → Phase 3 (Corp AI Posture)")
    checklist_2 = [
        ["☐", "Create KMS CMKs for DynamoDB, S3, SQS encryption"],
        ["☐", "Enable Secrets Manager auto-rotation for Webex Bot Token"],
        ["☐", "Implement PII scrubber layer before all Anthropic API calls"],
        ["☐", "Add max_budget_usd cap per ticket to BaseAgent class"],
        ["☐", "Deploy VPC with private subnets + VPC endpoints (no internet for data services)"],
        ["☐", "Configure Cognito MFA (TOTP or SMS) for all engineer accounts"],
        ["☐", "Run SOC 2 gap assessment with compliance team"],
        ["☐", "Register claude-opus-4-6 in corporate AI model registry"],
        ["☐", "Add PagerDuty escalation for priority=critical tickets"],
        ["☐", "Conduct penetration test on webhook endpoint and API Gateway"],
        ["☐", "Enable VPC Flow Logs → CloudWatch for network anomaly detection"],
        ["☐", "GDPR review: confirm no EU employee data in scope, or configure residency"],
    ]
    t2 = Table(checklist_2, colWidths=[0.35 * inch, 6.15 * inch])
    t2.setStyle(CHECKLIST_STYLE)
    E.append(t2)

    # ── Section 6 ─────────────────────────────────────────────────────────────
    E.append(PageBreak())
    h1("6. Cost Estimates (Monthly)")
    callout("Note: Anthropic Claude costs dominate. Cost scales with ticket volume and "
            "number of agent turns per ticket (7 agents × avg. 2K tokens each).")

    h2("Phase 1 — Dev / Home-Lab (~500 tickets / month)")
    E.append(make_table(
        ["AWS Service", "Estimated Cost"],
        [
            ["DynamoDB (PAY_PER_REQUEST)", "~$2"],
            ["S3 — logs + reports", "~$1"],
            ["SQS", "~$0.01"],
            ["Secrets Manager", "~$1.50"],
            ["Anthropic Claude (7 agents × 500 tickets)", "~$35–85"],
            [b("Total"), b("~$40–90 / month")],
        ],
        col_widths=[4.5 * inch, 2.0 * inch],
    ))
    sp(0.2)

    h2("Phase 3 — Production (~5,000 tickets / month)")
    E.append(make_table(
        ["AWS Service", "Estimated Cost"],
        [
            ["ECS Fargate (2 services, 2 AZs)", "~$80"],
            ["DynamoDB", "~$20"],
            ["S3", "~$5"],
            ["SQS + DLQs", "~$1"],
            ["Secrets Manager", "~$3"],
            ["WAF", "~$10"],
            ["CloudWatch + CloudTrail", "~$15"],
            ["KMS (CMKs)", "~$6"],
            ["Anthropic Claude", "~$350–850"],
            [b("Total"), b("~$490–990 / month")],
        ],
        col_widths=[4.5 * inch, 2.0 * inch],
    ))

    # ── Section 7 ─────────────────────────────────────────────────────────────
    E.append(PageBreak())
    h1("7. Open Items / Decisions Needed")
    callout("The following items require team input before Phase 2 deployment can begin.")

    items = [
        ("Webex Bot Scope",
         "Should the bot respond in individual Webex DMs only, or also in shared group support spaces? "
         "Group spaces require additional moderation and PII handling rules."),
        ("AI Model Approval",
         "Does the corporate AI policy require claude-opus-4-6 to be formally registered "
         "in the model registry before production use? If so, initiate the approval workflow."),
        ("Device Credential Vault",
         "Should AV device passwords be stored in AWS Secrets Manager (already provisioned) "
         "or integrated with an enterprise vault (CyberArk / HashiCorp Vault)?"),
        ("GDPR Applicability",
         "Are any European employees or conference rooms in scope? If yes, data residency "
         "configuration (EU-only DynamoDB table, S3 bucket in eu-west-1) is required before go-live."),
        ("On-Call Integration",
         "Should priority=critical tickets trigger a PagerDuty / OpsGenie escalation in addition "
         "to the automated agent response? Recommended for exec/boardroom incidents."),
        ("Anthropic Rate Limits",
         "Confirm the current Anthropic account tier (tokens per minute) before production rollout. "
         "At 7 agents × 5,000 tickets/month, peak burst may require a rate limit increase."),
    ]

    for i, (title, detail) in enumerate(items, 1):
        E.append(KeepTogether([
            Paragraph(f"{i}.  {b(title)}", S["h3"]),
            Paragraph(detail, S["body"]),
            Spacer(1, 0.05 * inch),
        ]))

    sp(0.2)
    divider()
    E.append(Paragraph(
        it("This document is INTERNAL. Do not distribute outside the AV Engineering and "
           "IT Security teams without approval from AVops leadership."),
        S["callout"],
    ))

    return E


# ── Main ──────────────────────────────────────────────────────────────────────
def generate(output_path: str):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=LETTER,
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.6 * inch,
        title="AVops Webex Support Agents — AWS Architecture & Security Posture Plan",
        author="AVops Engineering",
        subject="AWS Architecture and Corporate AI Security Posture",
    )

    story = build_cover() + build_body()
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF generated: {output_path}")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "docs/AVops-AWS-Security-Plan.pdf"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    generate(out)
