# NeuronX Factory Integration Playbook

**Factory-First Agent Runtime Integration** | **Evidence-Based Development** | **No-Drift Policy**

This playbook defines the standard operating procedure for Factory sessions working on NeuronX. It ensures consistent, governed interaction with our agent runtime while preserving all existing safety boundaries.

## Factory SessionStart Hook (Hard-Bound)

Starting with Phase 5B, every Factory/Droid session automatically loads canonical repository context via a SessionStart hook configured in `.factory/settings.json`. This ensures no drift from SSOT and AGENTS.md.

**Key implications:**
- Factory UI will not show MCP providers automatically; MCP enablement must be explicitly requested via `agent_runtime` with `--mcp-config` and allowlists.
- Session context (readiness check, state verification, canonical docs) is loaded automatically by the `.factory/hooks/neuronx_session_start.sh` hook.
- The hook requires `jq` for JSON parsing. Installation: macOS: `brew install jq`, Linux: `apt-get install jq` or use package manager.

The hook runs non-destructively, performing only read-only verification and context loading. It does not execute installs or network calls.

## Consistency Guard (Phase 5B.3)

An optional deterministic guard verifies state/progress consistency after the bootstrap ritual. Run:

```bash
bash scripts/verify_state_progress_consistency.sh
```

This checks that the last session ID in `STATE.json` appears in the last 50 lines of `PROGRESS.md`. Exit code 0 indicates consistency; exit code 1 indicates drift with remediation steps printed.

## Power User Setup

### Factory IDE Plugin (VSCode Extension)
- **Installation**: Install Factory extension from VSCode Marketplace
- **Verification**: Plugin enabled when Droid can reference open file errors without you pasting logs
- **Integration**: Works with existing `.factory/hooks/` and session start hooks

### Spec Mode Discipline
- **Trigger**: Shift+Tab required when touching >2 files, security/auth changes, or architectural modifications
- **Requirement**: Save spec to `.factory/docs/` before implementation
- **Enforcement**: Spec Mode ensures systematic review before execution

### Spec Mode Enforcement (PHASE 8A)

**When Required**: Spec Mode artifact required for any of:
- Multi-file changes (≥3 files excluding docs)
- Authentication/security/permissions modifications
- CI/workflow/governance changes
- Database schema/migrations

**Compliance Steps**:
1. Enable "Save spec as Markdown" in Spec Mode (Shift+Tab before implementation)
2. Complete planning dialog before writing code
3. Save spec to `.factory/docs/YYYY-MM-DD-descriptive-slug.md`
4. Add to PR body: `Spec: .factory/docs/YYYY-MM-DD-descriptive-slug.md`
5. For single-file docs-only changes, justify with "Spec N/A: [reason]"

**CI Gate**: Automated validation in `pr-quality-checks.yml`:
- Scripts: `scripts/validate-spec-artifact.ts`
- Reversible: Set `ENFORCE_SPEC_ARTIFACT=false` in GitHub vars

**Evidence**: Spec artifact must include:
- Implementation plan
- Files affected (list)
- Risk classification (GREEN/YELLOW/RED)
- Acceptance criteria
- Verification commands

## Essential Reading (Read First)

1. **[AGENTS.md](AGENTS.md)** - Canonical agent operating rules and evidence requirements
2. **[docs/SSOT/index.md](docs/SSOT/index.md)** - Single Source of Truth documentation hub
3. **[agent_runtime/agno/README.md](agent_runtime/agno/README.md)** - Agent runtime capabilities and safety boundaries

## Session Startup Sequence (MANDATORY)

**STOP: If you did not run the bootstrap ritual, do not proceed with any work.**

Every Factory session MUST execute the bootstrap ritual first:

```bash
# Run the complete bootstrap sequence
bash scripts/factory_session_bootstrap.sh

# Then verify state separately
python3 agent_runtime/agno/main.py --state
tail -n 30 agent_runtime/state/PROGRESS.md
```

### Why This Is Non-Negotiable
1. **Readiness check** ensures runtime dependencies are met
2. **State verification** prevents silent drift from previous sessions  
3. **Progress inspection** confirms you're working from current reality
4. **Evidence generation** creates an audit trail for compliance

### Fail-Fast Behavior
If the bootstrap script fails (exit code ≠ 0) or readiness is RED:
- **STOP** immediately
- **Report** the failure and remediation steps only
- **Do not** proceed with implementation

## Factory "Project Instruction / System Prompt" (Mandatory)

Copy and paste this exact block as the top "Project Instruction" in Factory:

