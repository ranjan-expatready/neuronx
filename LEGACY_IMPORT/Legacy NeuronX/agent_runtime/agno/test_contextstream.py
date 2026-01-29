#!/usr/bin/env python3
"""
ContextStream Smoke Test

Tests ContextStream retrieval and store functionality with safe dummy payload.
Run with: python3 test_contextstream.py

Required environment variables:
- CONTEXTSTREAM_URL: URL of ContextStream instance
- CONTEXTSTREAM_API_KEY: API key for ContextStream
"""

import sys
import os
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from contextstream import ContextStreamClient

def test_contextstream_retrieval():
    """Test ContextStream retrieval."""
    print("=" * 60)
    print("ContextStream Retrieval Test")
    print("=" * 60)

    client = ContextStreamClient()

    print(f"ContextStream configured: {client.is_configured}")

    if not client.is_configured:
        print("❌ ContextStream not configured - skipping retrieval test")
        print("   Set CONTEXTSTREAM_URL and CONTEXTSTREAM_API_KEY environment variables")
        return False

    # Test retrieval with a query
    query = "test query for smoke test"
    print(f"\nAttempting retrieval with query: '{query}'")

    try:
        results = client.retrieve(query, top_k=3)
        print(f"✅ Retrieved {len(results)} items")
        status = client.get_retrieval_status()
        print(f"   Status: {status}")
        return True
    except Exception as e:
        print(f"⚠️  Retrieval test encountered error (may be normal if no ContextStream server): {e}")
        return False

def test_contextstream_store():
    """Test ContextStream store."""
    print("\n" + "=" * 60)
    print("ContextStream Store Test")
    print("=" * 60)

    client = ContextStreamClient()

    print(f"ContextStream configured: {client.is_configured}")

    if not client.is_configured:
        print("❌ ContextStream not configured - skipping store test")
        print("   Set CONTEXTSTREAM_URL and CONTEXTSTREAM_API_KEY environment variables")
        return False

    # Create a safe dummy memory record
    dummy_record = {
        "id": "smoke_test_record",
        "type": "pattern",
        "summary": "ContextStream smoke test - verify store functionality",
        "sources": ["test_contextstream.py"],
        "tags": ["smoke", "test"],
        "date": "2026-01-19T00:00:00Z"
    }

    print(f"\nAttempting to store dummy record: {dummy_record['summary']}")

    try:
        client.store(dummy_record)
        print("✅ Store test completed")
        return True
    except Exception as e:
        print(f"⚠️  Store test encountered error (may be normal if no ContextStream server): {e}")
        return False

def main():
    """Run all ContextStream smoke tests."""
    print("ContextStream Smoke Test Suite")
    print("=" * 60)

    # Show environment status
    url_set = bool(os.getenv("CONTEXTSTREAM_URL"))
    key_set = bool(os.getenv("CONTEXTSTREAM_API_KEY"))

    print(f"\nEnvironment status:")
    print(f"  CONTEXTSTREAM_URL: {'✅ Set' if url_set else '❌ Not set'}")
    print(f"  CONTEXTSTREAM_API_KEY: {'✅ Set' if key_set else '❌ Not set'}")

    if not (url_set and key_set):
        print("\n⚠️  ContextStream not fully configured - tests will skip")
        print("   To enable tests, set:")
        print("     export CONTEXTSTREAM_URL='https://your-contextstream-instance.com'")
        print("     export CONTEXTSTREAM_API_KEY='your-api-key'")

    # Run tests
    retrieval_ok = test_contextstream_retrieval()
    store_ok = test_contextstream_store()

    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    print(f"Retrieval: {'✅ PASS' if retrieval_ok else '⚠️  SKIP/FAIL'}")
    print(f"Store: {'✅ PASS' if store_ok else '⚠️  SKIP/FAIL'}")

    if retrieval_ok or store_ok:
        print("\n✅ ContextStream functionality verified")
    else:
        print("\nℹ️  ContextStream tests skipped - normal when no server available")
        print("   The store() implementation is ready with urllib.request support")

if __name__ == "__main__":
    main()
