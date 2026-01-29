#!/bin/bash

echo "🔍 Continue YOLO Mode Diagnostic Tool"
echo "====================================="
echo ""

# 1. Check VS Code/Continue installation
echo "1. 🖥️  VS Code & Continue Status:"
echo "   - VS Code Version: $(code --version 2>/dev/null | head -1 || echo 'Not found')"
echo "   - Continue Extension: $(ls -la ~/Library/Application\\ Support/Code/User/globalStorage/ | grep continue | wc -l) directories found"
echo ""

# 2. Check configuration files
echo "2. 📁 Configuration Files:"
echo "   - ~/.continue/.continuerc.json: $([ -f ~/.continue/.continuerc.json ] && echo 'EXISTS' || echo 'MISSING')"
echo "   - ~/.continue/config.yaml: $([ -f ~/.continue/config.yaml ] && echo 'EXISTS' || echo 'MISSING')"
echo ""

# 3. Check .continuerc.json settings
echo "3. ⚙️  .continuerc.json Tool Settings:"
if [ -f ~/.continue/.continuerc.json ]; then
    echo "   allowExecute: $(jq -r '.allowExecute' ~/.continue/.continuerc.json 2>/dev/null || echo 'NOT SET')"
    echo "   confirmBeforeExecute: $(jq -r '.confirmBeforeExecute' ~/.continue/.continuerc.json 2>/dev/null || echo 'NOT SET')"
    echo "   enableYoloMode: $(jq -r '.enableYoloMode' ~/.continue/.continuerc.json 2>/dev/null || echo 'NOT SET')"
    echo "   toolApprovalPolicy: $(jq -r '.toolApprovalPolicy' ~/.continue/.continuerc.json 2>/dev/null || echo 'NOT SET')"
else
    echo "   ❌ File not found!"
fi
echo ""

# 4. Check for VS Code settings overrides
echo "4. 🔧 VS Code Settings Check:"
echo "   - User settings.json: $([ -f ~/Library/Application\\ Support/Code/User/settings.json ] && echo 'EXISTS' || echo 'NOT FOUND')"
echo "   - Workspace settings: $([ -f .vscode/settings.json ] && echo 'EXISTS' || echo 'NOT FOUND')"
echo ""

# 5. Check Continue processes
echo "5. 🚀 Running Processes:"
echo "   - Continue processes: $(ps aux | grep -i continue | grep -v grep | wc -l) running"
echo ""

# 6. Check Ollama status
echo "6. 🤖 Ollama Status:"
echo "   - Daemon running: $(curl -s http://localhost:11434/api/tags >/dev/null && echo '✅ YES' || echo '❌ NO')"
echo ""

# 7. Check for potential conflicts
echo "7. ⚠️  Potential Conflicts:"
echo "   - Multiple Continue configs: $(find ~ -name "*continue*" -name "config.*" 2>/dev/null | wc -l) configs found"
echo "   - Session overrides: $(ls ~/.continue/sessions/ 2>/dev/null | wc -l 2>/dev/null || echo '0') active sessions"
echo ""

echo "💡 RECOMMENDED FIXES:"
echo "======================"
echo ""
echo "1. 🔄 Complete VS Code Restart:"
echo "   Cmd+Q to quit VS Code completely, then reopen"
echo ""
echo "2. 🧹 Clear Continue Cache:"
echo "   rm -rf ~/Library/Application\\ Support/Code/User/globalStorage/continue.continue/*"
echo ""
echo "3. ⚙️  Force Tool Settings (in VS Code):"
echo "   - Cmd+Shift+P → 'Continue: Open Settings'"
echo "   - Navigate to Tool Policies"
echo "   - Set ALL tools to AUTOMATIC:"
echo "     * Write → AUTOMATIC"
echo "     * Edit → AUTOMATIC"
echo "     * Apply → AUTOMATIC"
echo "     * Terminal → AUTOMATIC"
echo ""
echo "4. 🔧 Backup & Recreate Config:"
echo "   cp ~/.continue/.continuerc.json ~/.continue/.continuerc.json.backup"
echo "   Then recreate with the correct settings shown above"
echo ""
echo "5. 🧪 Test with Simple Command:"
echo "   Ask Continue to run: 'echo hello world' - should execute without approval"
echo ""
echo "6. 📝 If still failing, check VS Code Developer Console:"
echo "   - Help → Toggle Developer Tools → Console tab"
echo "   - Look for Continue-related errors"