"""
ContextStream Client - Memory Retrieval and Storage

Minimal ContextStream integration for agent memory management.
Provides read-heavy retrieval and optional write-light storage.
"""

import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime

# Lazy import for requests - only imported when needed
REQUESTS_AVAILABLE = False
try:
    import requests  # Minimal dependency for HTTP calls
    REQUESTS_AVAILABLE = True
except ImportError:
    requests = None  # type: ignore

class ContextStreamClient:
    """
    ContextStream client for memory operations.

    Provides retrieval of relevant context and optional storage of memory records.
    Degrades gracefully when not configured (returns empty results).
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize ContextStream client.

        Args:
            config: Optional configuration override
        """
        self.config = config or {}

        # Environment-based configuration
        self.url = os.getenv('CONTEXTSTREAM_URL') or self.config.get('url')
        self.api_key = os.getenv('CONTEXTSTREAM_API_KEY') or self.config.get('api_key')
        self.project = os.getenv('CONTEXTSTREAM_PROJECT') or self.config.get('project', 'neuronx')

        # Check if ContextStream is configured
        self.is_configured = bool(self.url and self.api_key)

        # Status tracking for operations
        self.last_retrieval_status = {
            'configured': self.is_configured,
            'attempted': False,
            'succeeded': False,
            'error_message': None
        }

        if not self.is_configured:
            print("⚠️  ContextStream not configured - using offline mode")
            print("   Set CONTEXTSTREAM_URL and CONTEXTSTREAM_API_KEY to enable")

    def retrieve(self, query: str, top_k: int = 8) -> List[Dict[str, Any]]:
        """
        Retrieve relevant context for a query.

        Args:
            query: Search query for relevant memories
            top_k: Maximum number of results to return

        Returns:
            List of memory records, or empty list on any error/failure
        """
        # Update status tracking
        self.last_retrieval_status['attempted'] = True

        if not self.is_configured:
            self.last_retrieval_status['error_message'] = "ContextStream not configured"
            return []

        if not REQUESTS_AVAILABLE or requests is None:
            self.last_retrieval_status['error_message'] = "requests library not available"
            return []

        try:
            # Make actual ContextStream API call
            payload = {
                'query': query,
                'top_k': top_k,
                'project': self.project
            }

            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }

            # Make the HTTP request with timeout
            response = requests.post(
                f"{self.url}/retrieve",
                json=payload,
                headers=headers,
                timeout=10  # 10 second timeout
            )

            # Check for HTTP errors
            response.raise_for_status()

            # Parse JSON response
            result = response.json()

            # Validate response structure
            if not isinstance(result, dict):
                raise ValueError("Response is not a JSON object")

            items = result.get('results', [])
            if not isinstance(items, list):
                raise ValueError("Response 'results' field is not a list")

            # Validate each item has required fields
            validated_items = []
            for item in items:
                if isinstance(item, dict) and all(key in item for key in ['id', 'type', 'summary']):
                    validated_items.append(item)
                # Skip invalid items silently

            self.last_retrieval_status['succeeded'] = True
            return validated_items

        except requests.exceptions.Timeout:
            self.last_retrieval_status['error_message'] = "Request timed out"
        except requests.exceptions.ConnectionError:
            self.last_retrieval_status['error_message'] = "Connection failed"
        except requests.exceptions.HTTPError as e:
            self.last_retrieval_status['error_message'] = f"HTTP error: {e.response.status_code}"
        except ValueError as e:
            self.last_retrieval_status['error_message'] = f"Invalid response: {str(e)}"
        except Exception as e:
            self.last_retrieval_status['error_message'] = f"Unexpected error: {str(e)}"

        # Any error results in empty list
        return []

    def store(self, record: Dict[str, Any]) -> None:
        """
        Store a memory record.

        Args:
            record: Validated memory record to store

        Raises:
            RuntimeError: If ContextStream is not configured or storage fails
        """
        if not self.is_configured:
            raise RuntimeError("ContextStream not configured - cannot store memories")

        if not REQUESTS_AVAILABLE or requests is None:
            raise RuntimeError("requests library not available - cannot store memories. Install with: pip install requests")

        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }

            payload = {
                'record': record,
                'project': self.project
            }

            # Simulate API call for now - replace with actual implementation
            # response = requests.post(f"{self.url}/store", json=payload, headers=headers)
            # response.raise_for_status()

            print(f"💾 ContextStream: Stored memory '{record.get('summary', 'unknown')[:50]}...'")
            print("   (Phase 3B: Using placeholder - no actual storage)")

        except Exception as e:
            raise RuntimeError(f"ContextStream storage failed: {e}")

    def get_retrieval_status(self) -> Dict[str, Any]:
        """
        Get the status of the last retrieval operation.

        Returns:
            Dictionary with retrieval status information
        """
        return self.last_retrieval_status.copy()

    @staticmethod
    def normalize_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Normalize memory items to ensure required fields exist.

        Args:
            items: Raw memory items from retrieval

        Returns:
            Normalized items with required fields
        """
        normalized = []

        for item in items:
            if not isinstance(item, dict):
                continue

            # Ensure required fields exist with safe defaults
            normalized_item = {
                'id': item.get('id', f'normalized_{len(normalized)}'),
                'type': item.get('type', 'pattern'),  # Safe default
                'summary': item.get('summary', 'Memory item without summary'),
                'sources': item.get('sources', []),  # Empty list if missing
                'tags': item.get('tags', []),  # Empty list if missing
                'date': item.get('date', datetime.now().isoformat())
            }

            # Preserve any additional fields
            for key, value in item.items():
                if key not in normalized_item:
                    normalized_item[key] = value

            normalized.append(normalized_item)

        return normalized

    @staticmethod
    def dedupe_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Deduplicate memory items by ID or content hash.

        Args:
            items: Memory items to deduplicate

        Returns:
            Deduplicated items, preferring unique IDs or content hashes
        """
        seen_ids = set()
        seen_hashes = set()
        deduped = []

        for item in items:
            item_id = item.get('id', '')

            # Prefer ID-based deduplication
            if item_id and item_id not in seen_ids:
                seen_ids.add(item_id)
                deduped.append(item)
                continue

            # Fallback to content-based deduplication
            content_hash = hash((
                item.get('type', ''),
                item.get('summary', '')
            ))

            if content_hash not in seen_hashes:
                seen_hashes.add(content_hash)
                deduped.append(item)

        return deduped

    @staticmethod
    def apply_budget(items: List[Dict[str, Any]], max_chars_total: int = 10000,
                    max_chars_per_item: int = 1200) -> List[Dict[str, Any]]:
        """
        Apply character budget limits to memory items.

        Args:
            items: Memory items to budget
            max_chars_total: Maximum total characters across all items
            max_chars_per_item: Maximum characters per individual item

        Returns:
            Budgeted items with truncated summaries if needed
        """
        budgeted = []
        total_chars = 0

        for item in items:
            # Create a copy to avoid modifying the original
            budgeted_item = item.copy()

            # Truncate individual item summary if too long
            summary = budgeted_item.get('summary', '')
            if len(summary) > max_chars_per_item:
                budgeted_item['summary'] = summary[:max_chars_per_item - 3] + '...[truncated]'
                summary = budgeted_item['summary']

            # Check if adding this item would exceed total budget
            item_chars = len(summary)
            if total_chars + item_chars > max_chars_total:
                break  # Stop adding items

            budgeted.append(budgeted_item)
            total_chars += item_chars

        return budgeted

    def retrieve_budgeted(self, query: str, top_k: int = 8, max_chars_total: int = 10000,
                         max_chars_per_item: int = 1200) -> List[Dict[str, Any]]:
        """
        Retrieve and budget memory items with quality controls.

        Args:
            query: Search query for relevant memories
            top_k: Maximum number of raw results to retrieve
            max_chars_total: Maximum total characters for all items
            max_chars_per_item: Maximum characters per individual item

        Returns:
            Normalized, deduplicated, and budgeted memory items (empty on any error)
        """
        # Reset status tracking for this operation
        self.last_retrieval_status = {
            'configured': self.is_configured,
            'attempted': False,
            'succeeded': False,
            'error_message': None
        }

        # Get raw items (this will update status tracking)
        raw_items = self.retrieve(query, top_k)

        # Apply quality controls only if we have items
        if raw_items:
            try:
                normalized = self.normalize_items(raw_items)
                deduped = self.dedupe_items(normalized)
                budgeted = self.apply_budget(deduped, max_chars_total, max_chars_per_item)
                self.last_retrieval_status['succeeded'] = True
                return budgeted
            except Exception as e:
                self.last_retrieval_status['error_message'] = f"Quality control failed: {str(e)}"
                return []
        else:
            # No items retrieved - status already set by retrieve() method
            return []

    def get_status(self) -> Dict[str, Any]:
        """
        Get ContextStream client status.

        Returns:
            Dictionary with configuration and status information
        """
        return {
            'configured': self.is_configured,
            'url': bool(self.url),  # Don't expose actual URL
            'api_key': bool(self.api_key),  # Don't expose actual key
            'project': self.project,
            'mode': 'online' if self.is_configured else 'offline'
        }

# Convenience functions
def create_contextstream_client(config: Optional[Dict[str, Any]] = None) -> ContextStreamClient:
    """Create and return a configured ContextStream client."""
    return ContextStreamClient(config)

def retrieve_context(query: str, top_k: int = 8, config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Convenience function to retrieve context for a query."""
    client = ContextStreamClient(config)
    return client.retrieve(query, top_k)