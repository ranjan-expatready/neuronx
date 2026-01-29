# Safe Execution Runbook — How Agents Run Commands Safely

## Overview

This runbook defines the exact procedures agents must follow when executing commands. The goal is to prevent destructive actions, minimize cost, and ensure all operations are reversible or have clear rollback plans.

---

## PRE-EXECUTION CHECKLIST

### Before Running ANY Command

All agents MUST complete this checklist before executing any command:

```
[ ] 1. Verify command is on approved allowlist OR get human approval
[ ] 2. Confirm working directory is repository root
[ ] 3. Check for sensitive data in command (secrets, passwords, keys)
[ ] 4. Estimate cost and resource impact
[ ] 5. Consider if operation is reversible
[ ] 6. Have rollback plan if operation cannot be reversed
[ ] 7. Quote paths with spaces or special characters
[ ] 8. Validate command syntax before executing
```

---

## DRY-RUN VERIFICATION (REQUIRED)

### File Operations

Before any file write operation, MUST verify:

**For deletions**:
```bash
# WRONG: Direct deletion
rm -rf directory/

# RIGHT: Verify first
ls -la directory/
find directory/ -type f | wc -l  # Show affected file count
echo "Will delete $(find directory/ -type f | wc -l) files"
# Get confirmation, then execute
```

**For modifications**:
```bash
# RIGHT: Read file first, understand current state
cat path/to/file
# Then make changes with clear rationale
```

**For new files**:
```bash
# Verify target directory exists
ls -la target/directory
# Confirm parent directory exists and is writable
# Then create file
```

### Configuration Changes

Before modifying configuration:
```bash
# Read current config
cat config.json
# Document before state
# Make changes
# Validate syntax
```

### Dependency Changes

Before installing packages:
```bash
# Review package source
# Check for security advisories
# Verify version compatibility
# Only install with approval
```

---

## COMMAND SAFETY VALIDATION

### Step 1: Allowlist Check

First, check if the command is on the approved autonomous allowlist:

**Autonomous (No Approval Needed)**:
- File reading: `cat`, `less`, `head`, `tail`
- Directory listing: `ls`, `find` (without -delete or -exec)
- Git read operations: `git status`, `git log`, `git diff`, `git show`
- System info: `ps`, `top`, `df`, `du`, `date`
- List tools: `npm list`, `pip list`

**Not on Allowlist → Require Human Approval**:
- All file write operations within repo root (except documented commits)
- All `rm`, `mv`, `cp`, `mkdir` operations
- All package installations (including local)
- All docker operations beyond basic commands
- Any command with `sudo` prefix
- Any command accessing secrets/credentials

### Step 2: Risk Assessment

For commands not on allowlist, assess:

**Risk Factors**:
- Is this destructive? (deletes data)
- Is this reversible? (can we undo it?)
- Does this access secrets/credentials?
- Does this write outside repo root?
- Is this system-level modification?

**Risk Classification**:
- LOW RISK: Read-only, no side effects → Autonomous if documented
- MEDIUM RISK: Non-destructive, reversible → May require approval
- HIGH RISK: Destructive, irreversible, system-level → ALWAYS requires approval

### Step 3: Context Verification

Before execution:
```bash
# Always verify working directory
pwd
# Should output: /Users/ranjansingh/Desktop/autonomous-engineering-os
```

If working directory is not repository root, STOP and get approval.

### Step 4: Path Quoting

Always quote paths with spaces, parens, brackets:
```bash
# CORRECT:
cd "/Users/ranjansingh/My Documents"
git "/Users/project/(session)/routes"
ls "/path/with[brackets]/file.txt"

# INCORRECT (will fail):
cd /Users/ranjansingh/My Documents
git /Users/project/(session)/routes
ls /path/with[brackets]/file.txt
```

---

## ABSOLUTELY BLOCKED COMMANDS

These commands are NEVER permitted under any circumstances:

### Destructive Operations
```bash
rm -rf              # ABSOLUTELY BLOCKED
sudo rm             # ABSOLUTELY BLOCKED
mkfs                # ABSOLUTELY BLOCKED
dd                  # ABSOLUTELY BLOCKED
shred               # ABSOLUTELY BLOCKED
```

### System Modification (with sudo)
```bash
sudo apt *          # BLOCKED
sudo yum *          # BLOCKED
sudo brew *         # BLOCKED
sudo chown *        # BLOCKED
sudo chmod *        # BLOCKED
sudo service *      # BLOCKED
sudo systemctl *    # BLOCKED
```

