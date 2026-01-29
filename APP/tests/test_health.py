"""
Tests for the health check endpoint.

Tests verify all acceptance criteria:
- Endpoint exists at /health path
- Returns HTTP 200 status code when healthy
- Response body contains {"status": "ok"} (JSON format)
- Response Content-Type is application/json
- Endpoint is reachable and responds within 100ms
"""

import pytest
import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestHealthEndpoint:
    """Test suite for /health endpoint."""

    def test_health_endpoint_exists(self):
        """Test that /health endpoint exists and is accessible."""
        response = client.get("/health")
        assert response.status_code in [200, 201]

    def test_health_returns_200(self):
        """Test that /health endpoint returns HTTP 200 status code."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_json(self):
        """Test that /health endpoint returns JSON."""
        response = client.get("/health")
        assert response.headers["content-type"] == "application/json"

    def test_health_response_structure(self):
        """Test that /health endpoint returns correct JSON structure."""
        response = client.get("/health")
        data = response.json()
        assert "status" in data
        assert isinstance(data["status"], str)

    def test_health_status_ok(self):
        """Test that /health endpoint returns status: ok."""
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "ok"

    def test_health_response_within_100ms(self):
        """Test that /health endpoint responds within 100ms."""
        start_time = time.time()
        response = client.get("/health")
        end_time = time.time()
        response_time_ms = (end_time - start_time) * 1000
        assert response.status_code == 200
        assert response_time_ms < 100, f"Response took {response_time_ms:.2f}ms, expected < 100ms"

    def test_root_endpoint(self):
        """Test that root endpoint returns welcome message."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "health_check" in data
