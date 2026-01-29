# Agent Runtime Agno Scaffold

**Minimal Safe Implementation** | **80/20 Principle** | **Phase 3B ContextStream Integration**

This directory contains the minimal, safe scaffold for NeuronX agent runtime using Agno. It provides the foundation for orchestrated, policy-governed AI agent execution while maintaining strict safety boundaries.

## Phase 4D: Readiness & API Completeness Verifier

Added in Phase 4D, the readiness verifier ensures that ContextStream, MCP, and configured providers are actually usable before execution. It performs comprehensive checks and logs evidence while updating STATE.json with readiness summary.

## Phase 4E: Factory Integration

As of Phase 4E, this agent runtime integrates with Factory AI sessions through standardized protocols. Factory sessions should consult [FACTORY_PLAYBOOK.md](../../FACTORY_PLAYBOOK.md) for integration guidelines.

MCP is **never** enabled through Factory UI toggles. It is only activated by explicitly passing an MCP configuration file to the agent runtime CLI:

```bash
# Correct way to enable MCP:
python3 agent_runtime/agno/main.py --mcp-config path/to/config.json "Task description"
```

## What This Scaffold Is

### Core Capabilities

- **CLI Task Execution**: Accept natural language tasks and classify risk
- **Role-Based Orchestration**: Planner → Implementer → Auditor coordination
- **Policy Enforcement**: Risk classification with HITL requirements for Red-tier
- **ContextStream Integration**: Optional memory retrieval and storage (implemented, gated)
- **Evidence Logging**: Complete audit trails for all operations
- **Safe Tool Execution**: Allowlisted tools with safety boundaries
- **Readiness Verification**: Automated checks for ContextStream, MCP, and providers (Phase 4D)

### Safety Features

- **Red-Tier Blocking**: Refuses all Red-tier tasks with HITL requirement message
- **DRY-RUN Planning**: Shows execution plan before any writes
- **Confirmation Required**: Explicit user confirmation for all write operations
- **Repository-Only**: No network calls, no external system access
- **Evidence-First**: All operations logged with complete context

### Architecture Components

- **main.py**: CLI entrypoint for task execution
- **roles.py**: Stub implementations for Planner, Implementer, Auditor roles
- **policy.py**: Risk classification engine with hardcoded Always-Red categories
- **evidence.py**: Simple file-based evidence logging system
- **toolrunner.py**: Safe tool execution with allowlist and blocking

## What This Scaffold Is NOT

### Not Yet Implemented

- **Full Agno Integration**: Minimal stubs only, no complex orchestration
- **Redis Caching**: No performance optimization layer
- **MCP Integration**: Design placeholders only, no actual connections
- **CI/CD Integration**: No automated quality gates or deployments
- **Multi-Agent Coordination**: Single-threaded execution only
- **ContextStream Advanced Features**: No retries/backoff, token budgeting, semantic ranking, auth hardening

### Not In Scope (Future Phases)

- **Production Deployment**: No production system access or credentials
- **External APIs**: No third-party service integrations
- **Complex Workflows**: No multi-step orchestration or conditionals
- **Performance Optimization**: No caching or async execution
- **UI Interfaces**: CLI-only, no web or desktop interfaces

## Usage Flow

### 1. Task Submission
```bash
python main.py "Add unit tests for the user service"
```

### 2. Risk Classification
- Policy engine analyzes task description
- Checks against Always-Red categories
- Returns Green/Yellow/Red classification

### 3. Execution Control
- **Red-tier**: Prints "HITL required" and exits
- **Green/Yellow**: Shows DRY-RUN execution plan

### 4. Confirmation & Execution
- Requires explicit "yes" confirmation for writes
- Executes in role sequence: Planner → Implementer → Auditor
- Logs all actions to evidence files

### 5. Validation
- Auditor runs quality checks
- Evidence logged with complete context
- Success/failure reported with details

## Safety Boundaries

### Blocked Operations

- **Always Red Categories**: auth, payments, secrets, destructive DB, infra, logging tampering, PII
- **Network Operations**: No HTTP calls, no external service access
- **File System**: Repository-only, no system file access
- **Process Execution**: Allowlisted commands only
- **Data Access**: No production databases or sensitive data

### Allowed Operations

- **Git**: status, diff, add, commit (with confirmation)
- **Package Scripts**: lint, typecheck, test:unit (if exist)
- **File Operations**: read-only within repository
- **Evidence Logging**: Local file system only