### Secrets and Credentials
```bash
# ANY command that reads, writes, or manipulates secrets
cat ~/.env
cat ~/.ssh/id_rsa
echo $API_KEY
chmod 600 ~/.ssh/*
cat /etc/hosts
cat /etc/passwd
```

### Filesystem Writes Outside Repo Root
```bash
# Writing anywhere outside repo root requires approval:
touch /tmp/*
echo "content" > ~/config.json
cp file ~/Documents/
mkdir /var/log/*
cat /etc/environment
echo export X > ~/.bashrc
```

---

## EXECUTION PROCEDURE

### Standard Execution Flow

1. **Validate Command**
   - Check allowlist
   - Assess risk tier
   - Verify context

2. **Present Plan** (if approval needed)
   ```
   Proposed Operation: [command]
   Reason: [why needed]
   Risk: [LOW/MEDIUM/HIGH]
   Estimated Cost: $[amount]
   Reversible: [YES/NO]
   Rollback Plan: [if applicable]
   ```

3. **Execute**
   - Quote all paths
   - Set appropriate timeout
   - Monitor output

4. **Verify**
   - Check exit code
   - Verify expected result
   - Confirm no side effects

### Low-Risk Execution (Autonomous)

For commands on allowlist:
```bash
# Example: Read file content
cat src/main.py

# Verify output before proceeding with next step
# Document if any anomalies detected
```

### Medium-Risk Execution (Approval Required)

For non-destructive operations:
```bash
# Step 1: Present plan
"About to create new file: src/utils/config.py with database configuration settings.
Risk: MEDIUM (file creation)
Reversible: YES (delete file)
Estimated cost: $0 (no external calls)

Proceed?"

# Step 2: After approval, verify working directory
pwd

# Step 3: Execute with proper quoting
echo '{"database": {...}}' > "src/utils/config.py"

# Step 4: Verify result
cat src/utils/config.py
```

### High-Risk Execution (Approval Required + Verification)

For destructive or system operations:
```bash
# Step 1: Present detailed plan
"About to delete old logs in logs/ directory older than 30 days.
Affected files: 47 files, ~2.3GB total
Command: find logs/ -name '*.log' -mtime +30 -delete
Risk: HIGH (deletion)
Reversible: NO (no backup available)
Rollback plan: Restore from backup (last backup: 2 days ago)

Proceed with deletion?"

# Step 2: After approval, dry-run first
find logs/ -name '*.log' -mtime +30 -print | head -20
# Show first 20 files to be deleted

# Step 3: Execute with timeout and monitoring
timeout 300 find logs/ -name '*.log' -mtime +30 -delete

# Step 4: Verify success
find logs/ -name '*.log' | wc -l
# Confirms log count after deletion
```

---

## SPECIAL CASES

### Package Installations

```bash
# Step 1: Check if package already installed
npm list package-name
# or
pip show package-name

# Step 2: Review package information
# (Get approval from human)

# Step 3: Install with specific version
npm install package-name@version

# Step 4: Verify installation
npm list package-name
```

### Docker Operations

```bash
# Step 1: List existing containers/images
docker ps -a
docker images

# Step 2: Present plan
# "About to rebuild Docker image for service-X.
# Current image: service-X:1.2.3
# Estimated build time: 3-5 minutes
# Risk: MEDIUM
# Proceed?"

# Step 3: Build
docker build -t service-X:1.2.4 .

# Step 4: Verify
docker images | grep service-X
```

### Git Operations

```bash
# Read operations (autonomous)
git status
git log --oneline -5
git diff

# Write operations (medium risk)
git add file.py
git commit -m "message"
git push (requires approval)

# NEVER use force
git push --force  # BLOCKED
git reset --hard # BLOCKED (on shared branches)
```

---

## ERROR HANDLING

### When Command Fails

1. **Analyze the error**
   - Capture full error output
   - Check exit code
   - Review error message

2. **Determine cause**
   - Syntax error?
   - Permission issue?
   - Missing dependency?
   - Resource unavailable?

3. **Propose solution**
   - Fix identified issue
   - Suggest alternative approach
   - Request human guidance if stuck

4. **Never retry blindly**
   - Understand why it failed first
   - Fix underlying issue before retry

### Example Error Handling

