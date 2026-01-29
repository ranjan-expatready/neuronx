"""
Main FastAPI application with health check endpoint.

This is the minimal application for the SDLC simulation
to validate the Autonomous Engineering OS framework.
"""

from fastapi import FastAPI
from typing import Dict

app = FastAPI(
    title="Autonomous Engineering OS API",
    description="Minimal API for SDLC simulation",
    version="0.1.0",
)


@app.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint for system monitoring.

    Returns a simple JSON response indicating the system is operational.
    This endpoint is used by monitoring services to verify API availability.

    Returns:
        Dict[str, str]: JSON response with status field

    Example:
        >>> GET /health
        >>> {"status": "ok"}
    """
    return {"status": "ok"}


@app.get("/")
async def root() -> Dict[str, str]:
    """
    Root endpoint with welcome message.

    Returns:
        Dict[str, str]: Welcome message
    """
    return {
        "message": "Autonomous Engineering OS API",
        "health_check": "/health"
    }