```
NEURONX FACTORY SESSION CONTRACT (MANDATORY)

You are operating inside a governed execution substrate.

Before you do ANY repo work (including reading files), you MUST run and paste the outputs of:

1) bash scripts/factory_session_bootstrap.sh
2) python3 agent_runtime/agno/main.py --state
3) tail -n 30 agent_runtime/state/PROGRESS.md

If any command fails OR readiness is RED OR the bootstrap script exits non-zero:
- STOP immediately.
- Report the failure and remediation steps only.
- Do not proceed with implementation.

Tool-layer rules:
- Use local repo tools first.
- Use MCP only when explicitly invoked AND only through:
  python3 agent_runtime/agno/main.py --mcp-config <file> --mcp-call <provider> <action> '<json>' "<task>"
- Never assume MCP is enabled just because Factory UI offers connectors.
- ContextStream retrieval/write is allowed only when configured and readiness is not RED.
- Memory writes are allowed only after task success AND evidence gates pass.

No drift:
- SSOT + AGENTS.md are canonical.
- Do not create new governance files unless explicitly requested.
- Every meaningful action must generate evidence logs via agent_runtime.
```

This instruction block ensures Factory behaves like Cursor rules — referencing SSOT rather than duplicating it.

## Decision Framework

### When to Use Local Tools vs MCP vs ContextStream vs Memory Writes

Follow the decision logic encoded in [agent_runtime/state/STATE.json](agent_runtime/state/STATE.json):

1. **Local Tools Only**: For repository-safe operations (git, pnpm, type checking, etc.) 
2. **MCP Required**: For external system access that passes risk classification
   - GitHub API access for issues/PRs
   - Playwright for browser automation
   - Security scanning tools
3. **ContextStream Integration**: For historical context retrieval (optional)
4. **Memory Writing**: After successful task completion with sufficient evidence

## How to Use Autonomous MCP Execution

### When to Use Autonomous MCP

Autonomous MCP execution is designed for GREEN-tier tasks that require external system access and meet all safety requirements. Use the `--auto-mcp` flag when:

1. The task is classified as GREEN risk tier (no security, auth, or infrastructure implications)
2. You want to automate repetitive MCP operations without manual intervention
3. The task involves reading data from external systems (issues, PRs, etc.)

### Basic Usage

To use autonomous MCP execution, simply add the `--auto-mcp` flag to your command:

```bash
python3 agent_runtime/agno/main.py \
  --mcp-config mcp_config.json \
  --auto-mcp \
  "List open GitHub issues"
```

### Controlling Resource Usage

You can control resource usage with budget constraints:

```bash
python3 agent_runtime/agno/main.py \
  --mcp-config mcp_config.json \
  --auto-mcp \
  --mcp-budget-calls 10 \
  --mcp-budget-seconds 120 \
  "List GitHub issues and pull requests"
```

### Emergency Controls

If you need to disable autonomous MCP execution temporarily, set the environment variable:

```bash
NEURONX_AUTO_MCP_ENABLED=false
```

### Understanding the Decision Process

The autonomous MCP execution system makes decisions based on:

1. **Risk Classification**: Only GREEN-tier tasks are allowed
2. **Readiness Status**: Execution is blocked if readiness is RED
3. **Allowlist Check**: Only pre-approved actions are permitted
4. **Budget Constraints**: Session-level limits prevent resource exhaustion

### Interpreting Results

Successful autonomous MCP execution will show:
- GREEN TIER approval message
- Execution details including provider, action, and parameters
- MCP call results with data summary
- Evidence artifacts in `agent_runtime/evidence/`

Blocked executions will clearly indicate the reason:
- Risk tier blocking for YELLOW/RED tasks
- Readiness RED status
- Missing MCP configuration
- Budget exhaustion

### Evidence Generation

Every autonomous MCP execution generates detailed evidence:
- Decision reasoning logs
- MCP call records with parameters (redacted)
- Session start/end events
- Budget tracking information

All evidence is stored in `agent_runtime/evidence/` with timestamped JSON files.

### Risk Classification Guidelines

Agent runtime enforces a three-tier risk model:
- **GREEN**: Autonomous execution permitted
- **YELLOW**: Human confirmation required before execution
- **RED**: Human intervention required (HITL)

See [agent_runtime/agno/policy.py](agent_runtime/agno/policy.py) for implementation.

## MCP Usage Policy

MCP is **never** enabled through Factory UI toggles. It is only activated by explicitly passing an MCP configuration file to the agent runtime:

```bash
# Correct way to enable MCP:
python3 agent_runtime/agno/main.py --mcp-config path/to/config.json "Task description"

# Never modify production app code outside agent_runtime/
# Always validate configuration with readiness check:
python3 agent_runtime/agno/main.py --mcp-config path/to/config.json --readiness
```