## Readiness Verification (Phase 4D)

The readiness verifier performs comprehensive checks to ensure all required components are properly configured and accessible:

### What It Checks

- **MCP Configuration**: Validates that MCP configuration loads correctly
- **Per-Provider Validation**: 
  - Command existence (shutil.which or absolute path)
  - Required environment variables (e.g., GITHUB_TOKEN for github provider)
- **ContextStream Validation**:
  - URL and API key presence
  - requests library availability
  
### Usage

```bash
# Run readiness check only
python main.py --readiness

# Readiness check runs automatically when these flags are used:
python main.py --mcp-config mcp_config.json "Some task"
python main.py --use-contextstream "Some task"
python main.py --write-memory "Some task"
```

### Output Format

The readiness check returns a structured result:
- **overall_status**: GREEN/YELLOW/RED
- **checks**: List of detailed check results with remediation guidance
- **capabilities**: Summary of enabled features
- **missing_env**: List of missing environment variables
- **timestamp**: When the check was performed

### Evidence & State Updates

- Logs `readiness_check` events to evidence files
- Updates `STATE.json` with:
  - `readiness.last_check`: Timestamp of last check
  - `readiness.overall_status`: Result of last check
  - `readiness.missing_env_count`: Count of missing environment variables

## Development Principles

### 80/20 Rule

- **Minimal Viable**: Just enough to demonstrate the architecture
- **Safety First**: Conservative allowlists and blocking
- **Evidence Heavy**: Complete logging for debugging and audit
- **Incremental Growth**: Foundation for future feature additions

### Quality Standards

- **Test Coverage**: All scaffold code should be testable
- **Error Handling**: Graceful failure with clear error messages
- **Logging**: Complete evidence trails for all operations
- **Documentation**: Clear interfaces and usage examples

## Integration Points

### With Repository

- **AGENTS.md**: Derives all policies from canonical rules
- **SSOT**: References governance documents for validation
- **Evidence Directory**: Logs to `agent_runtime/evidence/`
- **Tool Allowlist**: Matches `agent_runtime/tools.md` specifications

### With Future Phases

- **ContextStream Ready**: Interfaces designed for memory integration
- **MCP Compatible**: Placeholder interfaces for external tool connections
- **CI/CD Integration**: Evidence format designed for automated validation
- **Multi-Agent**: Role interfaces support future orchestration

## GitHub MCP read-only (Phase 4B.1)

- **Scope**: Read-only GitHub actions (`list_issues`, `get_issue`, `list_prs`, `get_pr`, `get_checks`, `get_ci_status`)
- **Enablement**: Provide `--mcp-config` with `providers.github.enabled=true` and allowlisted actions
- **Environment**: `GITHUB_TOKEN` required, optional `GITHUB_REPO`; `providers.github.command` must point to a local stdio MCP server or execution will fail gracefully
- **Execution**: `python main.py --mcp-config mcp_config.json --mcp-call github list_issues '{"limit":5}' "Read issues"`
- **Failure mode**: If the server command is missing or unavailable, the CLI reports a clear error and logs evidence without attempting writes

## ContextStream Integration

**Phase 3B Feature** | **Optional Memory Layer** | **Read-Heavy, Write-Light**

### Overview

ContextStream provides optional long-term memory capabilities that complement but never override the repository SSOT. It enables agents to learn from historical patterns while maintaining governance boundaries.

### Memory Hierarchy

```
┌─────────────────────────────────┐
│      Repository & SSOT          │ ← Canonical Truth (never overridden)
│   (docs/SSOT/, AGENTS.md, etc.) │
├─────────────────────────────────┤
│        ContextStream            │ ← Historical Patterns (complementary)
│   (optional long-term memory)   │
├─────────────────────────────────┤
│         Agent Runtime           │ ← Session Context (ephemeral)
│   (current execution state)     │
└─────────────────────────────────┘
```

### Configuration

ContextStream integration requires environment variables:

```bash
export CONTEXTSTREAM_URL="https://your-contextstream-instance.com"
export CONTEXTSTREAM_API_KEY="your-api-key"
export CONTEXTSTREAM_PROJECT="neuronx"  # Optional, defaults to 'neuronx'
```

If not configured, the system gracefully degrades to offline mode.

### Usage Modes

#### Retrieval Mode (Read-Heavy)

Enable with `--use-contextstream` flag:

