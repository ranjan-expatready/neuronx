# Continue Setup - NeuronX

## Overview

**Continue** = auditor/test-runner: Analyzes code, audits changes, proposes patches, generates evidence

**Cursor** = editor/PR owner: Handles all code editing, implementation, and pull request management

## Key Principles

- 🔍 **Auditor Role**: Continue analyzes, audits, and proposes changes but never modifies code
- ✏️ **Editor Role**: Cursor handles all code editing, PR creation, and implementation
- 📊 **Evidence-Based**: All findings backed by repo-verified citations
- 🛡️ **Governance**: Strict rules prevent unauthorized changes and ensure quality

## Model Configuration

This setup uses two Ollama Cloud models:

- **Fast Model**: For day-to-day analysis, quick audits, and routine checks
- **Deep Model**: For comprehensive audits, complex analysis, and thorough investigations

Update `.continue/config.yaml` with your actual Ollama Cloud endpoint and model names.

## Usage

### Interactive TUI Mode

Run Continue in terminal user interface for interactive sessions:

```bash
cn
```

This opens the Continue TUI where you can:

- Run predefined prompts (AUDIT, EVIDENCE-PACK, RECONCILE, etc.)
- Perform custom analysis
- Review findings interactively

### Headless YOLO Mode

Run Continue non-interactively with predefined prompts:

```bash
# Run a comprehensive audit
cn -p "AUDIT" --auto

# Generate evidence pack
cn -p "EVIDENCE-PACK" --auto

# Reconcile documentation drift
cn -p "RECONCILE" --auto

# Generate patch plan for specific issue
cn -p "PATCH-PLAN: Analyze security vulnerability in auth module" --auto

# Create test plan
cn -p "TEST-PLAN" --auto
```

### YOLO vs Headless Reality

#### Headless Mode (`--auto`)

- **Purpose**: For audits, analysis, and evidence generation
- **Example**: `cn -p "AUDIT" --auto` (no user interaction required)
- **Use Case**: CI/CD pipelines, automated evidence collection, compliance checks

#### Interactive Mode (TUI)

- **Purpose**: For tool calls requiring confirmation (writeFile/runTerminalCommand)
- **Example**: `cn` (opens interactive terminal UI)
- **Use Case**: Code changes, file modifications, system operations that need human approval

**Keep it concise**: Headless for analysis, interactive for implementation.

### Custom Prompts

Create custom analysis sessions:

```bash
cn -p "Analyze performance bottlenecks in the decision engine" --auto

cn -p "Review API contracts for compliance gaps" --auto
```

## Governance Rules

Continue enforces FAANG-grade standards:

- **Evidence Required**: Every finding must be repo-backed with citations
- **No Code Changes**: Continue only proposes changes, never implements them
- **Security First**: Sensitive data is automatically redacted
- **Minimal Patches**: Always prefers smallest safe fixes
- **Test Coverage**: Every recommendation includes regression tests

See `.continue/rules/FAANG_GOVERNANCE.md` for complete governance standards.

## Workflow Integration

### Development Workflow

1. **Cursor**: Write and edit code
2. **Continue**: Audit changes with `cn -p "AUDIT" --auto`
3. **Cursor**: Implement fixes based on Continue recommendations
4. **Continue**: Generate evidence pack for PR
5. **Cursor**: Create PR with Continue-generated evidence

### Audit Workflow

1. **Continue**: Run comprehensive audit: `cn -p "AUDIT" --auto`
2. **Continue**: Generate evidence pack: `cn -p "EVIDENCE-PACK" --auto`
3. **Continue**: Reconcile documentation: `cn -p "RECONCILE" --auto`
4. **Cursor**: Address findings based on evidence

### Security Review

1. **Continue**: Security-focused audit
2. **Continue**: Verify evidence with ripgrep commands
3. **Cursor**: Implement security fixes
4. **Continue**: Generate compliance evidence

## Configuration

### Environment Setup

1. Create `.continue/.env` file (this file is gitignored)
2. Copy contents from `.continue/env-example.txt`
3. Update with your actual Ollama Cloud API key:

   ```bash
   OLLAMA_API_KEY=your-actual-api-key-here
   ```

   **Where to get your API key:**
   - Visit https://ollama.com
   - Sign up for Ollama Cloud
   - Generate an API key from your account settings

   **Alternative setup methods:**
   - Add `OLLAMA_API_KEY=your-key` to your shell profile (`.bashrc`, `.zshrc`, etc.)
   - Set it as a system environment variable

4. **Restart Cursor/Continue** after setting the environment variable for it to take effect

### Health Check

Before using Continue, verify your setup:

```bash
cd .continue
node health-check.js
```

This will:

- ✅ Confirm OLLAMA_API_KEY is set
- 🔍 Test connectivity to Ollama Cloud API
- 📋 Verify available models
- 🔧 Help diagnose any configuration issues

### Model Configuration

The config is pre-configured with:

- **Fast Model**: `glm-4.7` for day-to-day coding chat and quick analysis
- **Deep Model**: `deepseek-v3.2:cloud` for comprehensive audits and complex analysis
- **Tab-Autocomplete**: `glm-4.7` (commented out by default)

### Customization

- Add custom prompts to `config.yaml`
- Modify governance rules in `rules/FAANG_GOVERNANCE.md`
- Configure additional models for specific use cases

## Integration Points

### With Existing Tools

- **Cursor Rules**: Continue respects `.cursor/rules/` governance
- **CI/CD**: Use headless mode in automated pipelines
- **PR Templates**: Include Continue evidence in PR descriptions
- **Documentation**: Continue validates against canonical docs

### With Development Process

- **Pre-commit**: Run quick audits before commits
- **Pre-merge**: Comprehensive evidence generation
- **Post-deployment**: Continuous monitoring audits
- **Incident Response**: Rapid evidence gathering for investigations

## Troubleshooting

### Common Issues

- **"Unauthorized" errors**: Run the health check script to verify API key and connectivity
- **Model Connection**: Use `node .continue/health-check.js` to test Ollama Cloud access
- **Environment Variables**: Restart Cursor after setting OLLAMA_API_KEY
- **Evidence Not Found**: Use `rg` commands manually to verify search patterns
- **Performance**: Switch between fast/deep models based on analysis complexity

### Debug Information

When Continue fails to connect, check:

- ✅ OLLAMA_API_KEY environment variable is set
- 🔍 API base URL is correct (currently: https://api.ollama.ai)
- 📡 Network connectivity to Ollama Cloud
- 🔑 API key validity (test with health check script)

### Getting Help

- Check governance rules in `rules/FAANG_GOVERNANCE.md`
- Review config examples in `config.yaml`
- Use interactive TUI mode for debugging: `cn`

## Security Notes

- Continue automatically redacts sensitive data
- API keys and secrets are never exposed in outputs
- All evidence is repo-backed and verifiable
- Changes are never applied automatically
