# MCP Provider Registry

**Design Document** | **Tool Authorization Matrix** | **Policy-Governed Access**

Defines the initial set of MCP providers available for NeuronX agent runtime, with explicit authorization controls, risk tier restrictions, and evidence requirements.

## Provider Authorization Matrix

| Provider | Status | Risk Tier | Roles Allowed | Evidence Required |
|----------|--------|-----------|---------------|-------------------|
| GitHub | Mandatory | Green/Yellow | All roles | Full audit trail |
| Playwright | Mandatory | Green/Yellow | Implementer/Auditor | Test evidence + screenshots |
| Security | Mandatory | Green/Yellow | Auditor | Scan results + compliance |
| Docker | Optional | Yellow | Implementer | Build logs + security scan |

## Provider Specifications

### GitHub MCP (Mandatory Target)

**Purpose**: Repository and project management operations

**Status**: Phase 4B.1 (read-only adapter implemented)
**Risk Tier**: Green only (read-only; Yellow/Red blocked)
**Roles Allowed**: Planner/Implementer/Auditor (read-only scope)

**Supported Actions (read-only)**:
- `list_issues`: List repository issues with filters
- `get_issue`: Retrieve issue details and comments
- `list_prs`: List pull requests with filters
- `get_pr`: Retrieve pull request details
- `get_checks`: Retrieve workflow checks for a commit/PR
- `get_ci_status`: Summarize CI status for a commit/PR

**Evidence Requirements**:
- Action performed and parameters
- Response data structure (sanitized)
- Success/failure status
- Repository and issue/PR identifiers
- Timestamp and user context

**Policy Guardrails**:
- Read-only enforced (no create/update/branch operations)
- Repository operations limited to current project scope
- MCP server command required; fails fast if missing
- Rate limiting and error handling required

**Required Environment**:
- `GITHUB_TOKEN` (required for live MCP calls)
- `GITHUB_REPO` (optional; defaults to config or "owner/repo")
- `MCP_GITHUB_SERVER` (optional; `stdio` default, `noop` disables execution)

### Playwright MCP (Mandatory Target)

**Purpose**: Web automation and testing operations

**Risk Tier**: Green/Yellow (no Red - security violation)
**Roles Allowed**: Implementer (automation), Auditor (validation)

**Supported Actions**:
- `navigate`: Navigate to URLs with validation
- `click`: Click elements with selectors
- `type_text`: Input text into form fields
- `take_screenshot`: Capture page screenshots
- `get_text`: Extract text content from elements
- `wait_for_element`: Wait for elements to appear
- `execute_script`: Run safe JavaScript snippets
- `get_page_info`: Get page metadata and status

**Evidence Requirements**:
- URL accessed and navigation path
- Element selectors and actions performed
- Screenshots with metadata (filename, timestamp)
- Text extraction results (length-limited)
- Success/failure with error details
- Performance metrics (load time, etc.)

**Policy Guardrails**:
- No access to production systems
- URL allowlist enforcement
- Screenshot storage with retention limits
- JavaScript execution limited to safe operations
- No credential input or sensitive data handling

### Security MCP (Mandatory Target)

**Purpose**: Vulnerability scanning and security analysis

**Risk Tier**: Green/Yellow (no Red - compliance requirement)
**Roles Allowed**: Auditor (primary), Planner (assessment)

**Supported Actions**:
- `scan_dependencies`: Analyze package dependencies
- `scan_code`: Static code security analysis
- `check_secrets`: Detect potential secret leaks
- `vulnerability_report`: Generate security reports
- `compliance_check`: Validate security compliance
- `get_scan_results`: Retrieve previous scan results

**Evidence Requirements**:
- Scan parameters and scope
- Vulnerability findings (severity, location, description)
- Compliance status and violations
- False positive/negative analysis
- Remediation recommendations
- Scan metadata (duration, coverage)

**Policy Guardrails**:
- No access to production secrets
- Results stored with proper retention
- Severity-based alerting thresholds
- Compliance with security policies
- No exploitation or testing of vulnerabilities

### Docker MCP (Optional Future)

