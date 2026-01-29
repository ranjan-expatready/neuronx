#!/usr/bin/env python3
"""
NeuronX Agent Runtime - Minimal Safe Scaffold (Phase 3B)

CLI entrypoint for orchestrated AI agent execution with ContextStream integration.

Usage:
    python main.py "Add unit tests for user service"
    python main.py --dry-run "Refactor authentication module"
    python main.py --use-contextstream "Analyze codebase patterns"
    python main.py --write-memory --memory-type pattern --memory-tags "testing,implementation" "Completed test implementation"
    python main.py --mcp-config mcp_config.json --mcp-call github list_issues '{"limit":5}' "List issues safely"
    python main.py --readiness  # Check readiness only
"""

import json
import sys
import os
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

# Add the agno directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

from policy import PolicyEngine, RiskTier
from roles import Planner, Implementer, Auditor
from evidence import EvidenceLogger
from toolrunner import SafeToolRunner
from contextstream import ContextStreamClient
from memory_schema import build_pattern_record, format_record_preview, MemoryValidationError
from memory_store import MemoryStore, format_memory_summary
from mcp_bridge import MCPBridge
from state_manager import StateManager
from readiness import collect_readiness
from mcp_selector import MCPSelector, format_suggestion_for_cli, AutoMCPDecision

# Governance files that must be updated for successful closure (Phase 5B.4)
GOVERNANCE_FILES = [
    "docs/ENGINEERING_LOG.md",
    "docs/PRODUCT_LOG.md",
    "docs/TRACEABILITY.md",
    "docs/SSOT/07_PROGRESS_LEDGER.md"
]

def check_governance_files_changed() -> bool:
    """Check if any governance files have been modified in git diff."""
    import subprocess
    import os
    
    # Get git diff --name-only for staged and unstaged changes
    try:
        # First check staged changes
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True,
            text=True,
            cwd=os.getcwd()
        )
        staged_files = result.stdout.strip().split('\n')
        
        # Also check unstaged changes
        result = subprocess.run(
            ["git", "diff", "--name-only"],
            capture_output=True,
            text=True,
            cwd=os.getcwd()
        )
        unstaged_files = result.stdout.strip().split('\n')
        
        all_changed_files = staged_files + unstaged_files
        
        # Check if any governance file appears in changed files
        for gov_file in GOVERNANCE_FILES:
            if gov_file in all_changed_files:
                return True
        
        return False
    except Exception:
        # If git command fails, assume no changes (fail-safe)
        return False

def validate_governance_closure(close_governance: Optional[str], result: str) -> tuple[bool, str, Optional[str]]:
    """
    Validate governance closure according to Phase 5B.4 rules.
    
    Args:
        close_governance: Value of --close-governance flag (None, "updated", or "na:<reason>")
        result: Task result ("success", "failure", "blocked")
        
    Returns:
        Tuple of (allowed, reason, suggested_files)
        allowed: Whether closure is satisfied
        reason: Human-readable reason
        suggested_files: List of suggested files to update (if applicable)
    """
    # Only enforce for success results
    if result != "success":
        return True, f"Governance closure not required for result: {result}", None
    
    # Parse closure flag
    if close_governance is None:
        # Missing closure flag - check if governance files changed automatically
        if check_governance_files_changed():
            # Auto-detected governance updates
            return True, "Governance files updated (auto-detected)", None
        else:
            # Block success - need explicit closure
            return False, "Missing governance closure flag", GOVERNANCE_FILES
    
    # Parse closure flag
    if close_governance == "updated":
        # User claims governance updated - verify
        if check_governance_files_changed():
            return True, "Governance files updated (verified)", None
        else:
            # User claimed updated but no changes detected
            return False, "Governance closure 'updated' claimed but no governance files changed", GOVERNANCE_FILES
    
    if close_governance.startswith("na:"):
        reason = close_governance[3:]
        if reason:
            return True, f"Governance not applicable: {reason}", None
        else:
            return False, "Governance closure 'na:' requires a reason", None
    
    # Invalid closure flag
    return False, f"Invalid governance closure flag: {close_governance}", GOVERNANCE_FILES