```bash
# Retrieve relevant memories before planning
python main.py --use-contextstream "Implement user authentication"
```

**Behavior**:
- Retrieves up to 8 relevant memories for task context
- Shows memory summary before planning
- Planner considers historical patterns in task execution
- Evidence logged with retrieval results

#### Storage Mode (Write-Light)

Enable with `--write-memory` flag:

```bash
# Store successful completion as memory
python main.py --write-memory --memory-type pattern --memory-tags "auth,security" "Implement JWT authentication"
```

**Behavior**:
- Only stores after successful, non-dry-run task completion
- Shows memory record preview before storage
- Requires explicit user confirmation
- Links to evidence files as sources

### Safety Model

#### Defaults (Secure)
- **Retrieval**: Disabled by default (opt-in with `--use-contextstream`)
- **Storage**: Disabled by default (opt-in with `--write-memory`)
- **Graceful Degradation**: Works without ContextStream configuration
- **SSOT Priority**: Repository content always takes precedence

#### Memory Types
- **decision**: Architectural or policy decisions
- **gotcha**: Pitfalls, bugs, or lessons learned
- **pattern**: Successful approaches or best practices
- **incident**: Issues, failures, or recovery actions
- **mapping**: Relationships, dependencies, or connections

#### Validation
- **Schema Enforcement**: All memory records validated against schema
- **Source Linking**: Memory records link to evidence artifacts
- **User Confirmation**: Storage requires explicit approval
- **Evidence Logging**: All ContextStream operations logged

### Integration Architecture

#### With Agent Roles
- **Planner**: Consumes retrieved memories for informed planning
- **Implementer**: No direct ContextStream interaction
- **Auditor**: Validates ContextStream operations in evidence

## Quality Controls (Phase 3C)

### Retrieval Budgeting & Deduplication

ContextStream retrieval applies quality controls to ensure safe, bounded context injection:

#### Budgeting
- **Total Character Limit**: 10,000 characters across all retrieved memories
- **Per-Item Limit**: 1,200 characters per individual memory
- **Truncation**: Summaries are truncated with "...[truncated]" when exceeding limits
- **Early Termination**: Retrieval stops when total budget would be exceeded

#### Deduplication
- **ID-Based**: Prefers unique memory IDs when available
- **Content-Based**: Falls back to type+summary hash for deduplication
- **Normalization**: Ensures all memories have required fields (id, type, summary, sources, tags, date)

#### Safe Injection
- **Validated Fields**: Only well-formed memories are passed to Planner
- **No Hallucinations**: Missing fields use safe defaults, never invented content
- **Evidence Logging**: Budget parameters and deduplication results are logged

### Evidence-Backed Memory Writes

Memory storage requires complete evidence before allowing writes:

#### Required Evidence
- **Git Diff Summary**: Captures repository changes during execution
- **Test Results**: Validates code quality through linting, type checking, and unit tests
- **Session Context**: Complete audit trail of the task execution

#### Blocking Conditions
- **Missing Git Diff**: Memory writes blocked if no change evidence exists
- **Missing Test Results**: Memory writes blocked if audit validation was skipped
- **Incomplete Session**: Memory writes blocked if session evidence is missing

#### Safety Flow
1. Task execution completes successfully
2. Evidence completeness is validated
3. Memory record is built and previewed
4. User confirmation is required
5. Memory is stored only after explicit approval

## Repository Mapping (Phase 3C)

### Purpose

Repository mapping snapshots capture high-value structural information for future context:

- **Key Documents**: AGENTS.md, CONTRIBUTING.md, SSOT index, CODEOWNERS, PR templates
- **Directory Structure**: Top-level organization and component boundaries
- **Package Scripts**: Development workflows and automation commands
- **Architecture Context**: Repository structure for informed planning

### Usage

```bash
# Create repository mapping (requires --write-memory for storage)
python main.py --snapshot-repo-map --write-memory "Map repository structure"

# Flow:
# 1. Collects repository structure data
# 2. Builds mapping memory record
# 3. Shows preview with detailed structure
# 4. If ContextStream configured: offers remote storage
# 5. Otherwise: saves locally as evidence file
```

### Safety Model

#### Local-Only Fallback
- **No ContextStream**: Saves mapping to `agent_runtime/evidence/repo_map_snapshot_[timestamp].json`
- **Evidence Preservation**: All mappings are preserved locally regardless of remote storage
- **No External Dependencies**: Works without any external service configuration