**Purpose**: Container operations and build management

**Risk Tier**: Yellow (no Green - safety requirement, no Red - policy violation)
**Roles Allowed**: Implementer (build/deploy), Auditor (validation)

**Supported Actions**:
- `build_image`: Build container images from Dockerfiles
- `run_container`: Execute containers with restrictions
- `list_images`: Inventory container images
- `scan_image`: Security scan container images
- `get_logs`: Retrieve container execution logs
- `cleanup_images`: Remove unused container images

**Evidence Requirements**:
- Build commands and parameters
- Image metadata (size, layers, base image)
- Security scan results and vulnerabilities
- Execution logs (filtered for sensitive data)
- Resource usage metrics
- Cleanup operations and results

**Policy Guardrails**:
- No privileged container execution
- Image building limited to approved base images
- Network access restricted in containers
- Volume mounts limited to approved paths
- Automatic cleanup and resource limits

## Authorization Framework

### Risk Tier Enforcement

**Green Tier MCP Access**:
- Basic read operations (get, list, info)
- Non-destructive actions
- Well-established patterns
- Low security risk

**Yellow Tier MCP Access**:
- Write operations (create, update, execute)
- Destructive actions with safeguards
- Complex operations requiring validation
- Medium security risk with controls

**Red Tier MCP Blocking**:
- All MCP access blocked
- Security policy violation if attempted
- Immediate escalation to human oversight
- No exceptions for any provider

### Role-Based Permissions

**Planner Role**:
- Read-only MCP operations for planning
- Information gathering for decision making
- No execution or modification capabilities
- Planning evidence generation

**Implementer Role**:
- Full MCP execution capabilities
- Tool operation and result processing
- Implementation evidence collection
- Error handling and recovery

**Auditor Role**:
- MCP validation and compliance checking
- Evidence verification and completeness
- Security assessment and reporting
- Audit trail generation and review

## Evidence Collection Standards

### MCP Operation Evidence

All MCP operations must generate evidence containing:

- **Provider Information**: Name, version, configuration
- **Action Details**: Specific action, parameters, context
- **Execution Context**: Timestamp, user, session ID
- **Results Data**: Success/failure, output data (sanitized)
- **Policy Compliance**: Authorization checks, risk assessments
- **Error Information**: Failure reasons, recovery actions

### Evidence Storage

- **Session-Based**: Evidence linked to agent runtime sessions
- **Structured Format**: JSON with consistent schema
- **Sanitized Data**: Sensitive information removed or masked
- **Retention Policy**: Governed by organizational requirements
- **Audit Trail**: Complete chain of MCP usage decisions

## Configuration Requirements

### Provider Configuration

Each provider requires configuration specifying:

- **Enable/Disable**: Explicit opt-in for security
- **Action Allowlist**: Specific actions permitted
- **Parameter Limits**: Constraints on action parameters
- **Rate Limiting**: Request frequency controls
- **Error Handling**: Failure mode specifications

### Security Configuration

- **Credential Management**: Environment variable references
- **Access Controls**: Provider-specific permissions
- **Network Security**: TLS and authentication requirements
- **Audit Logging**: Comprehensive activity recording

## Implementation Roadmap

### Phase 4A (Current): Design & Scaffolding
- Provider specifications and authorization matrix
- Configuration templates and validation
- Policy enforcement framework
- Evidence collection standards

### Phase 4B: Basic MCP Integration
- MCP server installation and configuration
- Basic tool calling implementation
- Network error handling and recovery
- MCP-specific evidence collection

### Phase 4C: Advanced Features
- Tool composition and orchestration
- Performance optimization and caching
- Enhanced security monitoring
- Multi-provider coordination

### Phase 4D: Production Operations
- High-availability MCP infrastructure
- Enterprise integration and compliance
- Advanced audit and monitoring
- Automated MCP management

---

**Provider Status**: Design phase complete. All providers defined with policy controls.
**Next Phase**: Phase 4B - Actual MCP server integration and tool calling.
**See Also**: [README.md](README.md) | [config.example.json](config.example.json) | [agent_runtime/policy.md](../policy.md)