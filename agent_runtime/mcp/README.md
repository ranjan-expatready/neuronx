# Model Context Protocol (MCP) Integration

**Phase 4A: Design & Scaffolding** | **Optional External Tools** | **Policy-Guarded Access**

The Model Context Protocol (MCP) provides a standardized way to connect AI assistants with external tools and data sources while maintaining strict security and policy boundaries.

## What is MCP?

MCP is a protocol that enables AI assistants to securely access external tools and data sources through standardized interfaces. It provides:

- **Standardized Tool Discovery**: Tools advertise their capabilities
- **Secure Execution**: Requests go through MCP servers with access controls
- **Tool Composition**: Multiple tools can work together safely
- **Audit Trails**: All tool usage is logged and auditable

## Why MCP in NeuronX?

MCP integration enables NeuronX agents to access external capabilities while maintaining FAANG-grade governance:

### Controlled External Access
- **Repository-Only Default**: Core operations stay within repository boundaries
- **Explicit Opt-In**: MCP tools require explicit configuration and approval
- **Risk-Tier Guarded**: Only Green/Yellow tier tasks can use MCP tools
- **Red-Tier Blocked**: High-risk tasks never access external tools

### Governance Alignment
- **AGENTS.md Compliant**: All MCP usage follows agent operating rules
- **Evidence Required**: MCP tool usage generates complete audit trails
- **Policy Enforced**: Runtime checks ensure compliance with security policies
- **SSOT Driven**: MCP configuration derives from canonical governance

### Safety Boundaries
- **No Direct Network**: Agents never make direct network calls
- **Server-Mediated**: All external access goes through MCP servers
- **Credential Isolation**: Secrets managed by MCP servers, not agents
- **Failure Graceful**: MCP unavailability doesn't break core functionality

## MCP in Agent Runtime

### Optional Integration
MCP is completely optional and disabled by default:
- No MCP configuration required for basic functionality
- Agents work normally without MCP servers
- MCP enhances capabilities when explicitly configured

### Policy-Governed Usage
All MCP tool usage must pass multiple guardrails:

#### 1. Configuration Check
- MCP must be explicitly enabled in configuration
- Provider must be allowlisted
- Action must be approved

#### 2. Role Authorization
- **Planner**: Can check MCP availability for planning
- **Implementer**: Can use MCP tools for execution
- **Auditor**: Can validate MCP usage in evidence

#### 3. Risk Tier Enforcement
- **Green Tier**: Full MCP access for safe operations
- **Yellow Tier**: Limited MCP access with additional approval
- **Red Tier**: MCP completely blocked (policy violation)

#### 4. Evidence Requirements
- All MCP calls logged with complete context
- Success/failure status captured
- Provider and action details recorded
- Policy compliance verified

## Implementation Architecture

### MCP Bridge Layer
The `mcp_bridge.py` provides policy enforcement:
- Loads and validates MCP configuration
- Checks permissions against policies
- Provides allowlist verification
- Generates evidence for all checks

### Provider Registry
Initial providers (design phase):
- **GitHub MCP**: Repository and issue management
- **Playwright MCP**: Web automation and testing
- **Security MCP**: Vulnerability scanning and analysis
- **Docker MCP**: Container operations (future)

### Configuration Model
MCP configuration follows security principles:
- No secrets in configuration files
- Environment variables for credentials
- Explicit action allowlisting
- Provider-specific settings

## Usage Workflow

### Configuration (Admin Setup)
```json
{
  "enabled": true,
  "providers": {
    "github": {
      "enabled": true,
      "actions": ["get_issue", "create_branch"]
    },
    "playwright": {
      "enabled": true,
      "actions": ["navigate", "click", "screenshot"]
    }
  }
}
```

### Runtime Integration
```bash
# Enable MCP for specific task
python main.py --mcp-config mcp_config.json "Analyze GitHub issues"

# Evidence shows MCP usage
# ✅ MCP: github provider enabled, get_issue action allowed
# ✅ MCP: playwright provider enabled, screenshot action allowed
```

### Policy Enforcement
- **Pre-Check**: Bridge validates permissions before any MCP calls
- **Evidence**: All permission checks logged
- **Failure**: MCP unavailability falls back gracefully
- **Audit**: Complete trail of MCP usage decisions

## Security Considerations

### Trust Boundaries
- **MCP Server Trust**: Assume MCP servers are properly secured
- **Network Security**: TLS encryption for all MCP communications
- **Credential Management**: MCP servers handle sensitive credentials
- **Access Logging**: All MCP operations logged for audit

### Risk Mitigation
- **Allowlist Only**: Only explicitly approved providers and actions
- **Tier Restrictions**: High-risk tasks cannot use MCP
- **Failure Isolation**: MCP failures don't affect core functionality
- **Evidence Completeness**: All MCP operations fully auditable

## Future Phases

### Phase 4B: Basic MCP Server Integration (COMPLETED - stdio, read-only)
- Stdio runner added for MCP commands (no network installs performed here)
- Command argv required per provider; configs stay disabled by default
- Evidence logged for every MCP call (mcp_call event with redacted args)
- Risk tiers enforced: Red blocked, Yellow requires confirmation, Green allowed
- Provider-specific command validation (PATH lookup or absolute path)
- Structured results with timeouts, redaction, and error handling
- Required environment variables validated at call time (not load time)

#### Test commands (local, safe)

1) MCP disabled → blocked:
```bash
python3 agent_runtime/agno/main.py --mcp-call github list_issues '{}' "Read GitHub issues"
```

2) MCP enabled but no command configured:
```bash
python3 agent_runtime/agno/main.py --mcp-config agent_runtime/mcp/config.example.json --mcp-call github list_issues '{}' "Read GitHub issues"
```

3) MCP enabled, command set to missing binary:
```bash
cat > /tmp/mcp-missing.json <<'JSON'
{
  "enabled": true,
  "providers": {
    "github": {
      "enabled": true,
      "actions": ["list_issues"],
      "command": ["/nonexistent/binary"],
      "repository": "owner/repo",
      "serverMode": "stdio",
      "timeout_seconds": 30
    }
  }
}
JSON
GITHUB_TOKEN=dummy python3 agent_runtime/agno/main.py --mcp-config /tmp/mcp-missing.json --mcp-call github list_issues '{}' "Read GitHub issues"
```

4) Successful execution with echo command:
```bash
cat > /tmp/mcp-working.json <<'JSON'
{
  "enabled": true,
  "providers": {
    "github": {
      "enabled": true,
      "actions": ["list_issues"],
      "command": ["echo", "github-mcp-response"],
      "repository": "owner/repo",
      "serverMode": "stdio",
      "timeout_seconds": 30
    }
  }
}
JSON
GITHUB_TOKEN=dummy python3 agent_runtime/agno/main.py --mcp-config /tmp/mcp-working.json --mcp-call github list_issues '{"limit":5}' "Read GitHub issues"
```

### Phase 4C: Advanced MCP Features
- Tool composition and chaining
- MCP server orchestration
- Performance optimization
- Enhanced security monitoring

### Phase 4D: Production MCP Operations
- High-availability MCP infrastructure
- Automated MCP server management
- Advanced audit and compliance features
- Integration with enterprise security systems

---

**Phase 4A Status**: Design and scaffolding complete. MCP integration planned but not yet active.
**See Also**: [providers.md](providers.md) | [config.example.json](config.example.json) | [AGENTS.md](../AGENTS.md)