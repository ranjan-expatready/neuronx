# Agent Runtime Tool Surface

**Approved Tools** | **Risk Classification** | **Role Authorization**

## Canonical References

**Canonical rules live in [/AGENTS.md](../AGENTS.md)**  
**SSOT index lives in [/docs/SSOT/index.md](../docs/SSOT/index.md)**  
**In conflicts, SSOT + AGENTS.md win.**

Defines the approved tool surface for agent runtime execution, with risk classification and role-based access controls. All tools are mapped to governance policies and require appropriate evidence.

## Tool Surface Principles

### Authorization Model

- **Role-Based Access**: Tools restricted by agent role capabilities
- **Risk-Gated Execution**: Tool usage limited by change risk tier
- **Evidence Requirements**: All tool usage generates auditable evidence
- **HITL Integration**: High-risk tools require human oversight

### Safety Boundaries

- **No Production Access**: Tools cannot affect production systems
- **Evidence-Only**: All operations logged with complete evidence chains
- **Rollback Capability**: Tools support change reversal where applicable
- **Policy Compliance**: Tool usage validated against SSOT policies

## Filesystem Tools

### File Reading Operations

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| `read_file` | Green | All roles | No | File content hash, access timestamp |
| `grep` | Green | All roles | No | Search pattern, match count, file paths |
| `list_dir` | Green | All roles | No | Directory structure, file metadata |
| `glob_file_search` | Green | All roles | No | Pattern matches, file paths, metadata |

### File Writing Operations

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| `search_replace` | Yellow | Implementer only | No (Green changes), Yes (Yellow) | Before/after content, change justification |
| `write` | Yellow | Implementer only | Yes | New file content, creation rationale |
| `delete_file` | Red | Implementer only | Yes | Deletion justification, backup verification |

## Version Control Tools

### Git Operations

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| `git status` | Green | All roles | No | Repository state, uncommitted changes |
| `git log` | Green | All roles | No | Commit history, change metadata |
| `git diff` | Green | All roles | No | Change comparison, line-by-line analysis |
| `git add` | Yellow | Implementer only | No | Staged files, change summary |
| `git commit` | Yellow | Implementer only | Yes | Commit message, changed files, evidence links |
| `git push` | Red | Implementer only | Yes | Branch name, commit range, review status |
| `git merge` | Red | Implementer only | Yes | Merge conflicts, resolution evidence |

## Testing Tools

### Test Execution

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| `npm run test:unit` | Green | All roles | No | Test results, coverage percentage, failure details |
| `npm run test:integration` | Green | All roles | No | Test execution logs, pass/fail status |
| `npm run test:e2e` | Yellow | All roles | No | Browser automation logs, screenshot evidence |
| `npm run test:coverage` | Green | All roles | No | Coverage reports, threshold validation |

### Test Generation

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| Test file creation | Yellow | Implementer only | No | Test structure, coverage targets, requirements mapping |

## Code Quality Tools

### Static Analysis

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| `npm run lint` | Green | All roles | No | Linting violations, rule violations, fix suggestions |
| `npm run typecheck` | Green | All roles | No | Type errors, compilation status |
| `npm run format:check` | Green | All roles | No | Formatting violations, style guide compliance |

### Code Formatting

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| `npm run format` | Yellow | Implementer only | No | Formatting changes, style guide application |

## Security Tools

### Vulnerability Scanning

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| Dependency review | Green | All roles | No | Vulnerability reports, severity levels, remediation guidance |
| Secret scanning | Green | All roles | No | Potential secret exposures, file locations |
| CodeQL analysis | Green | All roles | No | Security vulnerabilities, code quality issues |

### Security Assessment

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| Security audit scripts | Yellow | Auditor only | Yes | Security assessment reports, risk analysis |

## Validation Tools

### Governance Validation

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| `npm run validate:traceability` | Green | All roles | No | Traceability matrix validation, missing links |
| `npm run validate:evidence` | Green | All roles | No | Evidence completeness checks, missing artifacts |
| `npm run validate:agent-memory` | Green | All roles | No | Memory update validation, session state verification |

### Configuration Validation

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| Config validation scripts | Green | All roles | No | Configuration compliance, schema validation |

## Browser Automation Tools

### Web Interaction

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| Page navigation | Yellow | All roles | No | URL access, page load status, content snapshots |
| Element interaction | Yellow | All roles | Yes | UI element actions, before/after states |
| Screenshot capture | Green | All roles | No | Visual evidence, page state documentation |
| Console monitoring | Green | All roles | No | Browser console logs, error tracking |

### E2E Testing

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| Playwright execution | Yellow | All roles | No | Test execution logs, video recordings, failure evidence |

## Terminal/Command Tools

### System Operations

| Tool | Risk Tier | Authorized Roles | HITL Required | Evidence Generated |
|------|-----------|------------------|---------------|-------------------|
| `run_terminal_cmd` | Variable | Role-dependent | Risk-based | Command execution, exit codes, output capture |

**Risk Classification for Terminal Commands**:
- **Green**: Read-only operations, status checks, validation scripts
- **Yellow**: File operations, test execution, build processes
- **Red**: System modifications, network operations, deployment commands

## Tool Usage Policies

### Execution Guards

- **Pre-Execution Validation**: Tools validate against policy constraints
- **Runtime Monitoring**: Tool usage monitored for policy compliance
- **Evidence Collection**: All tool invocations generate audit trails
- **Failure Handling**: Tool failures trigger appropriate escalation

### Authorization Checks