def get_git_diff_stat() -> Optional[str]:
    """Get git diff --stat output for audit verification."""
    import subprocess
    import os
    
    try:
        result = subprocess.run(
            ["git", "diff", "--stat"],
            capture_output=True,
            text=True,
            cwd=os.getcwd()
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        else:
            return None
    except Exception:
        return None

def validate_tdd_proof(tdd_proof: Optional[str], result: str, evidence: EvidenceLogger) -> tuple[bool, str, Dict[str, Any]]:
    """
    Validate TDD proof according to Phase 5D.2 rules.
    
    Args:
        tdd_proof: Value of --tdd-proof flag (None, "tests-first", "tests-added", or "na:<reason>")
        result: Task result ("success", "failure", "blocked")
        evidence: Evidence logger instance
        
    Returns:
        Tuple of (allowed, reason, details)
        allowed: Whether TDD proof is satisfied
        reason: Human-readable reason
        details: Dictionary with proof details (test_files_changed, test_commands_seen, etc.)
    """
    import subprocess
    import os
    import fnmatch
    from typing import Dict, Any, List
    
    # Helper function to get changed test files from git diff
    def get_changed_test_files() -> List[str]:
        """Return list of test files changed in git diff."""
        try:
            result = subprocess.run(
                ["git", "diff", "--name-only"],
                capture_output=True,
                text=True,
                cwd=os.getcwd()
            )
            if result.returncode != 0 or not result.stdout.strip():
                return []
            changed_files = result.stdout.strip().split('\n')
            # Patterns to match test files
            test_patterns = [
                "**/*.spec.ts",
                "**/*.test.ts", 
                "**/__tests__/**",
                "tests/**",
                "apps/**/__tests__/**"
            ]
            # Simple glob matching using fnmatch
            test_files = []
            for file in changed_files:
                for pattern in test_patterns:
                    if fnmatch.fnmatch(file, pattern):
                        test_files.append(file)
                        break
            return test_files
        except Exception:
            return []
    
    # Helper function to check evidence for test commands
    def check_test_commands_in_evidence(evidence_logger: EvidenceLogger) -> List[str]:
        """Check evidence events for test commands."""
        # For now, we'll return empty list
        # TODO: implement evidence check when test command logging is added
        return []
    
    # Only enforce for success results
    if result != "success":
        return True, f"TDD proof not required for result: {result}", {}
    
    # Parse proof flag
    if tdd_proof is None:
        # Missing proof flag - check if test files changed automatically
        test_files = get_changed_test_files()
        if test_files:
            # Auto-detected test updates
            return True, "Test files updated (auto-detected)", {"test_files_changed": test_files}
        else:
            # Block success - need explicit proof
            return False, "Missing TDD proof flag", {}
    
    # Parse proof flag
    if tdd_proof in ("tests-first", "tests-added"):
        # User claims test-first or test-added - verify
        test_files = get_changed_test_files()
        if not test_files:
            return False, f"TDD proof '{tdd_proof}' claimed but no test files changed", {}
        # Also check for test commands in evidence (optional)
        test_commands_seen = check_test_commands_in_evidence(evidence)
        # Success
        return True, f"TDD proof satisfied: {tdd_proof}", {
            "test_files_changed": test_files,
            "test_commands_seen": test_commands_seen
        }
    
    if tdd_proof.startswith("na:"):
        reason = tdd_proof[3:]
        if reason:
            return True, f"TDD not applicable: {reason}", {}
        else:
            return False, "TDD proof 'na:' requires a reason", {}
    
    # Invalid proof flag
    return False, f"Invalid TDD proof flag: {tdd_proof}", {}

def await_memory_storage_with_store(task: str, memory_type: str, memory_tags: List[str],
                                    contextstream: Optional[ContextStreamClient],
                                    evidence: EvidenceLogger) -> None:
    """
    Handle optional memory storage after successful task completion using MemoryStore.

    Args:
        task: Original task description
        memory_type: Type of memory to store
        memory_tags: Tags for the memory record
        contextstream: ContextStream client (if configured)
        evidence: Evidence logger
    """
    # Check evidence completeness before allowing memory storage
    if not evidence.current_session_id:
        print("❌ Memory write blocked: no active session")
        evidence.log_event("memory_storage_blocked", {"reason": "no_active_session"})
        return

    # Check for git diff evidence
    evidence_files = evidence.get_session_evidence_files(evidence.current_session_id)
    has_git_diff = any('git_diff' in f or 'planning_complete' in f for f in evidence_files)
    has_test_results = any('audit_complete' in f for f in evidence_files)

    if not has_git_diff:
        print("❌ Memory write blocked: insufficient evidence (missing git diff)")
        evidence.log_event("memory_storage_blocked", {"reason": "missing_git_diff_evidence"})
        return

    if not has_test_results:
        print("❌ Memory write blocked: insufficient evidence (missing test results)")
        evidence.log_event("memory_storage_blocked", {"reason": "missing_test_results_evidence"})
        return

    # Initialize MemoryStore
    memory_store = MemoryStore()
    
    # Check if memory directory is writable
    storage_status = memory_store.get_storage_status()
    if not storage_status['writable']:
        print("❌ Memory write blocked: memory directory not writable")
        evidence.log_event("memory_storage_blocked", {"reason": "memory_directory_not_writable"})
        return

    try:
        # Generate summary based on task
        summary = f"Successfully completed: {task[:100]}{'...' if len(task) > 100 else ''}"

        # Build sources (evidence files from this session)
        evidence_files = evidence.get_session_evidence_files(evidence.current_session_id or "")
        sources = [f"agent_runtime/evidence/{f}" for f in evidence_files[:5]]  # Limit to 5 sources

        # Build memory record
        memory_record = build_pattern_record(
            task=task,
            pattern=summary,
            sources=sources,
            tags=memory_tags or ["automation", "agent-runtime"]
        )

        # Show preview and ask for confirmation
        print("\n🧠 Memory Storage")
        print(format_record_preview(memory_record))
        print("\nStore this memory?")

        try:
            response = input("Type 'yes' to store, anything else to skip: ").strip().lower()
        except EOFError:
            response = 'yes'  # Auto-confirm in non-interactive mode
        
        if response == 'yes':
            # Prepare contextstream config for remote storage
            contextstream_config = None
            if contextstream and contextstream.is_configured:
                contextstream_config = {
                    'url': contextstream.url,
                    'api_key': contextstream.api_key
                }
            
            # Store using MemoryStore (local + optional remote)
            store_result = memory_store.store_memory(memory_record, contextstream_config)
            
            print("✅ Memory stored successfully")
            if store_result['local']['status'] == 'success':
                print(f"   Local: {store_result['local']['path']}")
            if store_result['remote']['status'] == 'success':
                print(f"   Remote: ContextStream")
            elif store_result['remote']['status'] == 'failure':
                print(f"   Remote: Failed (fallback to local only)")
                evidence.log_event("remote_store_error", {"error": store_result['remote']['error']})
            
            evidence.log_event("memory_storage_complete", {
                "memory_id": memory_record["id"],
                "memory_type": memory_type,
                "tags": memory_tags,
                "local_path": store_result['local']['path'],
                "remote_status": store_result['remote']['status']
            })
        else:
            print("⏭️  Memory storage skipped")
            evidence.log_event("memory_storage_cancelled", {"reason": "user_cancelled"})

    except Exception as e:
        print(f"⚠️  Memory storage failed: {e}")
        evidence.log_event("memory_storage_error", {"error": str(e)})

def await_repo_map_snapshot(task: str, write_memory: bool,
                           contextstream: Optional[ContextStreamClient],
                           evidence: EvidenceLogger) -> None:
    """
    Handle optional repository mapping snapshot.

    Args:
        task: Original task description
        write_memory: Whether memory writing is enabled
        contextstream: ContextStream client (if configured)
        evidence: Evidence logger
    """
    try:
        # Collect repository structure data
        repo_map = collect_repo_map_data()

        # Create mapping memory record
        mapping_summary = f"Repository structure mapping: {len(repo_map.get('directories', []))} directories, {len(repo_map.get('key_docs', {}))} key documents, {len(repo_map.get('package_scripts', {}))} package scripts"

        sources = [
            "AGENTS.md",
            "CONTRIBUTING.md",
            "docs/SSOT/index.md",
            ".github/CODEOWNERS",
            ".github/pull_request_template.md"
        ]

        mapping_record = build_pattern_record(
            task=task,
            summary=mapping_summary,
            sources=sources,
            tags=["repository", "mapping", "structure", "architecture"]
        )

        # Add the detailed repo map to the record
        mapping_record['repo_map'] = repo_map

        print("\n🗺️  Repository Map Snapshot")
        print(format_record_preview(mapping_record))

        # If ContextStream is configured and memory writing enabled, offer to store
        can_store_remotely = (contextstream and contextstream.is_configured and write_memory)

        if can_store_remotely:
            print("\nStore this repository mapping in ContextStream?")
            response = input("Type 'yes' to store remotely, 'local' to save locally, anything else to skip: ").strip().lower()

            if response == 'yes':
                contextstream.store(mapping_record)
                print("✅ Repository mapping stored in ContextStream")
                evidence.log_event("repo_map_stored_remotely", {
                    "mapping_id": mapping_record["id"],
                    "directories_count": len(repo_map.get('directories', [])),
                    "key_docs_count": len(repo_map.get('key_docs', {}))
                })
            elif response == 'local':
                save_repo_map_locally(mapping_record, evidence)
            # else: skip
        else:
            # Default to local storage
            if write_memory:
                print("\nContextStream not configured - saving repository mapping locally as evidence.")
            save_repo_map_locally(mapping_record, evidence)

    except Exception as e:
        print(f"⚠️  Repository map snapshot failed: {e}")
        evidence.log_event("repo_map_error", {"error": str(e)})

def collect_repo_map_data() -> Dict[str, Any]:
    """
    Collect repository structure and key document information.

    Returns:
        Dictionary containing repository mapping data
    """
    from pathlib import Path

    repo_data = {
        "directories": [],
        "key_docs": {},
        "package_scripts": {}
    }

    try:
        # Get top-level directories
        repo_root = Path(__file__).resolve().parent.parent.parent
        repo_data["directories"] = [d.name for d in repo_root.iterdir() if d.is_dir() and not d.name.startswith('.')]

        # Read key documents (with size limits)
        key_docs = [
            "AGENTS.md",
            "CONTRIBUTING.md",
            "docs/SSOT/index.md",
            ".github/CODEOWNERS",
            ".github/pull_request_template.md"
        ]

        for doc_path in key_docs:
            full_path = repo_root / doc_path
            if full_path.exists():
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Truncate very long files
                        if len(content) > 2000:
                            content = content[:2000] + "...[truncated]"
                        repo_data["key_docs"][doc_path] = content
                except Exception:
                    repo_data["key_docs"][doc_path] = "[Could not read file]"

        # Extract package.json scripts (if exists)
        package_json = repo_root / "package.json"
        if package_json.exists():
            try:
                import json
                with open(package_json, 'r', encoding='utf-8') as f:
                    package_data = json.load(f)
                    scripts = package_data.get('scripts', {})
                    # Only include scripts that are relevant to development
                    relevant_scripts = {k: v for k, v in scripts.items()
                                      if any(keyword in k.lower() for keyword in
                                             ['test', 'lint', 'build', 'typecheck', 'format'])}
                    repo_data["package_scripts"] = relevant_scripts
            except Exception:
                repo_data["package_scripts"] = {"error": "Could not parse package.json"}

    except Exception as e:
        repo_data["error"] = str(e)

    return repo_data

def save_repo_map_locally(mapping_record: Dict[str, Any], evidence: EvidenceLogger) -> None:
    """
    Save repository mapping to local evidence file.

    Args:
        mapping_record: The mapping record to save
        evidence: Evidence logger instance
    """
    # Save to evidence directory as JSON
    evidence_dir = Path(__file__).parent.parent / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_repo_map_snapshot.json"
    filepath = evidence_dir / filename

    try:
        import json
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(mapping_record, f, indent=2, ensure_ascii=False, default=str)

        print(f"💾 Repository mapping saved locally: agent_runtime/evidence/{filename}")
        evidence.log_event("repo_map_saved_locally", {
            "filename": filename,
            "filepath": str(filepath),
            "mapping_id": mapping_record.get("id")
        })

    except Exception as e:
        print(f"⚠️  Failed to save local repo map: {e}")
        evidence.log_event("repo_map_local_save_error", {"error": str(e)})


def _parse_mcp_params(raw_params: Optional[str]) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    if raw_params is None:
        return None, "Params JSON missing"
    try:
        parsed = json.loads(raw_params)
    except json.JSONDecodeError as exc:
        return None, f"Invalid MCP params JSON: {exc}"

    if not isinstance(parsed, dict):
        return None, "MCP params must be a JSON object"

    return parsed, None


def _summarize_data(data: Any) -> str:
    try:
        if isinstance(data, list):
            return f"list(len={len(data)})"
        if isinstance(data, dict):
            keys = list(data.keys())[:8]
            return f"dict(keys={keys})"
        serialized = json.dumps(data, default=str)
    except Exception:
        serialized = str(data)
    if len(serialized) > 400:
        return serialized[:400] + "...[truncated]"
    return serialized


def _handle_mcp_call(task: str, risk_tier: Optional[RiskTier], mcp_bridge: Optional[MCPBridge], evidence: EvidenceLogger,
                     provider: Optional[str], action: Optional[str], params_raw: Optional[str], 
                     state_manager: Optional[StateManager] = None) -> int:
    provider_name = (provider or "").lower()
    action_name = (action or "").strip()

    # Log session start for MCP-only path (early execution)
    session_config = {
        "task": task,
        "mcp_call": {
            "provider": provider_name,
            "action": action_name,
            "params_raw": params_raw,
        }
    }
    session_id = evidence.start_session(task, config=session_config)
    print(f"🤖 NeuronX Agent Runtime - Session {session_id}")
    print(f"Task: {task}")
    print("-" * 50)

    if not provider_name or not action_name:
        reason = "MCP call requires provider and action"
        print(f"❌ {reason}")
        evidence.log_event("mcp_call_blocked", {"reason": reason, "provider": provider_name, "action": action_name})
        evidence.log_mcp_call(provider_name, action_name, False, reason, {"reason": reason}, {})
        evidence.end_session("blocked", {"reason": reason})
        
        # Update state for blocked MCP call
        if state_manager:
            session_info = {
                "session_id": session_id,
                "task": task,
                "mode": "mcp-only",
                "result": "blocked",
                "features": {
                    "contextstream": {
                        "enabled": False,
                        "configured": False
                    },
                    "mcp": {
                        "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                        "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
                    },
                    "memory_write": {
                        "enabled": False
                    }
                }
            }
            state_manager.update_session_state(session_info)
            
        return 1

    if not mcp_bridge or not mcp_bridge.is_mcp_enabled():
        print("MCP disabled")
        evidence.log_event("mcp_call_blocked", {"reason": "mcp_disabled", "provider": provider_name, "action": action_name})
        evidence.log_mcp_call(provider_name, action_name, False, "mcp_disabled", {"reason": "mcp_disabled"}, {})
        evidence.end_session("blocked", {"reason": "mcp_disabled"})
        
        # Update state for blocked MCP call
        if state_manager:
            session_info = {
                "session_id": session_id,
                "task": task,
                "mode": "mcp-only",
                "result": "blocked",
                "features": {
                    "contextstream": {
                        "enabled": False,
                        "configured": False
                    },
                    "mcp": {
                        "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                        "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
                    },
                    "memory_write": {
                        "enabled": False
                    }
                }
            }
            state_manager.update_session_state(session_info)
            
        return 1

    # Check readiness status - block if RED
    readiness_result = collect_readiness(mcp_bridge, None, os.environ)
    if readiness_result["overall_status"] == "RED":
        reason = f"Readiness status is RED: cannot proceed with MCP call"
        print(f"❌ {reason}")
        evidence.log_event("mcp_call_blocked", {
            "reason": reason, 
            "provider": provider_name, 
            "action": action_name, 
            "readiness_status": "RED",
            "readiness_details": readiness_result
        })
        evidence.log_mcp_call(provider_name, action_name, False, reason, {
            "reason": reason, 
            "readiness_result": readiness_result
        }, {})
        evidence.end_session("blocked", {"reason": reason})
        
        # Update state for blocked MCP call
        if state_manager:
            session_info = {
                "session_id": session_id,
                "task": task,
                "mode": "mcp-only",
                "result": "blocked",
                "features": {
                    "contextstream": {
                        "enabled": False,
                        "configured": False
                    },
                    "mcp": {
                        "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                        "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
                    },
                    "memory_write": {
                        "enabled": False
                    }
                }
            }
            state_manager.update_session_state(session_info)
            
        return 1

    params, parse_error = _parse_mcp_params(params_raw)
    if parse_error:
        print(f"❌ MCP params error: {parse_error}")
        evidence.log_event("mcp_call_blocked", {
            "reason": parse_error,
            "provider": provider_name,
            "action": action_name,
        })
        evidence.log_mcp_call(provider_name, action_name, False, parse_error, {"reason": parse_error}, {})
        evidence.end_session("blocked", {"reason": parse_error})
        
        # Update state for blocked MCP call
        if state_manager:
            session_info = {
                "session_id": session_id,
                "task": task,
                "mode": "mcp-only",
                "result": "blocked",
                "features": {
                    "contextstream": {
                        "enabled": False,
                        "configured": False
                    },
                    "mcp": {
                        "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                        "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
                    },
                    "memory_write": {
                        "enabled": False
                    }
                }
            }
            state_manager.update_session_state(session_info)
            
        return 1

    # If risk_tier is None (early execution path), classify risk now
    if risk_tier is None:
        policy = PolicyEngine()
        risk_tier = policy.classify_risk(task)
        
        evidence.log_event("risk_classification", {
            "task": task,
            "risk_tier": risk_tier.value,
            "classification_reason": policy.get_classification_reason()
        })

    if risk_tier == RiskTier.RED:
        reason = "HITL required: RED tier MCP call blocked"
        print(f"❌ {reason}")
        evidence.log_mcp_call(provider_name, action_name, False, reason, {"risk_tier": risk_tier.value}, params)
        evidence.end_session("blocked", {"reason": reason})
        
        # Update state for blocked MCP call
        if state_manager:
            session_info = {
                "session_id": session_id,
                "task": task,
                "mode": "mcp-only",
                "result": "blocked",
                "features": {
                    "contextstream": {
                        "enabled": False,
                        "configured": False
                    },
                    "mcp": {
                        "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                        "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
                    },
                    "memory_write": {
                        "enabled": False
                    }
                }
            }
            state_manager.update_session_state(session_info)
            
        return 1

    if risk_tier == RiskTier.YELLOW:
        print("⚠️  YELLOW TIER: confirmation required for MCP call")
        resp = input("Type 'yes' to proceed, anything else to cancel: ").strip().lower()
        if resp != 'yes':
            reason = "User declined Yellow-tier MCP call"
            evidence.log_mcp_call(provider_name, action_name, False, reason, {"risk_tier": risk_tier.value}, params)
            evidence.end_session("blocked", {"reason": reason})
            
            # Update state for blocked MCP call
            if state_manager:
                session_info = {
                    "session_id": session_id,
                    "task": task,
                    "mode": "mcp-only",
                    "result": "blocked",
                    "features": {
                        "contextstream": {
                            "enabled": False,
                            "configured": False
                        },
                        "mcp": {
                            "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                            "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
                        },
                        "memory_write": {
                            "enabled": False
                        }
                    }
                }
                state_manager.update_session_state(session_info)
                
            return 1

    result = mcp_bridge.route_call(provider_name, action_name, params, risk_tier.value, role="PLANNER")
    ok = bool(result.get("ok"))
    error = result.get("error")
    meta = result.get("meta", {})

    evidence.log_mcp_call(provider_name, action_name, ok, error, meta, params)

    summary = _summarize_data(result.get("data")) if ok else None
    print(f"MCP call {provider_name}:{action_name} -> ok: {ok}")
    if ok:
        if summary:
            print(f"Data: {summary}")
    else:
        print(f"Error: {error or 'unknown error'}")

    evidence.end_session("completed" if ok else "failed", {
        "mcp_call": {
            "provider": provider_name,
            "action": action_name,
            "ok": ok,
            "error": error,
        }
    })
    
    # Update state for successful/failed MCP call
    if state_manager:
        session_info = {
            "session_id": session_id,
            "task": task,
            "mode": "mcp-only",
            "result": "success" if ok else "failure",
            "features": {
                "contextstream": {
                    "enabled": False,
                    "configured": False
                },
                "mcp": {
                    "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                    "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
                },
                "memory_write": {
                    "enabled": False
                }
            }
        }
        state_manager.update_session_state(session_info)
        
    return 0 if ok else 1

def suggest_mcp_tools(task: str, risk_tier, mcp_bridge) -> list:
    """
    Suggest MCP providers/actions for a given task.
    
    Args:
        task: Task description
        risk_tier: RiskTier enum
        mcp_bridge: MCPBridge instance (may be None)
        
    Returns:
        List of suggestion strings
    """
    suggestions = []
    
    # If MCP is not enabled or no bridge, no suggestions
    if not mcp_bridge or not mcp_bridge.is_mcp_enabled():
        return suggestions
    
    # Get enabled providers
    enabled_providers = mcp_bridge.get_enabled_providers()
    if not enabled_providers:
        return suggestions
    
    # Task keywords mapping to providers/actions
    task_lower = task.lower()
    
    # GitHub related tasks
    if "github" in task_lower or "issue" in task_lower or "pr" in task_lower or "pull request" in task_lower:
        if "github" in enabled_providers:
            allowed_actions = mcp_bridge.get_allowed_actions("github")
            if allowed_actions:
                suggestions.append("github:list_issues - List recent GitHub issues")
                suggestions.append("github:get_issue - Get specific issue details")
                suggestions.append("github:list_prs - List pull requests")
    
    # Browser automation tasks
    if "browser" in task_lower or "web" in task_lower or "page" in task_lower or "screenshot" in task_lower:
        if "playwright" in enabled_providers:
            allowed_actions = mcp_bridge.get_allowed_actions("playwright")
            if allowed_actions:
                suggestions.append("playwright:navigate - Navigate to a web page")
                suggestions.append("playwright:take_screenshot - Capture browser screenshot")
    
    # Security scanning tasks
    if "security" in task_lower or "scan" in task_lower or "vulnerability" in task_lower or "dependency" in task_lower:
        if "security" in enabled_providers:
            allowed_actions = mcp_bridge.get_allowed_actions("security")
            if allowed_actions:
                suggestions.append("security:scan_dependencies - Scan project dependencies")
                suggestions.append("security:scan_code - Perform code security scan")
    
    # Container tasks
    if "docker" in task_lower or "container" in task_lower or "image" in task_lower:
        if "docker" in enabled_providers:
            allowed_actions = mcp_bridge.get_allowed_actions("docker")
            if allowed_actions:
                suggestions.append("docker:list_images - List Docker images")
                suggestions.append("docker:build_image - Build a Docker image")
    
    # Add general suggestion if no specific matches
    if not suggestions and enabled_providers:
        suggestions.append(f"Consider using enabled providers: {', '.join(enabled_providers)}")
        suggestions.append("Check provider-specific actions with --mcp-config and readiness")
    
    # Limit suggestions to 5
    return suggestions[:5]

def handle_explain_command() -> int:
    """
    Handle --explain command: Provide deterministic explanation of the last session.
    
    Returns:
        Exit code (0 for success, 1 for error)
    """
    try:
        # Initialize evidence logger
        evidence = EvidenceLogger()
        state_manager = StateManager()
        
        # Start a session for evidence logging
        session_id = evidence.start_session("runtime_explain", {"mode": "explain"})
        
        # Load state to get last session
        state_data = state_manager.load_state()
        last_session = state_data.get("last_session", {})
        
        if not last_session:
            print("❌ No session history found in STATE.json")
            evidence.log_event("explain_error", {"reason": "no_session_history"})
            evidence.end_session("failed", {"error": "no_session_history"})
            return 1
        
        # Extract session ID from last session
        last_session_id = last_session.get("session_id")
        if not last_session_id:
            print("❌ No session ID found in last session")
            evidence.log_event("explain_error", {"reason": "no_session_id"})
            evidence.end_session("failed", {"error": "no_session_id"})
            return 1
        
        # Find evidence files for this session
        evidence_dir = Path(__file__).parent.parent / "evidence"
        session_pattern = f"*{last_session_id}_*.json"
        
        evidence_files = []
        if evidence_dir.exists():
            for evidence_file in evidence_dir.glob("*"):
                if evidence_file.is_file() and session_pattern in str(evidence_file):
                    evidence_files.append(evidence_file.name)
        
        # Extract key events from evidence files
        key_events = {}
        for evidence_file in evidence_files[:10]:  # Limit to 10 files
            try:
                with open(evidence_dir / evidence_file, 'r', encoding='utf-8') as f:
                    evidence_data = json.load(f)
                    event_type = evidence_data.get("event_type")
                    if event_type:
                        key_events[event_type] = evidence_data.get("event_data", {})
            except (IOError, json.JSONDecodeError):
                continue
        
        # Generate explanation
        print("📊 LAST SESSION EXPLANATION")
        print("=" * 60)
        print(f"Session ID: {last_session_id}")
        print(f"Task: {last_session.get('task', 'unknown')}")
        print(f"Mode: {last_session.get('mode', 'unknown')}")
        print(f"Result: {last_session.get('result', 'unknown')}")
        print()
        
        # Readiness summary
        readiness = last_session.get("features", {}).get("contextstream", {})
        print("📋 READINESS SUMMARY:")
        print(f"  ContextStream: {'Enabled' if readiness.get('enabled') else 'Disabled'}")
        print(f"  MCP: {'Enabled' if last_session.get('features', {}).get('mcp', {}).get('enabled') else 'Disabled'}")
        print(f"  Memory Write: {'Enabled' if last_session.get('features', {}).get('memory_write', {}).get('enabled') else 'Disabled'}")
        print()
        
        # Risk tier
        risk_classification = key_events.get("risk_classification", {})
        if risk_classification:
            print("🔍 RISK TIER:")
            print(f"  Tier: {risk_classification.get('risk_tier', 'unknown')}")
            print(f"  Reason: {risk_classification.get('classification_reason', 'unknown')}")
            print()
        
        # Governance closure
        task_close = key_events.get("task_close", {})
        if task_close:
            print("📝 GOVERNANCE CLOSURE:")
            print(f"  Status: {task_close.get('closure_status', 'unknown')}")
            print(f"  Reason: {task_close.get('closure_reason', 'unknown')}")
            print()
        
        # TDD proof
        tdd_proof_event = key_events.get("tdd_proof", {})
        if tdd_proof_event:
            print("🧪 TDD PROOF:")
            print(f"  Type: {tdd_proof_event.get('proof_type', 'unknown')}")
            print(f"  OK: {'Yes' if tdd_proof_event.get('ok') else 'No'}")
            print()
        
        # Tools/layers used
        print("🔧 TOOLS/LAYERS USED:")
        features = last_session.get("features", {})
        contextstream_feat = features.get("contextstream", {})
        mcp_feat = features.get("mcp", {})
        memory_write_feat = features.get("memory_write", {})
        
        print(f"  ContextStream: {contextstream_feat.get('enabled', False)}")
        print(f"  MCP (Providers: {', '.join(mcp_feat.get('providers', []))})")
        print(f"  Memory Write: {memory_write_feat.get('enabled', False)}")
        print()
        
        # Evidence file citations
        print("📚 EVIDENCE FILES CITED:")
        for i, evidence_file in enumerate(evidence_files[:5], 1):  # Show first 5
            print(f"  {i}. {evidence_file}")
        if len(evidence_files) > 5:
            print(f"  ... and {len(evidence_files) - 5} more")
        print()
        
        # Log evidence event
        evidence.log_event("runtime_explain", {
            "last_session_id": last_session_id,
            "last_session_task": last_session.get("task"),
            "last_session_mode": last_session.get("mode"),
            "last_session_result": last_session.get("result"),
            "evidence_files_count": len(evidence_files),
            "key_events_found": list(key_events.keys())
        })
        
        evidence.end_session("completed", {"summary": "Explanation generated successfully"})
        
        return 0
        
    except Exception as e:
        print(f"❌ Error generating explanation: {e}")
        return 1


def handle_mcp_inventory_command(mcp_config_path: Optional[str]) -> int:
    """
    Handle --mcp-inventory command: Show configured MCP providers/actions.
    
    Args:
        mcp_config_path: Path to MCP configuration file
        
    Returns:
        Exit code (0 for success, 1 for error)
    """
    try:
        # Initialize evidence logger
        evidence = EvidenceLogger()
        session_id = evidence.start_session("mcp_inventory", {"mode": "inventory"})
        
        if not mcp_config_path:
            print("❌ No MCP config provided")
            evidence.log_event("mcp_inventory_error", {"reason": "no_config_provided"})
            evidence.end_session("failed", {"error": "no_config_provided"})
            return 1
        
        # Load MCP bridge
        mcp_bridge = MCPBridge(mcp_config_path)
        
        if not mcp_bridge.is_loaded:
            print(f"❌ MCP configuration error: {', '.join(mcp_bridge.load_errors)}")
            evidence.log_event("mcp_inventory_error", {
                "reason": "config_load_failed",
                "errors": mcp_bridge.load_errors
            })
            evidence.end_session("failed", {"error": "config_load_failed"})
            return 1

        # Get inventory (contextstream not available in inventory-only mode)
        inventory = get_mcp_inventory(mcp_bridge, contextstream=None)

        # Print inventory
        print("📋 MCP INVENTORY")
        print("=" * 60)
        print(f"MCP Enabled: {inventory['mcp_enabled']}")
        print(f"Config Path: {mcp_config_path}")
        print()
        
        if inventory['providers']:
            print("📦 ENABLED PROVIDERS:")
            for provider in inventory['providers']:
                print(f"\nProvider: {provider['name']}")
                print(f"  Status: {provider['status']}")
                print(f"  Allowed Actions: {', '.join(provider['actions'])}")
                print(f"  Command: {provider['command']}")
                print(f"  Required Env Vars: {', '.join(provider['required_env_vars'])}")
        else:
            print("No enabled providers found")
        
        print()
        
        # Log evidence event
        evidence.log_event("mcp_inventory", {
            "mcp_enabled": inventory['mcp_enabled'],
            "providers_count": len(inventory['providers']),
            "provider_names": [p['name'] for p in inventory['providers']]
        })
        
        evidence.end_session("completed", {"summary": "MCP inventory displayed"})
        
        return 0
        
    except Exception as e:
        print(f"❌ Error generating MCP inventory: {e}")
        return 1


def handle_mcp_inventory_export_command(mcp_config_path: Optional[str], export_path: str) -> int:
    """
    Handle --mcp-inventory-export command: Export inventory as JSON.
    
    Args:
        mcp_config_path: Path to MCP configuration file
        export_path: Path to export JSON file
        
    Returns:
        Exit code (0 for success, 1 for error)
    """
    try:
        # Initialize evidence logger
        evidence = EvidenceLogger()
        session_id = evidence.start_session("mcp_inventory_export", {"mode": "inventory_export"})
        
        if not mcp_config_path:
            print("❌ No MCP config provided")
            evidence.log_event("mcp_inventory_export_error", {"reason": "no_config_provided"})
            evidence.end_session("failed", {"error": "no_config_provided"})
            return 1
        
        # Load MCP bridge
        mcp_bridge = MCPBridge(mcp_config_path)
        
        if not mcp_bridge.is_loaded:
            print(f"❌ MCP configuration error: {', '.join(mcp_bridge.load_errors)}")
            evidence.log_event("mcp_inventory_export_error", {
                "reason": "config_load_failed",
                "errors": mcp_bridge.load_errors
            })
            evidence.end_session("failed", {"error": "config_load_failed"})
            return 1

        # Get inventory (contextstream not available in export-only mode)
        inventory = get_mcp_inventory(mcp_bridge, contextstream=None)

        # Add metadata for export
        export_data = {
            "timestamp": datetime.now().isoformat(),
            "config_hash": hashlib.sha256(json.dumps(inventory, sort_keys=True).encode()).hexdigest(),
            "mcp_enabled": inventory['mcp_enabled'],
            "providers": inventory['providers']
        }
        
        # Ensure export directory exists
        export_dir = Path(export_path).parent
        if export_dir:
            export_dir.mkdir(parents=True, exist_ok=True)
        
        # Write to file
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ MCP inventory exported to: {export_path}")
        
        # Log evidence event
        evidence.log_event("mcp_inventory_export", {
            "export_path": export_path,
            "providers_count": len(inventory['providers']),
            "config_hash": export_data['config_hash']
        })
        
        evidence.end_session("completed", {"summary": "MCP inventory exported"})
        
        return 0
        
    except Exception as e:
        print(f"❌ Error exporting MCP inventory: {e}")
        return 1


def get_mcp_inventory(mcp_bridge: MCPBridge, contextstream: Optional[ContextStreamClient] = None) -> Dict[str, Any]:
    """
    Get MCP inventory data from bridge, including ContextStream status.

    Args:
        mcp_bridge: MCPBridge instance
        contextstream: Optional ContextStreamClient instance

    Returns:
        Dictionary with inventory data
    """
    inventory = {
        'mcp_enabled': mcp_bridge.is_mcp_enabled(),
        'providers': [],
        'contextstream': {
            'configured': False,
            'last_retrieval_status': {
                'attempted': False,
                'succeeded': False
            },
            'last_store_status': {
                'attempted': False,
                'succeeded': False
            }
        }
    }

    if inventory['mcp_enabled']:
        enabled_providers = mcp_bridge.get_enabled_providers()

        for provider_name in enabled_providers:
            allowed_actions = mcp_bridge.get_allowed_actions(provider_name)
            required_env_vars = mcp_bridge.get_required_env_vars(provider_name)

            # Get command (first element only for display)
            provider_config = mcp_bridge.config.get('providers', {}).get(provider_name, {})
            command = provider_config.get('command', [])[:1]  # First element only
            command_str = command[0] if command else "N/A"

            inventory['providers'].append({
                'name': provider_name,
                'status': 'enabled',
                'actions': allowed_actions,
                'command': command_str,
                'required_env_vars': required_env_vars
            })

    # Add ContextStream status (without secrets)
    if contextstream and contextstream.is_configured:
        inventory['contextstream']['configured'] = True
        inventory['contextstream']['last_retrieval_status'] = {
            'configured': contextstream.last_retrieval_status.get('configured', False),
            'attempted': contextstream.last_retrieval_status.get('attempted', False),
            'succeeded': contextstream.last_retrieval_status.get('succeeded', False)
            # ERROR: Intentionally NOT included to avoid exposing connection issues
        }

    return inventory


def main():
    """Main CLI entrypoint for agent runtime."""
    if len(sys.argv) < 2:
        print("Usage: python main.py \"<task description>\" [options]")
        print("Options:")
        print("  --dry-run                    Show plan without execution")
        print("  --use-contextstream          Enable ContextStream retrieval")
        print("  --write-memory               Enable memory storage after completion")
        print("  --memory-type TYPE           Memory type (decision/gotcha/pattern/incident/mapping)")
        print("  --memory-tags TAGS           Comma-separated memory tags")
        print("  --snapshot-repo-map          Create repository mapping snapshot")
        print("  --mcp-config FILE            Enable MCP integration with config file")
        print("  --mcp-call PROVIDER ACTION PARAMS_JSON  Execute a read-only MCP call")
        print("  --readiness                  Check readiness only")
        print("  --state                      Print current state summary")
        print("  --suggest-tools              Suggest MCP tools for a task")
        print("  --suggest-mcp TASK           Phase 5C: MCP auto-selection as suggestion-only tool planning (no execution)")
        print("  --toolplan TASK              Alias for --suggest-mcp")
        print("  --auto-mcp                   Enable autonomous MCP execution (GREEN tier only)")
        print("  --mcp-budget-calls N          Maximum MCP calls per session (default: 5)")
        print("  --mcp-budget-seconds N        Maximum execution time per session (default: 60)")
        print("  --close-governance TYPE      Phase 5B.4: Governance closure (updated|na:<reason>)")
        print("  --tdd-proof TYPE           Phase 5D.2: TDD proof (tests-first|tests-added|na:<reason>)")
        print("  --explain                    Phase 5E: Explain last session from evidence and STATE.json")
        print("  --mcp-inventory              Phase 5E: Show configured MCP providers/actions/commands")
        print("  --mcp-inventory-export PATH  Phase 5E: Export MCP inventory as JSON for UI display")
        print("\nExamples:")
        print("  python main.py \"Add unit tests for user service\"")
        print("  python main.py --use-contextstream \"Analyze codebase patterns\"")
        print("  python main.py --write-memory --memory-type pattern --memory-tags \"testing,refactor\" \"Completed implementation\"")
        print("  python main.py --snapshot-repo-map --write-memory \"Map repository structure\"")
        print("  python main.py --mcp-config mcp_config.json --mcp-call github list_issues '{\\\"limit\\\":5}' \"List issues safely\"")
        print("  python main.py --readiness")
        print("  python main.py --state")
        print("  python main.py --suggest-tools \"Analyze GitHub issues\"")
        print("  python main.py --suggest-mcp \"List open GitHub issues\"")
        print("  python main.py --explain")
        print("  python main.py --mcp-config mcp_config.json --mcp-inventory")
        print("  python main.py --mcp-config mcp_config.json --mcp-inventory-export .factory/ui/mcp_inventory.json")
        return 1

    # Parse arguments
    args = sys.argv[1:]
    task = None
    dry_run = False
    use_contextstream = False
    write_memory = False
    memory_type = "pattern"
    memory_tags = []
    snapshot_repo_map = False
    mcp_config = None
    mcp_call_provider = None
    mcp_call_action = None
    mcp_call_params_raw = None
    readiness_only = False
    state_only = False
    suggest_tools_only = False
    suggest_mcp_only = False
    toolplan_only = False
    auto_mcp = False
    auto_mcp_budget_calls = 5
    auto_mcp_budget_seconds = 60
    list_memories_limit = None
    close_governance = None
    tdd_proof = None
    explain_only = False
    mcp_inventory_only = False
    mcp_inventory_export_path = None

    i = 0
    while i < len(args):
        arg = args[i]
        if arg.startswith("--"):
            if arg == "--dry-run":
                dry_run = True
            elif arg == "--use-contextstream":
                use_contextstream = True
            elif arg == "--write-memory":
                write_memory = True
            elif arg == "--memory-type" and i + 1 < len(args):
                memory_type = args[i + 1]
                i += 1
            elif arg == "--memory-tags" and i + 1 < len(args):
                memory_tags = [tag.strip() for tag in args[i + 1].split(",")]
                i += 1
            elif arg == "--snapshot-repo-map":
                snapshot_repo_map = True
            elif arg == "--mcp-config" and i + 1 < len(args):
                mcp_config = args[i + 1]
                i += 1
            elif arg == "--mcp-call" and i + 3 < len(args):
                mcp_call_provider = args[i + 1]
                mcp_call_action = args[i + 2]
                mcp_call_params_raw = args[i + 3]
                i += 3
            elif arg == "--readiness":
                readiness_only = True
            elif arg == "--state":
                state_only = True
            elif arg == "--suggest-tools":
                suggest_tools_only = True
            elif arg == "--suggest-mcp":
                suggest_mcp_only = True
            elif arg == "--toolplan":
                toolplan_only = True
            elif arg == "--auto-mcp":
                auto_mcp = True
            elif arg == "--mcp-budget-calls" and i + 1 < len(args):
                auto_mcp_budget_calls = int(args[i + 1])
                i += 1
            elif arg == "--mcp-budget-seconds" and i + 1 < len(args):
                auto_mcp_budget_seconds = int(args[i + 1])
                i += 1
            elif arg == "--list-memories" and i + 1 < len(args):
                list_memories_limit = int(args[i + 1])
                i += 1
            elif arg == "--close-governance" and i + 1 < len(args):
                close_governance = args[i + 1]
                i += 1
            elif arg == "--tdd-proof" and i + 1 < len(args):
                tdd_proof = args[i + 1]
                i += 1
            elif arg == "--explain":
                explain_only = True
            elif arg == "--mcp-inventory":
                mcp_inventory_only = True
            elif arg == "--mcp-inventory-export" and i + 1 < len(args):
                mcp_inventory_export_path = args[i + 1]
                i += 1
        elif task is None:
            task = arg
        i += 1

    # Handle list-memories mode
    if list_memories_limit is not None:
        memory_store = MemoryStore()
        memories = memory_store.retrieve_memories(limit=list_memories_limit)
        
        print(f"📚 Last {len(memories)} Memories:")
        if memories:
            for i, memory in enumerate(memories, 1):
                print(f"\n{i}. {format_memory_summary(memory)}")
        else:
            print("\nNo memories found.")
        
        return 0
    
    # Handle explain mode
    if explain_only:
        return handle_explain_command()
    
    # Handle mcp-inventory mode
    if mcp_inventory_only:
        return handle_mcp_inventory_command(mcp_config)
    
    # Handle mcp-inventory-export mode
    if mcp_inventory_export_path:
        return handle_mcp_inventory_export_command(mcp_config, mcp_inventory_export_path)
    
    # Handle state-only mode
    if state_only:
        state_manager = StateManager()
        state_manager.print_current_state()
        return 0

    # Handle suggest-tools mode
    if suggest_tools_only:
        if not task:
            print("❌ Error: --suggest-tools requires a task description")
            return 1
        
        # Initialize components
        policy = PolicyEngine()
        risk_tier = policy.classify_risk(task)
        
        # Initialize MCP bridge if config provided
        mcp_bridge = None
        if mcp_config:
            mcp_bridge = MCPBridge(mcp_config)
        
        # Get suggestions
        suggestions = suggest_mcp_tools(task, risk_tier, mcp_bridge)
        
        # Print suggestions
        print("🔧 MCP Tool Suggestions")
        print(f"Task: {task}")
        print(f"Risk Tier: {risk_tier.value}")
        print(f"MCP Enabled: {mcp_bridge.is_mcp_enabled() if mcp_bridge else False}")
        
        if suggestions:
            print("\nSuggested MCP providers/actions:")
            for suggestion in suggestions:
                print(f"  • {suggestion}")
        else:
            print("\nNo MCP tools suggested for this task.")
            print("  - Consider local tools first")
            print("  - Or check MCP configuration")
        
        return 0

    # Handle suggest-mcp/toolplan mode (Phase 5C)
    if suggest_mcp_only or toolplan_only:
        if not task:
            print("❌ Error: --suggest-mcp/--toolplan requires a task description")
            return 1
        
        # Initialize evidence logger for suggestion evidence
        evidence = EvidenceLogger()
        state_manager = StateManager()
        
        # Start a session for evidence logging
        session_id = evidence.start_session("mcp_suggestion", {"mode": "suggest", "task": task})
        

        
        # Initialize MCP bridge if config provided
        mcp_bridge = None
        if mcp_config:
            mcp_bridge = MCPBridge(mcp_config)
        
        # Get readiness status
        readiness_result = collect_readiness(mcp_bridge, None, os.environ)
        readiness_status = readiness_result["overall_status"]
        
        # Task lifecycle: task_start event (Phase 5B.4)
        evidence.log_event("task_start", {
            "session_id": session_id,
            "task": task,
            "mode": "suggest",
            "features": {
                "contextstream": {
                    "enabled": False,
                    "configured": False
                },
                "mcp": {
                    "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                    "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
                },
                "memory_write": {
                    "enabled": False
                }
            },
            "readiness_summary": {
                "overall_status": readiness_status,
                "missing_env_count": len(readiness_result["missing_env"])
            },
            "close_governance": close_governance
        })
        
        # Initialize MCP selector
        selector = MCPSelector(mcp_bridge)
        suggestion = selector.suggest(task, readiness_status)
        
        # Format and print suggestion
        print(format_suggestion_for_cli(suggestion))
        
        # Log evidence event
        evidence.log_event("mcp_suggestion", {
            "task": task,
            "risk_tier": suggestion.risk_tier.value,
            "mcp_appropriate": suggestion.mcp_appropriate.value,
            "mcp_config_provided": suggestion.mcp_config_provided,
            "mcp_enabled": suggestion.mcp_enabled,
            "readiness_status": readiness_status,
            "provider_suggestions_count": len(suggestion.provider_suggestions),
            "general_recommendation": suggestion.general_recommendation[:200] if suggestion.general_recommendation else ""
        })
        
        # Update STATE.json with last_session.mode = "suggest" and result = "success" (unless blocked by Red-tier)
        result = "success"
        if suggestion.risk_tier == RiskTier.RED:
            result = "blocked_red_tier"
        
        session_info = {
            "session_id": session_id,
            "task": task,
            "mode": "suggest",
            "result": result,
            "features": {
                "contextstream": {
                    "enabled": False,
                    "configured": False
                },
                "mcp": {
                    "enabled": suggestion.mcp_enabled,
                    "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
                },
                "memory_write": {
                    "enabled": False
                }
            }
        }
        state_manager.update_session_state(session_info)
        
        # End evidence session
        evidence.end_session(result, {"suggestion_summary": suggestion.general_recommendation[:100]})
        
        return 0

    # Handle autonomous MCP execution mode (Phase 5F)
    if auto_mcp:
        if not task:
            print("❌ Error: --auto-mcp requires a task description")
            return 1
            
        # Initialize evidence logger and state manager
        evidence = EvidenceLogger()
        state_manager = StateManager()
        
        # Start a session for evidence logging
        session_id = evidence.start_session("auto_mcp_execution", {"mode": "auto_mcp", "task": task})
        print(f"🤖 NeuronX Agent Runtime - Session {session_id}")
        print(f"Task: {task}")
        print("-" * 50)
        
        # Check kill switch (environment variable)
        if os.environ.get("NEURONX_AUTO_MCP_ENABLED", "true").lower() == "false":
            reason = "AUTO-MCP DISABLED: Kill switch active via NEURONX_AUTO_MCP_ENABLED=false"
            print(f"💥 {reason}")
            print("   Recommendation: Set NEURONX_AUTO_MCP_ENABLED=true or remove environment variable")
            evidence.log_event("auto_mcp_failure:kill_switch_active", {
                "reason": reason,
                "kill_switch": "environment_variable",
                "env_value": "NEURONX_AUTO_MCP_ENABLED=false"
            })
            evidence.end_session("blocked", {"reason": reason})
            return 1
            
        # Initialize MCP bridge if config provided
        mcp_bridge = None
        if mcp_config:
            mcp_bridge = MCPBridge(mcp_config)
            if not mcp_bridge.is_loaded:
                print(f"❌ MCP configuration error: {', '.join(mcp_bridge.load_errors)}")
                evidence.log_event("auto_mcp_failure:mcp_config_error", {
                    "errors": mcp_bridge.load_errors
                })
                evidence.end_session("failed", {"reason": "MCP configuration error"})
                return 1
        else:
            print("❌ AUTO-MCP requires --mcp-config <file>")
            evidence.log_event("auto_mcp_failure:no_config", {
                "reason": "No MCP config provided"
            })
            evidence.end_session("failed", {"reason": "No MCP config provided"})
            return 1
            
        # Collect readiness status
        readiness_result = collect_readiness(mcp_bridge, None, os.environ)
        readiness_status = readiness_result["overall_status"]
        
        # Check readiness RED status
        if readiness_status == "RED":
            reason = "AUTO-MCP BLOCKED: Readiness RED prevents autonomous execution"
            print(f"❌ {reason}")
            print("   Readiness Details:")
            for check in readiness_result["checks"]:
                if check["status"] == "RED":
                    print(f"   - {check['name']}: {check['status']} ({check['detail']})")
            print("   Recommended: Fix readiness issues or use --mcp-call with human approval")
            evidence.log_event("auto_mcp_failure:block_unsafe", {
                "reason": reason,
                "readiness_result": readiness_result
            })
            evidence.end_session("blocked", {"reason": reason})
            return 1
            
        # Initialize MCP selector
        mcp_selector = MCPSelector(mcp_bridge)
        
        # Make autonomous MCP execution decision
        decision = mcp_selector.execute_auto_mcp_decision(task, readiness_status, mcp_bridge)
        
        # Log the decision
        evidence.log_event("auto_mcp_execution_decision", {
            "decision": decision.decision,
            "reasoning": decision.reasoning,
            "budget_required": decision.budget_required
        })
        
        # Handle the decision
        if decision.decision == "block_unsafe":
            print(f"❌ {decision.reasoning['reason']}")
            if "risk_tier" in decision.reasoning and decision.reasoning["risk_tier"] in ["YELLOW", "RED"]:
                print("   Risk Keywords:", decision.reasoning.get("risk_reason", ""))
                print("   Recommendation: Use explicit --mcp-call with human approval, or refactor task to GREEN tier")
            evidence.end_session("blocked", decision.reasoning)
            return 1
            
        elif decision.decision == "block_safe":
            print(f"⚠️  AUTO-MCP BLOCKED: {decision.reasoning['reason']}")
            evidence.end_session("blocked", decision.reasoning)
            return 1
            
        elif decision.decision == "use_local_tools":
            print("ℹ️  AUTO-MCP SUGGESTION: Local tools available")
            local_tool = decision.reasoning.get("local_tool_name", "appropriate local tool")
            print(f"   Recommendation: Use {local_tool} instead of MCP for this task")
            evidence.end_session("local_tool_suggested", decision.reasoning)
            return 0
            
        elif decision.decision == "execute_mcp":
            # Check budget requirements
            if auto_mcp_budget_calls < decision.budget_required["calls"]:
                reason = f"BUDGET EXHAUSTED: Need {decision.budget_required['calls']} calls, only {auto_mcp_budget_calls} available"
                print(f"⏰ {reason}")
                print("   Recommendation: Increase --mcp-budget-calls or use --mcp-call for remaining actions")
                evidence.log_event("auto_mcp_budget_exhausted", {
                    "reason": reason,
                    "budget_required": decision.budget_required,
                    "budget_available": {"calls": auto_mcp_budget_calls, "seconds": auto_mcp_budget_seconds}
                })
                evidence.end_session("partial", {"reason": reason})
                return 1
                
            # Show execution details
            provider, action = decision.provider_action
            print(f"✅ GREEN TIER: Autonomous MCP execution allowed")
            print(f"ℹ️  Readiness: {readiness_status}")
            print(f"📊 Decision: EXECUTE_MCP")
            print("   Reasoning:")
            print(f"   - Risk tier: {decision.reasoning['risk_tier']} ({decision.reasoning['risk_reason']})")
            print(f"   - Readiness: {readiness_status}")
            print(f"   - MCP appropriate: Yes ({decision.reasoning['mcp_appropriate_reason']})")
            print(f"   - Provider selected: {provider}")
            print(f"   - Action selected: {action}")
            print(f"   - Allowlisted: Yes")
            if decision.reasoning.get("local_tools_available"):
                print(f"   - Local tools: Available ({decision.reasoning.get('local_tool_name', 'local tool')})")
            else:
                print("   - Local tools: Not available")
            print(f"   - Budget: {auto_mcp_budget_calls} calls, {auto_mcp_budget_seconds} seconds remaining")
            
            # Execute the MCP call
            print(f"🚀 Executing MCP: {provider}:{action}")
            result = mcp_bridge.route_call(provider, action, decision.params, "GREEN", role="PLANNER")
            ok = bool(result.get("ok"))
            error = result.get("error")
            meta = result.get("meta", {})
            
            # Log the MCP call
            evidence.log_mcp_call(provider, action, ok, error, meta, decision.params)
            
            if ok:
                summary = _summarize_data(result.get("data")) if result.get("data") else None
                print(f"✅ MCP call {provider}:{action} -> ok: {ok}")
                if summary:
                    print(f"   Data: {summary}")
                evidence.end_session("completed", {
                    "auto_mcp_calls_executed": 1,
                    "auto_mcp_failures": 0,
                    "mcp_call_result": {"provider": provider, "action": action, "ok": ok}
                })
                return 0
            else:
                print(f"❌ MCP call {provider}:{action} -> ok: {ok}")
                print(f"   Error: {error or 'unknown error'}")
                print("💥 AUTO-MCP FAILURE: Network error")
                print("   Recommendation: Check environment variables or network connectivity")
                if decision.reasoning.get("local_tools_available"):
                    print(f"   Fallback: Use {decision.reasoning.get('local_tool_name', 'local tool')} instead")
                else:
                    print("   Fallback: No local tool available")
                evidence.end_session("failed", {
                    "reason": "MCP call failed",
                    "mcp_call_result": {"provider": provider, "action": action, "ok": ok, "error": error}
                })
                return 1

    # Handle readiness-only mode
    if readiness_only:
        # Initialize components for readiness check
        evidence = EvidenceLogger()
        state_manager = StateManager()
        
        # Start a session for evidence logging
        session_id = evidence.start_session("readiness_check", {"mode": "readiness_only"})
        
        # Initialize ContextStream client if needed
        contextstream = ContextStreamClient() if use_contextstream or mcp_config else None

        # Initialize MCP bridge if config provided
        mcp_bridge = None
        if mcp_config:
            mcp_bridge = MCPBridge(mcp_config)

            # Auto-export MCP inventory for UI mirroring
            inventory_export_path = ".factory/ui/mcp_inventory.json"
            try:
                inventory = get_mcp_inventory(mcp_bridge, contextstream)
                export_data = {
                    "timestamp": datetime.now().isoformat(),
                    "config_hash": hashlib.sha256(json.dumps(inventory, sort_keys=True).encode()).hexdigest(),
                    "mcp_enabled": inventory['mcp_enabled'],
                    "providers": inventory['providers'],
                    "contextstream": inventory['contextstream']
                }
                Path(inventory_export_path).parent.mkdir(parents=True, exist_ok=True)
                with open(inventory_export_path, 'w', encoding='utf-8') as f:
                    json.dump(export_data, f, indent=2)
                print(f"📊 MCP inventory auto-exported to: {inventory_export_path}\n")
            except Exception as e:
                print(f"⚠️  MCP inventory auto-export failed: {e}\n")

        # Run readiness check
        readiness_result = collect_readiness(mcp_bridge, contextstream, os.environ)
        
        # Log evidence
        evidence.log_event("readiness_check", readiness_result)
        evidence.end_session("completed", {"readiness_result": readiness_result})
        
        # Update STATE.json
        state_data = state_manager.load_state()
        state_data["readiness"] = {
            "last_check": readiness_result["timestamp"],
            "overall_status": readiness_result["overall_status"],
            "missing_env_count": len(readiness_result["missing_env"])
        }
        state_data["last_updated"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        state_manager._write_state(state_data)
        
        # Print results
        print(f"Readiness Check Results:")
        print(f"Overall Status: {readiness_result['overall_status']}")
        print(f"Checks Performed: {len(readiness_result['checks'])}")
        print(f"Missing Environment Variables: {len(readiness_result['missing_env'])}")
        if readiness_result['missing_env']:
            print(f"Missing Env Vars: {', '.join(readiness_result['missing_env'])}")
        
        print("\nDetailed Checks:")
        for check in readiness_result['checks']:
            status_icon = "✅" if check['status'] == 'GREEN' else "⚠️" if check['status'] == 'YELLOW' else "❌"
            print(f"  {status_icon} {check['name']}: {check['detail']}")
            if check['remediation']:
                print(f"     Remediation: {check['remediation']}")
                
        # Exit with appropriate code
        if readiness_result['overall_status'] in ['GREEN', 'YELLOW']:
            return 0
        else:
            return 1
    
    if not task and not readiness_only:
        print("❌ Error: No task description provided")
        return 1

    # Initialize state manager
    state_manager = StateManager()
    state_manager.print_current_state()

    # Initialize evidence logger first for all paths
    evidence = EvidenceLogger()
    
    # Run readiness check automatically at startup when certain flags are used
    if mcp_config or use_contextstream or write_memory:
        # Start a session for evidence logging
        evidence.start_session("readiness_check_auto", {"mode": "auto", "mcp_config": bool(mcp_config), "use_contextstream": use_contextstream, "write_memory": write_memory})
        
        # Initialize ContextStream client if needed
        contextstream_client = ContextStreamClient() if use_contextstream else None
        
        # Initialize MCP bridge if config provided
        mcp_bridge_startup = None
        if mcp_config:
            mcp_bridge_startup = MCPBridge(mcp_config)
            
        # Run readiness check
        readiness_result = collect_readiness(mcp_bridge_startup, contextstream_client, os.environ)
        
        # Log evidence
        evidence.log_event("readiness_check_auto", readiness_result)
        evidence.end_session("completed", {"readiness_result": readiness_result})
        
        # Update STATE.json
        state_data = state_manager.load_state()
        state_data["readiness"] = {
            "last_check": readiness_result["timestamp"],
            "overall_status": readiness_result["overall_status"],
            "missing_env_count": len(readiness_result["missing_env"])
        }
        state_data["last_updated"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        state_manager._write_state(state_data)
        
        # Print results if not GREEN
        if readiness_result['overall_status'] != 'GREEN':
            print(f"\n⚠️  Readiness Check Results:")
            print(f"Overall Status: {readiness_result['overall_status']}")
            for check in readiness_result['checks']:
                status_icon = "✅" if check['status'] == 'GREEN' else "⚠️" if check['status'] == 'YELLOW' else "❌"
                print(f"  {status_icon} {check['name']}: {check['detail']}")
                if check['remediation']:
                    print(f"     Remediation: {check['remediation']}")

    # Early MCP-only execution path
    if mcp_call_provider:
        # Initialize MCP bridge with validation
        mcp_bridge = None
        if mcp_config:
            mcp_bridge = MCPBridge(mcp_config)
            if not mcp_bridge.is_loaded:
                print(f"❌ MCP configuration error: {', '.join(mcp_bridge.load_errors)}")
                return 1
        
        return _handle_mcp_call(
            task=task,
            risk_tier=None,  # Will be determined in _handle_mcp_call
            mcp_bridge=mcp_bridge,
            evidence=evidence,
            provider=mcp_call_provider,
            action=mcp_call_action,
            params_raw=mcp_call_params_raw,
            state_manager=state_manager,
        )

    # Initialize components for normal execution path
    policy = PolicyEngine()
    planner = Planner()
    implementer = Implementer()
    auditor = Auditor()
    tools = SafeToolRunner()
    contextstream = ContextStreamClient() if use_contextstream else None

    # Initialize MCP bridge with validation
    mcp_bridge = None
    if mcp_config:
        mcp_bridge = MCPBridge(mcp_config)
        if not mcp_bridge.is_loaded:
            print(f"❌ MCP configuration error: {', '.join(mcp_bridge.load_errors)}")
            return 1

        # Auto-export MCP inventory for UI mirroring
        inventory_export_path = ".factory/ui/mcp_inventory.json"
        try:
            inventory = get_mcp_inventory(mcp_bridge, contextstream)
            export_data = {
                "timestamp": datetime.now().isoformat(),
                "config_hash": hashlib.sha256(json.dumps(inventory, sort_keys=True).encode()).hexdigest(),
                "mcp_enabled": inventory['mcp_enabled'],
                "providers": inventory['providers'],
                "contextstream": inventory['contextstream']
            }
            Path(inventory_export_path).parent.mkdir(parents=True, exist_ok=True)
            with open(inventory_export_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2)
            print(f"📊 MCP inventory auto-exported to: {inventory_export_path}")
        except Exception as e:
            print(f"⚠️  MCP inventory auto-export failed: {e}")

    # Log session start with ContextStream and MCP status
    session_config = {
        "task": task,
        "dry_run": dry_run,
        "use_contextstream": use_contextstream,
        "contextstream_configured": contextstream.is_configured if contextstream else False,
        "write_memory": write_memory,
        "memory_type": memory_type if write_memory else None,
        "memory_tags": memory_tags if write_memory else [],
        "mcp_config": mcp_config,
        "mcp_enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
        "mcp_providers_enabled": mcp_bridge.get_enabled_providers() if mcp_bridge else [],
        "mcp_call": {
            "provider": mcp_call_provider,
            "action": mcp_call_action,
            "params_raw": mcp_call_params_raw,
        }
    }
    session_id = evidence.start_session(task, config=session_config)

    # Task lifecycle: task_start event (Phase 5B.4)
    readiness_result = collect_readiness(mcp_bridge, contextstream, os.environ)
    evidence.log_event("task_start", {
        "session_id": session_id,
        "task": task,
        "mode": "mcp-only" if mcp_call_provider else "normal",
        "features": {
            "contextstream": {
                "enabled": use_contextstream,
                "configured": contextstream.is_configured if contextstream else False
            },
            "mcp": {
                "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                "providers": mcp_bridge.get_enabled_providers() if mcp_bridge and mcp_bridge.is_mcp_enabled() else []
            },
            "memory_write": {
                "enabled": write_memory
            }
        },
        "readiness_summary": {
            "overall_status": readiness_result["overall_status"],
            "missing_env_count": len(readiness_result["missing_env"])
        },
        "close_governance": close_governance
    })

    try:
        print(f"🤖 NeuronX Agent Runtime - Session {session_id}")
        print(f"Task: {task}")
        print(f"ContextStream: {'Enabled' if use_contextstream else 'Disabled'}")
        print(f"Memory Storage: {'Enabled' if write_memory else 'Disabled'}")
        if mcp_bridge and mcp_bridge.is_mcp_enabled():
            enabled_providers = mcp_bridge.get_enabled_providers()
            print(f"MCP: Enabled ({len(enabled_providers)} providers: {', '.join(enabled_providers)})")
        else:
            print("MCP: Disabled")
        print("-" * 50)

        # Step 1: Risk Classification
        print("🔍 Classifying risk...")
        risk_tier = policy.classify_risk(task)

        evidence.log_event("risk_classification", {
            "task": task,
            "risk_tier": risk_tier.value,
            "classification_reason": policy.get_classification_reason()
        })

        if risk_tier == RiskTier.RED:
            print(f"❌ RED TIER: {task}")
            print("HITL required for Red-tier tasks.")
            print("Please escalate to human oversight for approval.")
            evidence.log_event("execution_blocked", {"reason": "red_tier_hitl_required"})
            return 1

        print(f"✅ {risk_tier.value} TIER: Proceeding with safety measures")

        if mcp_call_provider:
            return _handle_mcp_call(
                task=task,
                risk_tier=risk_tier,
                mcp_bridge=mcp_bridge,
                evidence=evidence,
                provider=mcp_call_provider,
                action=mcp_call_action,
                params_raw=mcp_call_params_raw,
                state_manager=state_manager,
            )

        # Step 2: ContextStream Retrieval (if enabled)
        context_memories = []
        if use_contextstream:
            if not contextstream or not contextstream.is_configured:
                print("ℹ️  ContextStream: not configured (offline)")
            else:
                print("🔍 ContextStream: attempting retrieval...")
                context_memories = contextstream.retrieve_budgeted(
                    task,
                    top_k=8,
                    max_chars_total=10000,
                    max_chars_per_item=1200
                )

                # Get status for accurate reporting
                status = contextstream.get_retrieval_status()
                if status['succeeded']:
                    print(f"✅ ContextStream: retrieved {len(context_memories)} (budgeted/deduped)")
                    if context_memories:
                        print("Context Summary:")
                        for i, memory in enumerate(context_memories[:3]):  # Show first 3
                            print(f"  {i+1}. [{memory['type']}] {memory['summary'][:60]}...")
                        if len(context_memories) > 3:
                            print(f"  ... and {len(context_memories) - 3} more")
                else:
                    error_msg = status.get('error_message', 'unknown error')
                    print(f"❌ ContextStream: request failed ({error_msg}), retrieved 0")
        else:
            print("ℹ️  ContextStream: disabled")

        evidence.log_event("contextstream_retrieval", {
            "enabled": use_contextstream,
            "configured": contextstream.is_configured if contextstream else False,
            "attempted": contextstream.last_retrieval_status['attempted'] if contextstream else False,
            "succeeded": contextstream.last_retrieval_status['succeeded'] if contextstream else False,
            "error_message": contextstream.last_retrieval_status.get('error_message') if contextstream else None,
            "retrieved_count": len(context_memories),
            "budget_max_chars_total": 10000,
            "budget_max_chars_per_item": 1200
        })

        # Step 3: DRY-RUN Planning
        print("\n📋 DRY-RUN Planning...")
        plan = planner.plan_task(task, dry_run=True, context_memories=context_memories)
        print("Plan:")
        for step in plan:
            print(f"  • {step}")

        evidence.log_event("planning_complete", {"plan_steps": plan, "dry_run": True})

        # Step 3: Confirmation for non-dry-run
        if not dry_run:
            print("\n⚠️  WRITE OPERATIONS DETECTED")
            print("This task may modify files in the repository.")
            print("Review the plan above and confirm execution.")

            response = input("\nType 'yes' to proceed, anything else to cancel: ").strip().lower()
            if response != 'yes':
                print("❌ Execution cancelled by user")
                evidence.log_event("execution_cancelled", {"reason": "user_cancelled"})
                return 0

            print("✅ Proceeding with execution...")

        # Step 4: Execute Implementation
        print("\n🔧 Executing Implementation...")
        implementation_result = implementer.execute_task(task, plan, dry_run=dry_run)

        if not dry_run:
            evidence.log_event("implementation_complete", implementation_result)

        # Step 5: Audit Validation
        print("\n🔍 Running Audit Validation...")
        audit_results = auditor.audit_changes(task, dry_run=dry_run)

        evidence.log_event("audit_complete", audit_results)

        # Task lifecycle: task_verify event (Phase 5B.4)
        git_diff_stat = get_git_diff_stat()
        evidence.log_event("task_verify", {
            "session_id": session_id,
            "task": task,
            "audit_status": audit_results.get("status", "unknown"),
            "audit_details": audit_results.get("details", []),
            "git_diff_stat": git_diff_stat,
            "governance_files_changed": check_governance_files_changed()
        })

        # Step 6: Report Results
        print("\n📊 Execution Summary:")
        print(f"Risk Tier: {risk_tier.value}")
        print(f"Dry Run: {dry_run}")
        if use_contextstream and contextstream:
            status = contextstream.get_retrieval_status()
            if status['succeeded']:
                print(f"ContextStream: retrieved {len(context_memories)} memories")
            elif status['attempted']:
                print(f"ContextStream: request failed, retrieved 0")
            else:
                print("ContextStream: not configured")
        else:
            print("ContextStream: disabled")

        if mcp_bridge and mcp_bridge.is_mcp_enabled():
            enabled_providers = mcp_bridge.get_enabled_providers()
            print(f"MCP: {len(enabled_providers)} providers enabled")
        else:
            print("MCP: disabled")

        print(f"Audit Status: {'PASS' if audit_results.get('status') == 'success' else 'ISSUES'}")

        if audit_results.get('status') != 'success':
            print("⚠️  Audit found issues - review evidence log for details")
            return 1

        print("✅ Task completed successfully")

        # Governance closure gate (Phase 5B.4)
        closure_allowed, closure_reason, suggested_files = validate_governance_closure(
            close_governance, "success"
        )
        
        if not closure_allowed:
            # Block success due to missing governance closure
            print(f"\n❌ GOVERNANCE CLOSURE BLOCKED: {closure_reason}")
            print("\nRemediation required:")
            print("1. Update at least one governance document:")
            for gov_file in suggested_files or GOVERNANCE_FILES:
                print(f"   - {gov_file}")
            print("\n2. Or use --close-governance flag:")
            print("   --close-governance updated")
            print("   --close-governance na:<reason> (for read-only or no-governance-change tasks)")
            
            # Task lifecycle: task_close event (blocked)
            evidence.log_event("task_close", {
                "session_id": session_id,
                "task": task,
                "result": "blocked",
                "closure_status": "blocked",
                "closure_reason": closure_reason,
                "suggested_files": suggested_files
            })
            
            # Update state with blocked result
            enabled_providers = []
            if mcp_bridge and mcp_bridge.is_mcp_enabled():
                enabled_providers = mcp_bridge.get_enabled_providers()
                
            session_info = {
                "session_id": session_id,
                "task": task,
                "mode": "normal",
                "result": "blocked",
                "reason": "missing_governance_closure",
                "features": {
                    "contextstream": {
                        "enabled": use_contextstream,
                        "configured": contextstream.is_configured if contextstream else False
                    },
                    "mcp": {
                        "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                        "providers": enabled_providers
                    },
                    "memory_write": {
                        "enabled": write_memory
                    }
                }
            }
            state_manager.update_session_state(session_info)
            
            return 1
        
        # Governance closure satisfied
        print(f"\n✅ GOVERNANCE CLOSURE: {closure_reason}")

        # TDD proof gate (Phase 5D.2)
        tdd_allowed, tdd_reason, tdd_details = validate_tdd_proof(
            tdd_proof, "success", evidence
        )
        
        if not tdd_allowed:
            # Block success due to missing TDD proof
            print(f"\n❌ TDD PROOF BLOCKED: {tdd_reason}")
            print("\nRemediation required:")
            print("1. Add or modify test files (matching **/*.spec.ts, **/*.test.ts, **/__tests__/**, tests/**, apps/**/__tests__/**)")
            print("2. Or use --tdd-proof flag:")
            print("   --tdd-proof tests-first (requires failing test before fix)")
            print("   --tdd-proof tests-added (requires tests added/modified for feature/bugfix)")
            print("   --tdd-proof na:<reason> (for docs-only / read-only sessions)")
            
            # Log evidence event
            evidence.log_event("tdd_proof_blocked", {
                "proof_type": tdd_proof,
                "ok": False,
                "missing_items": tdd_details.get("missing_items", []),
                "test_commands_seen": tdd_details.get("test_commands_seen", []),
                "test_files_changed": tdd_details.get("test_files_changed", [])
            })
            
            # Task lifecycle: task_close event (blocked)
            evidence.log_event("task_close", {
                "session_id": session_id,
                "task": task,
                "result": "blocked",
                "closure_status": "blocked",
                "closure_reason": tdd_reason
            })
            
            # Update state with blocked result and tdd_proof summary
            enabled_providers = []
            if mcp_bridge and mcp_bridge.is_mcp_enabled():
                enabled_providers = mcp_bridge.get_enabled_providers()
                
            session_info = {
                "session_id": session_id,
                "task": task,
                "mode": "normal",
                "result": "blocked",
                "reason": "missing_tdd_proof",
                "tdd_proof": {
                    "type": tdd_proof,
                    "ok": False,
                    "missing": len(tdd_details.get("missing_items", []))
                },
                "features": {
                    "contextstream": {
                        "enabled": use_contextstream,
                        "configured": contextstream.is_configured if contextstream else False
                    },
                    "mcp": {
                        "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                        "providers": enabled_providers
                    },
                    "memory_write": {
                        "enabled": write_memory
                    }
                }
            }
            state_manager.update_session_state(session_info)
            
            return 1
        
        # TDD proof satisfied
        print(f"\n✅ TDD PROOF: {tdd_reason}")
        # Log evidence event
        evidence.log_event("tdd_proof", {
            "proof_type": tdd_proof,
            "ok": True,
            "missing_items": tdd_details.get("missing_items", []),
            "test_commands_seen": tdd_details.get("test_commands_seen", []),
            "test_files_changed": tdd_details.get("test_files_changed", [])
        })

        # Optional Memory Storage with MemoryStore
        if write_memory and not dry_run:
            await_memory_storage_with_store(task, memory_type, memory_tags, contextstream, evidence)

        # Optional Repo Map Snapshot (Phase 3C)
        if snapshot_repo_map and not dry_run:
            await_repo_map_snapshot(task, write_memory, contextstream, evidence)

        # Task lifecycle: task_close event (success with closure)
        evidence.log_event("task_close", {
            "session_id": session_id,
            "task": task,
            "result": "success",
            "closure_status": "satisfied",
            "closure_reason": closure_reason,
            "close_governance": close_governance
        })

        evidence.log_event("session_complete", {"status": "success"})
        
        # Update state with session information for normal execution path
        enabled_providers = []
        if mcp_bridge and mcp_bridge.is_mcp_enabled():
            enabled_providers = mcp_bridge.get_enabled_providers()
            
        session_info = {
            "session_id": session_id,
            "task": task,
            "mode": "normal",
            "result": "success",
            "tdd_proof": {
                "type": tdd_proof,
                "ok": True,
                "missing": len(tdd_details.get("missing_items", []))
            },
            "features": {
                "contextstream": {
                    "enabled": use_contextstream,
                    "configured": contextstream.is_configured if contextstream else False
                },
                "mcp": {
                    "enabled": mcp_bridge.is_mcp_enabled() if mcp_bridge else False,
                    "providers": enabled_providers
                },
                "memory_write": {
                    "enabled": write_memory
                }
            }
        }
        state_manager.update_session_state(session_info)
        
        return 0

    except Exception as e:
        print(f"❌ Error during execution: {e}")
        evidence.log_event("execution_error", {"error": str(e), "traceback": str(sys.exc_info())})
        
        # Task lifecycle: task_close event (error)
        evidence.log_event("task_close", {
            "session_id": session_id if 'session_id' in locals() else "unknown",
            "task": task if 'task' in locals() else "unknown",
            "result": "error",
            "closure_status": "not_applicable",
            "closure_reason": f"Execution error: {e}"
        })
        
        # Update state with session information for error case
        enabled_providers = []
        if mcp_bridge and mcp_bridge.is_mcp_enabled():
            enabled_providers = mcp_bridge.get_enabled_providers()
            
        session_info = {
            "session_id": session_id if 'session_id' in locals() else "unknown",
            "task": task,
            "mode": "normal" if 'mcp_call_provider' not in locals() or not mcp_call_provider else "mcp-only",
            "result": "error",
            "features": {
                "contextstream": {
                    "enabled": use_contextstream if 'use_contextstream' in locals() else False,
                    "configured": contextstream.is_configured if 'contextstream' in locals() and contextstream else False
                },
                "mcp": {
                    "enabled": mcp_bridge.is_mcp_enabled() if 'mcp_bridge' in locals() and mcp_bridge else False,
                    "providers": enabled_providers
                },
                "memory_write": {
                    "enabled": write_memory if 'write_memory' in locals() else False
                }
            }
        }
        state_manager.update_session_state(session_info)
        
        return 1

if __name__ == "__main__":
    sys.exit(main())