### Evidence Requirements

Every meaningful action must produce an evidence trail:

1. **Readiness Check**: Logs to `agent_runtime/evidence/` with timestamp
2. **Task Execution**: Complete session logs with risk classification, planning, execution, audit
3. **State Changes**: Updates to `agent_runtime/state/STATE.json` and `agent_runtime/state/PROGRESS.md`

Evidence files use ISO8601 timestamps and are immutable once created.

## Supported MCP Providers (Optional & Gated)

These providers are available but must pass readiness validation:

| Provider | Purpose | Required Env Vars | Command Validation |
|----------|---------|-------------------|-------------------|
| github | GitHub API access | GITHUB_TOKEN | echo/github CLI |
| playwright | Browser automation | - | Playwright CLI |
| security | Dependency/code scanning | - | Security toolchain |
| docker | Container operations | - | Docker CLI |

Providers are configured in JSON files passed to `--mcp-config`.

## Troubleshooting Common Issues

### RED Readiness Status
When readiness check returns RED:
1. Check missing environment variables listed in output
2. Verify MCP configuration file exists and is valid
3. Confirm ContextStream credentials if enabled
4. Install missing binaries/tools

### Missing Environment Variables
Common missing variables:
- `GITHUB_TOKEN` - For GitHub API access
- `CONTEXTSTREAM_URL` - For ContextStream integration
- `CONTEXTSTREAM_API_KEY` - For ContextStream authentication

### Evidence Log Inspection
To inspect recent evidence:
```bash
ls -la agent_runtime/evidence/ | tail -n 10
cat agent_runtime/evidence/latest_timestamp_file.json
```

## Appendix A: Recommended MCP Server Implementations

These reference implementations can be used with our agent runtime:

1. **GitHub MCP Server**
   - Implements GitHub API actions with allowlist validation
   - Requires `GITHUB_TOKEN` environment variable
   - Available actions: list_issues, get_issue, list_prs, get_pr, get_checks, get_ci_status

2. **Playwright MCP Server**
   - Implements browser automation with safety boundaries
   - No required environment variables
   - Available actions: navigate, click, type_text, take_screenshot, get_text, wait_for_element, execute_script, get_page_info

3. **Security MCP Server**
   - Implements dependency and code scanning
   - No required environment variables
   - Available actions: scan_dependencies, scan_code, check_secrets, vulnerability_report, compliance_check, get_scan_results

4. **Docker MCP Server**
   - Implements container operations with isolation
   - No required environment variables
   - Available actions: build_image, run_container, list_images, scan_image, get_logs, cleanup_images

All servers must be configured with allowlists that match agent_runtime permissions.

## How to ask what happened last run

When you need to understand what happened in the last agent runtime session, you can use these diagnostic commands:

### Runtime Explanation
To get a deterministic explanation of the last session using evidence and STATE.json:
```bash
python3 agent_runtime/agno/main.py --explain
```

This command will show:
- Last session ID, task, mode, and result
- Readiness summary (ContextStream, MCP, Memory Write status)
- Risk tier and classification reason
- Governance closure status (if applicable)
- TDD proof status (if applicable)
- Tools/layers used (ContextStream, MCP, Memory Write)
- Evidence file citations (actual filenames used)

### MCP Inventory
To see what MCP providers and actions are configured:
```bash
python3 agent_runtime/agno/main.py --mcp-config path/to/config.json --mcp-inventory
```

This command shows:
- Overall MCP enabled status
- For each enabled provider:
  - Provider name
  - Allowed actions (list)
  - Command array (first element only for display)
  - Required environment variables

If no MCP config is provided:
```bash
python3 agent_runtime/agno/main.py --mcp-inventory
# Output: ❌ No MCP config provided
```

### MCP Inventory Export
To export the MCP inventory as JSON for UI display:
```bash
python3 agent_runtime/agno/main.py --mcp-config path/to/config.json --mcp-inventory-export .factory/ui/mcp_inventory.json
```

This exports a JSON file with:
- `timestamp`: ISO timestamp
- `config_hash`: SHA256 of config file (deterministic)
- `mcp_enabled`: boolean
- `providers`: array of provider objects as above

## No-Drift Policy Compliance

This playbook complies with our No-Drift Policy by:
- Referencing canonical documentation only
- Preserving existing agent runtime behavior
- Adding only optional helper scripts
- Maintaining evidence-based development practices

Changes to this playbook require evidence justification in accordance with [docs/SSOT/02_GOVERNANCE.md](docs/SSOT/02_GOVERNANCE.md).

Last Updated: 2026-01-17
Version: 1.0
