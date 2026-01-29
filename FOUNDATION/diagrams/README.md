# FOUNDATION/diagrams — System Diagrams

This directory contains visual diagrams of the Autonomous Engineering OS system.

## Diagram Locations

All diagrams are embedded as **Mermaid** in the main FOUNDATION documents. PNG export is **optional** and can be generated via the mermaid-cli if needed.

## Diagram Index

| Diagram | Location | File |
|---------|----------|------|
| **System Architecture** | FOUNDATION/02_SYSTEM_ARCHITECTURE.md | Section 4 |
| **Daily Loop** | FOUNDATION/02_SYSTEM_ARCHITECTURE.md | Section 5 |
| **PR Workflow** | FOUNDATION/02_SYSTEM_ARCHITECTURE.md | Section 5 |
| **State Machine** | FOUNDATION/02_SYSTEM_ARCHITECTURE.md | Section 5 |
| **Artifact Flow** | FOUNDATION/02_SYSTEM_ARCHITECTURE.md | Section 5 |
| **Governance Gates** | FOUNDATION/03_GOVERNANCE_MODEL.md | Section 9 |
| **Agent Coordination** | FOUNDATION/04_AGENT_MODEL.md | Section 5 |
| **Antigravity Cockpit** | FOUNDATION/05_ANTIGRAVITY.md | Section 6 |
| **Trae Review Flow** | FOUNDATION/06_TRAE.md | Section 4 |
| **Factory Execution** | FOUNDATION/07_FACTORY.md | Section 6 |
| **SDLC State Machine** | FOUNDATION/08_SDLC.md | Section 3 |
| **SDLC Flow** | FOUNDATION/08_SDLC.md | Section 4 |
| **Founder Daily Loop** | FOUNDATION/09_FOUNDER_PLAYBOOK.md | Section 3 |
| **SaaS Architecture** | FOUNDATION/10_INVESTOR_STORY.md | Section 4 |

## Generating PNG Files (Optional)

If PNG files are needed (e.g., for presentations), they can be generated using mermaid-cli:

```bash
# Install mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Export a diagram from markdown
mmdc -i INPUT.md -o OUTPUT.png

# Example (extract diagram first)
mmdc -i diagram.mmd -o system_map.png
```

**Note**: PNG export is optional and should not block completion of FOUNDATION documents.

## Required Diagrams (Mermaid Embedded)

All required diagrams are already embedded in the canonical FOUNDATION documents as Mermaid diagrams. No separate PNG files are required for the canonical canon.

| Diagram | Embedded In | Mermaid | PNG |
|---------|-------------|---------|-----|
| System Architecture | 02_SYSTEM_ARCHITECTURE.md | ✅ | Optional |
| Daily Loop | 02_SYSTEM_ARCHITECTURE.md | ✅ | Optional |
| PR Workflow | 02_SYSTEM_ARCHITECTURE.md | ✅ | Optional |
| State Machine | 02_SYSTEM_ARCHITECTURE.md | ✅ | Optional |
| Agent Flow | 04_AGENT_MODEL.md | ✅ | Optional |
| Trae Flow | 06_TRAE.md | ✅ | Optional |
| SDLC Flow | 08_SDLC.md | ✅ | Optional |

## Definition of Done for Diagrams

- [x] All diagrams embedded as Mermaid in FOUNDATION documents
- [x] System architecture diagram complete
- [x] Daily loop diagram complete
- [x] PR workflow diagram complete
- [x] State machine diagram complete
- [x] Agent coordination diagram complete
- [x] Governance gates diagram complete
- [ ] PNG export (optional, not required for canonical)

---

**Last Updated**: 2026-01-26
**Status**: COMPLETE (PNG export optional)