- **Role Verification**: Tools verify caller has appropriate role permissions
- **Risk Assessment**: Tools assess operation risk before execution
- **HITL Routing**: High-risk operations routed to human oversight
- **Evidence Requirements**: Tools ensure evidence generation before completion

### Safety Mechanisms

- **Sandboxing**: Tools execute in controlled environments
- **Timeout Controls**: Operations limited by execution time limits
- **Resource Limits**: CPU, memory, and I/O restrictions enforced
- **Rollback Support**: Destructive operations support reversal

## Tool Integration Requirements

### Evidence Generation

All tools must generate:
- Execution timestamps and duration
- Input parameters and context
- Output results and status
- Error conditions and handling
- Policy compliance verification

### Audit Trail Integration

Tools integrate with audit systems to:
- Record all operations with evidence
- Maintain operation chains across tools
- Support forensic analysis and debugging
- Enable compliance reporting and verification

## MCP Tools

**Phase 4A: Design & Policy Framework** | **External Tool Integration** | **Governed Access**

### Overview

MCP (Model Context Protocol) tools provide access to external capabilities while maintaining strict policy controls. Unlike direct tool execution, MCP tools go through a bridge layer that enforces:

- **Provider Allowlisting**: Only approved MCP servers
- **Action Authorization**: Explicit action permissions
- **Risk Tier Compliance**: Green/Yellow operations only
- **Role Permissions**: Provider-specific role restrictions

### MCP Tool Characteristics

| Aspect | Direct Tools | MCP Tools |
|--------|-------------|-----------|
| **Execution** | Local process | Remote server |
| **Security** | Sandboxed | Server-controlled |
| **Network** | None | TLS-encrypted |
| **Credentials** | None | Server-managed |
| **Policy** | Allowlist only | Multi-layer checks |
| **Evidence** | Local logs | Complete audit trail |

### Authorization Flow

```
Task Request → Risk Classification → MCP Bridge Check → Provider Call
       ↓              ↓                    ↓              ↓
   Green/Yellow   Policy Compliant     Action Allowed  Server Response
```

#### Bridge Validation Checks

1. **Global MCP Enablement**: `mcp_bridge.is_mcp_enabled()`
2. **Provider Status**: `mcp_bridge.is_provider_enabled(provider)`
3. **Action Permission**: `mcp_bridge.is_action_allowed(provider, action)`
4. **Risk Tier Compliance**: Red-tier tasks blocked
5. **Role Authorization**: Provider-specific role permissions

#### Example Permission Check

```python
# Check if GitHub issue retrieval is allowed
permissions = mcp_bridge.check_mcp_permissions(
    provider="github",
    action="get_issue",
    risk_tier="GREEN",
    role="Planner"
)

if permissions['allowed']:
    # Proceed with MCP call
    result = call_github_mcp("get_issue", issue_number=123)
else:
    # Fallback or error
    reason = permissions['reason']  # "Action get_issue not allowlisted"
```

### Available MCP Providers

#### GitHub MCP
- **Purpose**: Repository and issue management
- **Risk Tier**: Green/Yellow
- **Roles**: Planner (read), Implementer (write), Auditor (validate)
- **Actions**: `get_issue`, `list_issues`, `create_branch`, etc.

#### Playwright MCP
- **Purpose**: Web automation and testing
- **Risk Tier**: Green/Yellow
- **Roles**: Implementer, Auditor
- **Actions**: `navigate`, `click`, `take_screenshot`, etc.

#### Security MCP
- **Purpose**: Vulnerability scanning and analysis
- **Risk Tier**: Green/Yellow
- **Roles**: Auditor (primary), Planner (assessment)
- **Actions**: `scan_dependencies`, `check_secrets`, etc.

### Configuration Requirements

MCP tools require explicit configuration:

```json
{
  "enabled": true,
  "providers": {
    "github": {
      "enabled": true,
      "actions": ["get_issue", "create_branch"]
    }
  }
}
```

Environment variables for credentials:
- `GITHUB_TOKEN`: GitHub access token
- `MCP_SERVER_HOST`: MCP server hostname
- `MCP_API_KEY`: Server authentication

### Evidence Generation

MCP tool usage generates comprehensive evidence:

- **Provider Identification**: Server and provider details
- **Action Context**: Specific action and parameters
- **Execution Results**: Success/failure with response data
- **Policy Validation**: Permission check results
- **Performance Metrics**: Response time and resource usage

### Safety Boundaries

#### Blocking Conditions
- **Red-Tier Tasks**: MCP completely unavailable
- **Unapproved Providers**: Only allowlisted servers
- **Unapproved Actions**: Explicit action permissions required
- **Configuration Missing**: MCP must be properly configured

#### Fallback Behavior
- **MCP Unavailable**: Graceful degradation to local tools
- **Permission Denied**: Clear error messages with remediation
- **Network Failure**: Automatic retry with backoff (future)
- **Server Error**: Evidence logging with recovery suggestions

### Future Implementation

#### Phase 4B: Basic Integration
- MCP server installation and configuration
- Basic tool calling with error handling
- Network security and TLS validation
- Performance monitoring and optimization

#### Phase 4C: Advanced Features
- Tool composition and orchestration
- Multi-provider workflows
- Enhanced error recovery
- Real-time monitoring and alerting

#### Phase 4D: Production Operations
- High-availability MCP infrastructure
- Enterprise security integration
- Automated compliance reporting
- Advanced audit and governance features

---

**Design Only**: MCP tools designed for Phase 4B implementation
**See Also**: [agent_runtime/mcp/README.md](../mcp/README.md) | [agent_runtime/mcp/providers.md](../mcp/providers.md) | [AGENTS.md](../AGENTS.md)