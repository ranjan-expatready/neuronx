# Model Routing Policy

> **DEPRECATED** (2026-02-04)
> This document describes a Gemini-based routing system that is NOT used by Claude Code.
> Claude Code uses a unified agent model as defined in CLAUDE.md Section F.
> This file is preserved for historical traceability only.

**Status**: DEPRECATED
**Superseded By**: CLAUDE.md Section F (Model/Subagent Routing)
**Original Enforcement**: Factory (Gemini)

## Default Models

| Role | Model | Reason |
|------|-------|--------|
| **Planner** (Antigravity) | `gemini-2.0-pro-exp-0211` | Max reasoning, large context window for state analysis. |
| **Executor** (Factory) | `gemini-2.0-flash-thinking-exp-01-21` | Speed, code generation capability. |
| **Reviewer** (Trae) | `gemini-2.0-pro-exp-0211` | Strict logic, policy enforcement, safety. |

## Risk Tier Overrides

| Tier | Required Model |
|------|----------------|
| **T0 (Infra)** | `gemini-2.0-pro-exp-0211` (Slow/Safe) |
| **T1 (Critical)** | `gemini-2.0-pro-exp-0211` |
| **T2 (High)** | `gemini-2.0-flash-thinking-exp-01-21` |
| **T3 (Routine)** | `gemini-2.0-flash-thinking-exp-01-21` |
| **T4 (Docs)** | `gemini-2.0-flash-thinking-exp-01-21` |

## Cost Guardrails
- **Max Tokens/Run**: 100k (Warn), 500k (Stop).
- **Model Fallback**: If Pro is down, use Flash Thinking with "Verify" step.