```bash
# Command fails with permission error
npm install -g package
# Error: EACCES: permission denied

# WRONG: Retry with sudo
sudo npm install -g package  # BLOCKED

# RIGHT: Diagnose and suggest alternative
"I received a permission denied error when trying to install package globally.
This is due to npm trying to write to system directories without permissions.

Options:
1. Use npx to run without installing: npx package
2. Configure npm to use a user directory: npm config set prefix ~/.local
3. Use a virtual environment such as nvm or volta

Which approach would you prefer?"
```

---

## COST AWARENESS

### Before Expensive Operations

Check and report estimated cost:

```bash
"Estimated Cost Breakdown:
• Tokens: ~$0.15 (input: ~5K, output: ~2K)
• Infrastructure: ~$0.00 (no external services)
• Total: ~$0.15

Proceeding with task..."
```

### During Long-Running Operations

Monitor and report:

```bash
# Start operation
docker-compose up -d

# Report initial state
"Starting services...
- Database: Starting
- API: Starting
- Frontend: Starting

Services are starting, this may take 30-60 seconds..."

# Monitor state
docker-compose ps

# When complete
"All services started successfully.
- Database: Running (healthy)
- API: Running (healthy)
- Frontend: Running (healthy)"
```

---

## ROLLBACK PROCEDURES

### Reversible Operations (Document Rollback)

For operations that can be undone:

```bash
# Before operation: Record state
git rev-parse HEAD  # Save current commit

# Make changes
git add file.py
git commit -m "feature: add user authentication"

# Rollback if needed:
git reset --hard <saved-commit>
```

### Irreversible Operations (Backup First)

For operations that cannot be undone:

```bash
# Step 1: Create backup
cp config.json config.json.backup

# Step 2: Make changes
# [perform operation]

# Step 3: Verify changes
cat config.json

# Step 4: If rollback needed:
cp config.json.backup config.json
```

### Documentation Required

For all changes:
- Document what was changed
- Document how to reverse it
- Document side effects
- Save to relevant documentation file

---

## POST-EXECUTION VERIFICATION

### After Any Command

```bash
[ ] 1. Check exit code (non-zero = error)
[ ] 2. Review output for warnings
[ ] 3. Verify operation resulted in intended state
[ ] 4. Check for unexpected side effects
[ ] 5. Document outcome
[ ] 6. Clean up temporary files if any
```

### After Write Operations

```bash
[ ] 1. Confirm file was created/modified
[ ] 2. Verify content is correct
[ ] 3. Check file permissions
[ ] 4. Confirm no unintended modifications
```

### After Deletion Operations

```bash
[ ] 1. Confirm files were deleted
[ ] 2. Verify no important files were lost
[ ] 3. Check directory state
[ ] 4. Document what was deleted
```

---

## SECURITY CONSIDERATIONS

### Secrets and Data

**NEVER**:
- Echo secrets in output or logs
- Write secrets to files without encryption
- Pass secrets on command line (visible in process list)
- Store secrets in code or config files

**ALWAYS**:
- Use environment variables for secrets
- Reference secrets securely (don't echo them)
- Minimize secret exposure duration

### Input Validation

Before accepting input:
```bash
[ ] Verify input format
[ ] Sanitize special characters
[ ] Check for injection attempts
[ ] Validate against expected patterns
```

### Access Control

```bash
[ ] Verify file permissions before modification
[ ] Only modify files within repo root
[ ] Don't access user home directory without approval
[ ] Don't access system directories (/etc, /var, etc.)
```

---

## COMPLIANCE CHECKLIST (Mandatory for Every Task)

Before completing any task:

```bash
[ ] All commands validated against allowlist or approved
[ ] Cost estimate provided before execution (if >$5)
[ ] Working directory verified (repo root)
[ ] Paths properly quoted (spaces, special chars)
[ ] Sensitive data not exposed
[ ] Rollback plan available for non-reversible changes
[ ] Dry-run verification completed for file operations
[ ] No blocked commands executed
[ ] Post-execution verification completed
[ ] Changes documented
```

---

## ESCALATION PROCEDURES

### When to Escalate to Human

Escalate immediately when:

- Command not on allowlist and risk is HIGH
- Operation is irreversible without clear rollback
- Cost estimate exceeds thresholds
- Error occurs that cannot be diagnosed
- Operation access secrets/credentials
- File operation targets location outside repo root
- Unexpected behavior detected during execution

### Escalation Format

```
NEEDS HUMAN REVIEW

Task: [task description]
Issue: [what requires human input]
Current State: [where we are]
Options: [clear options with trade-offs]
Recommendation: [what to do and why]
```

---

## VERSION HISTORY

- v1.0 (Initial): Core safe execution procedures, blocked commands, escalation procedures
