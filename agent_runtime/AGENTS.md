# Agent Runtime Scoped Operating Rules

**Canonical Reference** | **Scoped for agent_runtime work** | **Evidence-Based Development**

Refer to canonical sources for full governance:
- [`../AGENTS.md`](../AGENTS.md) – Root agent governance  
- [`docs/SSOT/index.md`](../docs/SSOT/index.md) – Single Source of Truth
- [`docs/SSOT/04_TEST_STRATEGY.md`](../docs/SSOT/04_TEST_STRATEGY.md) – Testing strategy

## Scope Boundary
- **Applies to**: All agent work inside `agent_runtime/` directory
- **Includes**: CLI tooling, MCP providers, evidence logging, state management
- **Excludes**: Production app code outside this directory

## Exact Runtime Commands (Copy/Paste)

### Readiness & State
```bash
python3 agent_runtime/agno/main.py --readiness
python3 agent_runtime/agno/main.py --state
```

### MCP Suggestions (Phase 5C)
```bash
python3 agent_runtime/agno/main.py --suggest-mcp "<task>"
python3 agent_runtime/agno/main.py --toolplan "<task>"  # alias
```

### Governed MCP Calls
```bash
# Requires --mcp-config and readiness GREEN/YELLOW
python3 agent_runtime/agno/main.py --mcp-config agent_runtime/agno/mcp_config_test.json \
  --mcp-call github list_issues '{"limit":5}' "List issues safely"
```

## Essential Rules (5 bullets)
1. Always check readiness before MCP calls
2. Use `--state` to see last session results  
3. Follow TDD for bug/logic changes (see below)
4. Always provide governance closure (`--close-governance`)
5. Store evidence in `agent_runtime/evidence/`

## Test-Driven Development (TDD) Policy
- **Add/modify a failing test first** – prove the defect or missing behavior
- **Run tests** – confirm failure, then fix implementation
- **Rerun all relevant tests** – ensure no regression

---

**Navigation**: See root AGENTS.md for complete governance.
