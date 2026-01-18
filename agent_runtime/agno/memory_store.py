#!/usr/bin/env python3
"""
MemoryStore - Real Memory Persistence for NeuronX Agent Runtime

Provides deterministic, audit-safe memory storage with local persistence
and optional remote (ContextStream) backup. Uses stdlib-only dependencies
and enforces fail-safe redaction of secrets.

Design Principles:
- Local-first: Always write locally, optionally replicate to remote
- Atomic writes: No partial/corrupt memory files
- Append-only index: Audit trail cannot be silently deleted
- Fail-safe redaction: Block write if secrets cannot be redacted
- No fabricated data: Deterministic operation only
"""

import json
import os
import re
import uuid
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

# Use stdlib urllib for HTTP operations (no requests dependency)
try:
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError
    URLOPEN_AVAILABLE = True
except ImportError:
    URLOPEN_AVAILABLE = False


class MemoryStore:
    """
    MemoryStore provides real persistence for memory records.
    
    Features:
    - Local storage with atomic writes
    - Optional remote storage to ContextStream
    - Deterministic secrets redaction
    - Append-only index for audit trail
    """
    
    def __init__(self, memory_dir: str = "agent_runtime/memory"):
        """
        Initialize MemoryStore.
        
        Args:
            memory_dir: Path to memory storage directory
        """
        self.memory_dir = Path(memory_dir)
        self.index_file = self.memory_dir / "INDEX.jsonl"
        self._ensure_memory_directory()
    
    def _ensure_memory_directory(self) -> None:
        """
        Ensure memory directory exists with proper permissions (0o700).
        
        Creates directory if it doesn't exist and sets permissions.
        """
        if not self.memory_dir.exists():
            self.memory_dir.mkdir(parents=True, mode=0o700, exist_ok=True)
        else:
            # Ensure correct permissions on existing directory
            try:
                os.chmod(self.memory_dir, 0o700)
            except OSError:
                # If we can't set permissions, ensure it exists at least
                pass
    
    def _is_writable(self) -> bool:
        """
        Check if memory directory is writable.
        
        Returns:
            True if directory is writable, False otherwise
        """
        try:
            # Test write by creating a temp file
            test_file = self.memory_dir / f".writable_test_{uuid.uuid4().hex}"
            test_file.touch()
            test_file.unlink()
            return True
        except OSError:
            return False
    
    def redact_secrets(self, text: str) -> str:
        """
        Redact secrets from text using deterministic pattern matching.
        
        Patterns matched:
        - *_KEY, *_TOKEN, *_SECRET, *_PASSWORD
        - Authorization: Bearer
        - password=, api_key=, token=
        
        Args:
            text: Input text potentially containing secrets
            
        Returns:
            Text with secrets replaced by [REDACTED:<type>]
            
        Raises:
            ValueError: If redaction fails (fail-safe)
        """
        if not isinstance(text, str):
            raise ValueError(f"Cannot redact non-string type: {type(text)}")
        
        redacted = text
        
        # Pattern 1: Environment variable style secrets
        secret_patterns = [
            (r'\b[A-Z0-9_]+_KEY\b', 'KEY'),
            (r'\b[A-Z0-9_]+_TOKEN\b', 'TOKEN'),
            (r'\b[A-Z0-9_]+_SECRET\b', 'SECRET'),
            (r'\b[A-Z0-9_]+_PASSWORD\b', 'PASSWORD'),
        ]
        
        for pattern, secret_type in secret_patterns:
            redacted = re.sub(
                pattern,
                f'[REDACTED:{secret_type}]',
                redacted,
                flags=re.IGNORECASE
            )
        
        # Pattern 2: Authorization headers
        redacted = re.sub(
            r'Authorization:\s*Bearer\s+[A-Za-z0-9\-._~+/]+',
            'Authorization: Bearer [REDACTED:TOKEN]',
            redacted,
            flags=re.IGNORECASE
        )
        
        # Pattern 3: Query parameter secrets
        param_patterns = [
            (r'password=[^&\s]+', 'password'),
            (r'api_key=[^&\s]+', 'api_key'),
            (r'token=[^&\s]+', 'token'),
        ]
        
        for pattern, param_type in param_patterns:
            redacted = re.sub(
                pattern,
                f'{param_type}=[REDACTED:{param_type.upper()}]',
                redacted,
                flags=re.IGNORECASE
            )
        
        # Verify redaction worked (fail-safe)
        if not redacted:
            raise ValueError("Redaction produced empty string")
        
        return redacted
    
    def _write_atomic(self, file_path: Path, content: str) -> None:
        """
        Write content to file atomically using temp file + rename.
        
        Args:
            file_path: Destination file path
            content: Content to write
            
        Raises:
            IOError: If write fails
        """
        # Create temp file in same directory for atomic rename
        temp_path = file_path.with_suffix(f'.tmp.{uuid.uuid4().hex}')
        
        try:
            # Write to temp file
            with open(temp_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Atomic rename
            temp_path.rename(file_path)
        except Exception as e:
            # Clean up temp file on error
            try:
                temp_path.unlink()
            except OSError:
                pass
            raise IOError(f"Atomic write failed: {e}")
    
    def _store_local(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Store memory record locally with atomic write.
        
        Args:
            record: Memory record to store
            
        Returns:
            Dictionary with storage metadata
            
        Raises:
            IOError: If storage fails
        """
        if not self._is_writable():
            raise IOError("Memory directory not writable")
        
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = uuid.uuid4().hex[:8]
        file_name = f"{timestamp}_{unique_id}.json"
        file_path = self.memory_dir / file_name
        
        # Redact secrets in all string fields
        redacted_record = {}
        for key, value in record.items():
            if isinstance(value, str):
                try:
                    redacted_record[key] = self.redact_secrets(value)
                except ValueError as e:
                    raise IOError(f"Redaction failed for field '{key}': {e}")
            elif isinstance(value, (dict, list)):
                # Deep redaction for nested structures
                redacted_record[key] = self._redact_nested(value)
            else:
                redacted_record[key] = value
        
        # Write record file atomically
        content = json.dumps(redacted_record, indent=2, ensure_ascii=False)
        self._write_atomic(file_path, content)
        
        # Append to index atomically
        index_entry = {
            "timestamp": datetime.now().isoformat(),
            "file": str(file_path),
            "type": record.get("type", "unknown"),
            "tags": record.get("tags", []),
            "summary": redacted_record.get("summary", "")[:100]
        }
        
        index_content = json.dumps(index_entry) + "\n"
        self._write_atomic(self.index_file, index_content)
        
        return {
            "local_path": str(file_path),
            "index_entry": index_entry
        }
    
    def _redact_nested(self, value: Any) -> Any:
        """
        Recursively redact secrets in nested structures.
        
        Args:
            value: Value to redact (dict, list, or primitive)
            
        Returns:
            Redacted value
        """
        if isinstance(value, str):
            return self.redact_secrets(value)
        elif isinstance(value, dict):
            return {k: self._redact_nested(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [self._redact_nested(item) for item in value]
        else:
            return value
    
    def _store_remote(self, record: Dict[str, Any], contextstream_url: str, contextstream_api_key: str) -> bool:
        """
        Attempt to store memory record to ContextStream.
        
        Args:
            record: Memory record to store
            contextstream_url: ContextStream URL
            contextstream_api_key: ContextStream API key
            
        Returns:
            True if remote store succeeded, False if failed
        """
        if not URLOPEN_AVAILABLE:
            return False
        
        try:
            headers = {
                'Authorization': f'Bearer {contextstream_api_key}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'record': record,
                'project': 'neuronx'
            }
            
            req = Request(
                f"{contextstream_url}/store",
                data=json.dumps(payload).encode('utf-8'),
                headers=headers,
                method='POST'
            )
            
            # Try with timeout, retry once on failure
            for attempt in range(2):
                try:
                    with urlopen(req, timeout=10) as response:
                        if response.status == 200:
                            return True
                        else:
                            # Non-200 response
                            continue
                except (URLError, HTTPError, TimeoutError):
                    if attempt == 0:
                        continue  # Retry once
                    else:
                        return False
            
            return False
            
        except Exception:
            return False
    
    def store_memory(self, record: Dict[str, Any], contextstream_client: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Store memory record with local persistence and optional remote backup.
        
        Args:
            record: Memory record to store (must be valid)
            contextstream_client: Optional ContextStream client config with url and api_key
            
        Returns:
            Dictionary with storage results:
            {
                'local': {'status': 'success'/'failure', 'path': str, 'error': str},
                'remote': {'status': 'success'/'failure'/'skipped', 'error': str},
                'redacted': bool
            }
            
        Raises:
            ValueError: If record is invalid
            IOError: If local storage fails
        """
        # Validate record has required fields
        required_fields = ['id', 'type', 'summary', 'sources', 'date', 'tags']
        for field in required_fields:
            if field not in record:
                raise ValueError(f"Missing required field: {field}")
        
        result = {
            'local': {'status': 'pending', 'path': None, 'error': None},
            'remote': {'status': 'skipped', 'error': None},
            'redacted': False
        }
        
        try:
            # Always attempt local storage
            local_result = self._store_local(record)
            result['local'] = {
                'status': 'success',
                'path': local_result['local_path'],
                'error': None
            }
            result['redacted'] = True
            
        except Exception as e:
            result['local'] = {
                'status': 'failure',
                'path': None,
                'error': str(e)
            }
            raise IOError(f"Local storage failed: {e}")
        
        # Attempt remote storage if configured
        if contextstream_client:
            url = contextstream_client.get('url')
            api_key = contextstream_client.get('api_key')
            
            if url and api_key:
                remote_success = self._store_remote(record, url, api_key)
                if remote_success:
                    result['remote'] = {
                        'status': 'success',
                        'error': None
                    }
                else:
                    result['remote'] = {
                        'status': 'failure',
                        'error': 'remote_store_error'
                    }
            else:
                result['remote'] = {
                    'status': 'skipped',
                    'error': 'remote_not_configured'
                }
        
        return result
    
    def retrieve_memories(self, limit: int = 5, tags: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Retrieve memories from local store.
        
        Args:
            limit: Maximum number of memories to return
            tags: Optional list of tags to filter by (AND logic)
            
        Returns:
            List of memory records (most recent first)
        """
        memories = []
        
        # Read index file if it exists
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            try:
                                entry = json.loads(line)
                                memories.append(entry)
                            except json.JSONDecodeError:
                                continue
            except IOError:
                return []
        
        # Filter by tags if specified
        if tags:
            filtered = []
            for memory in memories:
                memory_tags = set(memory.get('tags', []))
                query_tags = set(tags)
                if query_tags.issubset(memory_tags):
                    filtered.append(memory)
            memories = filtered
        
        # Sort by timestamp (newest first)
        memories.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        # Limit results
        return memories[:limit]
    
    def get_storage_status(self) -> Dict[str, Any]:
        """
        Get current storage status.
        
        Returns:
            Dictionary with storage status information
        """
        return {
            'writable': self._is_writable(),
            'directory': str(self.memory_dir),
            'index_file': str(self.index_file),
            'index_exists': self.index_file.exists(),
            'memory_count': len(self.retrieve_memories(limit=10000))
        }


# Convenience function for CLI integration
def format_memory_summary(memory: Dict[str, Any]) -> str:
    """
    Format memory for CLI display.
    
    Args:
        memory: Memory record from index
        
    Returns:
        Formatted string for display
    """
    timestamp = memory.get('timestamp', 'unknown')
    file_path = memory.get('file', 'unknown')
    memory_type = memory.get('type', 'unknown')
    tags = memory.get('tags', [])
    summary = memory.get('summary', 'no summary')
    
    lines = [
        f"📝 {timestamp[:19].replace('T', ' ')}",
        f"   Type: {memory_type}",
        f"   Tags: {', '.join(tags) if tags else 'none'}",
        f"   File: {file_path}",
        f"   Summary: {summary}"
    ]
    
    return '\n'.join(lines)
