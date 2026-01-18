# ContextStream Optimized Integration Demo

This script demonstrates the optimal ContextStream integration with your governance framework.

## Prerequisites

Ensure ContextStream is properly configured with the optimization settings from `CONTEXTSTREAM_OPTIMIZATION_GUIDE.md`.

## Demo Workflow

### 1. Session Initialization

```javascript
// Initialize session with project context
session_init(folder_path: "/Users/ranjansingh/Desktop/NeuronX")
```

Expected output: Session initialized with workspace association and project indexing.

### 2. Smart Context Retrieval

```javascript
// Get intelligent context for current task
context_smart(user_message: "Analyze the authentication system in this project")
```

Expected output: Context-aware response with relevant code sections and documentation.

### 3. Hybrid Search (Search-First Principle)

```javascript
// Search for authentication-related code and documentation
search(mode: "hybrid", query: "authentication implementation JWT")
```

Expected output: Relevant code snippets, documentation references, and architectural guidance.

### 4. Memory Capture (Governance Compliance)

```javascript
// Capture architectural decision for SSOT compliance
session(action: "capture",
        event_type: "architecture_decision",
        title: "Auth System Design",
        content: "Implemented JWT-based authentication per ARCHITECTURE.md section 3.2. Evidence in packages/adapters/ghl-auth/")
```

Expected output: Confirmation of memory capture with traceability reference.

### 5. Dependency Analysis

```javascript
// Analyze dependencies for impact assessment
graph(action: "dependencies", target: "AuthService")
```

Expected output: Dependency tree showing module relationships and potential impact areas.

### 6. Cross-Agent Memory Sharing

```javascript
// Share important findings across agents
memory(action: "create_node",
       node_type: "decision",
       title: "Shared Security Finding",
       content: "Identified potential CSRF vulnerability in auth flow. Referenced in docs/SECURITY/ findings.")
```

Expected output: Confirmation of shared memory node creation.

## Governance Compliance Demonstration

### Evidence-Based Claims

Every finding includes evidence citations:

- Code references with exact file paths and line numbers
- Test coverage verification with percentages
- Documentation links to canonical SSOT documents

### SSOT Integration

Demonstrates alignment with your governance framework:

- References to REQUIREMENTS.md for feature tracing
- TRACEABILITY.md updates for test coverage
- ARCHITECTURE.md compliance for boundary enforcement
- ENGINEERING_LOG.md updates for technical decisions

## Performance Optimization

### Context Efficiency

- Compact output formats reduce token consumption
- Context packs provide rich retrieval without bloat
- Appropriate search limits prevent information overload

### Error Handling

- Robust error checking with meaningful messages
- Retry logic for transient failures
- Correlation IDs for debugging complex issues

## Expected Benefits

1. **Enhanced Productivity**: Faster context retrieval and decision making
2. **Governance Compliance**: Automated evidence capture and traceability
3. **Quality Assurance**: Integrated testing and review workflows
4. **Collaboration**: Shared context across all development agents
5. **Performance**: Optimized token usage and response times

## Verification Steps

1. Check that ContextStream responds as primary intelligence layer
2. Verify evidence citations include proper file paths and line numbers
3. Confirm governance documents are referenced in memory captures
4. Test cross-agent memory sharing functionality
5. Validate performance optimization settings are active

This demo showcases how ContextStream serves as your project's intelligent memory layer while maintaining full compliance with your strict governance requirements.
