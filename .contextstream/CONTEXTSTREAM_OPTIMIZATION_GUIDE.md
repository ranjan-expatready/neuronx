# ContextStream MCP Integration - Optimization Guide

## Overview

This guide provides the optimal configuration for integrating ContextStream as your primary AI development assistant with Cline, leveraging all MCP servers effectively while maintaining strict governance compliance.

## 1. Priority Configuration

### Server Priority Order

1. **ContextStream MCP Server** (Primary) - High priority
   - Handles persistent memory, semantic search, and code intelligence
   - Should be called first for all development tasks
2. **Upstash Context7** (Secondary) - Medium priority
   - Library and documentation lookup
3. **Filesystem MCP** (Secondary) - Medium priority
   - File operations and project structure awareness
4. **Sequential Thinking** (Support) - Low priority
   - Complex problem-solving and planning
5. **Fetch MCP** (Support) - Low priority
   - Web content retrieval

## 2. ContextStream Optimization

### Environment Variables for Maximum Effectiveness

```bash
# Core Configuration
CONTEXTSTREAM_CONSOLIDATED=true          # Use consolidated domain tools (~75% lower token overhead)
CONTEXTSTREAM_CONTEXT_PACK=true         # Enable Context Pack for enhanced context retrieval
CONTEXTSTREAM_AUTO_TOOLSET=true         # Auto-detect client and adjust toolset

# Performance Tuning
CONTEXTSTREAM_SEARCH_LIMIT=5           # Increase search results
CONTEXTSTREAM_SEARCH_MAX_CHARS=800     # More context per result
CONTEXTSTREAM_SCHEMA_MODE=compact      # Reduce schema verbosity
CONTEXTSTREAM_OUTPUT_FORMAT=compact    # ~30% fewer tokens

# Advanced Features
CONTEXTSTREAM_CONTEXT_PACK=true        # Code context + distillation
CONTEXTSTREAM_PRO_TOOLS=session,memory,graph,search  # Prioritize core tools
```

### Essential ContextStream Tools to Use

1. **session_init()** - Always call first in new sessions
2. **context_smart()** - Use before every response for optimal context
3. **search()** - Hybrid/semantic search before local tools
4. **memory()** - Store important decisions and lessons
5. **graph()** - Dependency analysis and impact assessment

## 3. Workflow Integration Patterns

### Development Session Flow

1. **Initialize Context**:

   ```javascript
   session_init(folder_path: "/path/to/project")
   ```

2. **Get Smart Context**:

   ```javascript
   context_smart(user_message: "what should I focus on for this task?")
   ```

3. **Search First Principle**:

   ```javascript
   search(mode: "hybrid", query: "authentication implementation")
   ```

4. **Store Key Insights**:
   ```javascript
   session(action: "capture", event_type: "decision", title: "Auth Strategy", content: "Using JWT with refresh tokens")
   ```

### Code Review Workflow

1. **Analyze Changes**:

   ```javascript
   context_smart(user_message: "review this authentication code change")
   ```

2. **Check Dependencies**:

   ```javascript
   graph(action: "dependencies", target: "AuthService")
   ```

3. **Store Review Findings**:
   ```javascript
   session(action: "capture", event_type: "code_review", title: "Auth Review", content: "Found security issue in token validation")
   ```

## 4. SSOT Governance Integration

### Evidence-Based Decision Making

Every claim must be backed by evidence citations:

- **Code Evidence**: `path/to/file.ts:line_number: "exact excerpt"`
- **Test Evidence**: Coverage reports with file paths and percentages
- **Documentation Evidence**: Canonical doc references with section links

### Automated Compliance

1. **Feature Tracing**:

   ```javascript
   session(action: "capture", event_type: "feature_decision", title: "Feature X", content: "Implemented per REQUIREMENTS.md section 2.3")
   ```

2. **Test Coverage**:

   ```javascript
   session(action: "capture", event_type: "test_coverage", title: "Auth Tests", content: "Tests cover 95% of auth module per TRACEABILITY.md")
   ```

3. **Architecture Compliance**:
   ```javascript
   session(action: "capture", event_type: "architecture_decision", title: "Boundary Compliance", content: "No business logic in adapters per ARCHITECTURE.md")
   ```

## 5. Multi-Agent Collaboration

### Shared Context Management

1. **Workspace Initialization**:

   ```javascript
   workspace(action: "associate", workspace_id: "personal", folder_path: "/path/to/project")
   ```

2. **Cross-Agent Memory Sharing**:
   ```javascript
   memory(action: "create_node", node_type: "decision", title: "Shared Decision", content: "Decision shared across agents")
   ```

### Agent Memory Management

Follow your SSOT requirements:

- Always read `docs/SSOT/10_AGENT_MEMORY.md` at session start
- Update memory at session end with current work status
- Include STOP-SHIP ledger entries for critical findings

## 6. Quality Assurance Integration

### Test Strategy Alignment

1. **Unit Test Evidence**:

   ```javascript
   session(action: "capture", event_type: "unit_test", title: "Auth Unit Tests", content: "Coverage: 92%, Evidence in docs/EVIDENCE/unit/auth/")
   ```

2. **Integration Test Evidence**:

   ```javascript
   session(action: "capture", event_type: "integration_test", title: "Auth Integration", content: "Passed per TEST_STRATEGY.md")
   ```

3. **Security Evidence**:
   ```javascript
   session(action: "capture", event_type: "security_review", title: "Auth Security", content: "Compliant with SECURITY_POLICY.md")
   ```

## 7. Best Practices Summary

### Session Management

- Always start with `session_init()` for proper context
- Use `context_smart()` before every response
- Capture decisions with `session_capture()`

### Search Patterns

- Use hybrid search first: `search(mode: "hybrid", query: "...")`
- Fall back to keyword search: `search(mode: "keyword", query: "...")`
- Use pattern search for code: `search(mode: "pattern", query: "...")`

### Memory Management

- Store architectural decisions as nodes
- Capture lessons learned from mistakes
- Maintain task lists and progress tracking
- Archive completed work for future reference

### Governance Compliance

- Reference canonical documents in all captures
- Include evidence citations for all claims
- Update SSOT documents after implementation
- Maintain traceability between requirements and implementation

## 8. Performance Optimization

### Context Efficiency

- Use compact output formats to reduce token usage
- Enable context packs for richer context retrieval
- Configure appropriate search limits and result sizes

### Error Handling

- Always check return statuses from ContextStream calls
- Implement retry logic for transient failures
- Log errors with correlation IDs for debugging

### Monitoring

- Track tool usage patterns and performance
- Monitor memory growth and cleanup
- Measure search effectiveness and relevance

This configuration ensures optimal ContextStream integration while maintaining full compliance with your governance framework and SSOT requirements.