#### User Confirmation
- **Preview Required**: Shows complete mapping structure before storage
- **Explicit Approval**: Requires "yes" for remote storage, "local" for local-only
- **Dual Options**: Can choose remote, local, or skip entirely

#### Data Boundaries
- **Repository Only**: Maps only the current repository structure
- **Metadata Only**: Captures structure, not sensitive file contents
- **Size Limits**: Automatically truncates very large documents

#### With Evidence System
- **Retrieval Events**: Logged with memory count and relevance
- **Storage Events**: Logged with record ID and confirmation
- **Error Events**: Logged for failed operations
- **Configuration Events**: Logged for setup validation

### Example Workflow

```bash
# 1. Enable ContextStream for informed execution
python main.py --use-contextstream "Refactor the user service API"

# Output shows graceful failure:
# 🔍 ContextStream: attempting retrieval...
# ❌ ContextStream: request failed (Connection failed), retrieved 0
# [continues with normal execution, no memories available]

# 2. Enable memory storage for successful completion
python main.py --write-memory --memory-type pattern --memory-tags "refactor,api" "Refactor the user service API"

# After successful completion:
# 🧠 Memory Storage
# 📝 Memory Record Preview
# Type: pattern
# Summary: Successfully completed: Refactor the user service API
# Tags: refactor,api
# Sources: 3 items
#
# Store this memory in ContextStream?
# Type 'yes' to store, anything else to skip: yes
# [If ContextStream configured: stores remotely]
# [If not configured: saves locally as evidence]
```

### Successful Retrieval Example

If your ContextStream endpoint is properly configured and returns valid data:

```bash
export CONTEXTSTREAM_URL="https://your-valid-endpoint.com"
export CONTEXTSTREAM_API_KEY="your-valid-key"
python main.py --use-contextstream "Implement authentication"

# Output might show:
# 🔍 ContextStream: attempting retrieval...
# ✅ ContextStream: retrieved 2 (budgeted/deduped)
# Context Summary:
#   1. [pattern] Previous auth implementation used JWT tokens
#   2. [gotcha] Remember to validate token expiration
```

### Next Phase (3C) Extensions

- **Enhanced Retrieval**: Semantic search with better relevance
- **Memory Quality**: Confidence scoring and validation
- **Cross-Session Learning**: Pattern recognition across projects
- **Integration APIs**: REST endpoints for external systems
- **Memory Maintenance**: Cleanup and consolidation policies

---

## Getting Started

### Prerequisites

- Python 3.8+
- Repository access (no external dependencies required)
- **Optional**: ContextStream environment variables for memory integration
  - `CONTEXTSTREAM_URL`
  - `CONTEXTSTREAM_API_KEY`
  - `CONTEXTSTREAM_PROJECT` (optional)

### Quick Test

```bash
cd agent_runtime/agno
python main.py "Show me the current git status"
```

### ContextStream Examples

```bash
# Basic execution (ContextStream disabled by default)
python main.py "Add unit tests for user service"

# With ContextStream retrieval (shows budgeted, deduped results)
python main.py --use-contextstream "Analyze codebase patterns"

# With memory storage (requires evidence completeness + confirmation)
python main.py --write-memory --memory-type pattern --memory-tags "testing,refactor" "Complete test implementation"

# Repository mapping snapshot
python main.py --snapshot-repo-map --write-memory "Map repository structure"

# Combined usage with all features
python main.py --use-contextstream --write-memory --memory-type decision --memory-tags "architecture,security" "Design authentication system"
```

This should demonstrate the safety boundaries and evidence logging without making any changes.

## Next Steps (Phase 3B+)

### Immediate Extensions

- **ContextStream Integration**: Add long-term memory capabilities
- **Tool Expansion**: Add more safe tools from allowlist
- **Error Recovery**: Add rollback capabilities for failed operations
- **Performance**: Add basic caching and optimization

### Advanced Features

- **Multi-Agent Orchestration**: Full Agno workflow coordination
- **MCP Integration**: External tool and service connections
- **CI/CD Integration**: Automated evidence validation
- **UI Interfaces**: Web-based task submission and monitoring

---

**Scaffold Status**: Phase 3B Complete - ContextStream integration added
**Next Phase**: Phase 3C - Enhanced retrieval, memory quality, and integration APIs
**See Also**: [agent_runtime/README.md](../README.md) | [AGENTS.md](../../AGENTS.md)