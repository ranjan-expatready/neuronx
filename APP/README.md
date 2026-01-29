# Autonomous Engineering OS API

A minimal FastAPI application for SDLC simulation.

## Purpose

This is a simulation feature to validate the Autonomous Engineering OS framework and SDLC automation workflow before real product development begins.

## Features

- `/health` endpoint: Returns `{"status": "ok"}` for health monitoring

## Installation

```bash
pip install -r requirements.txt
```

## Running the Application

```bash
uvicorn main:app --reload
```

## Running Tests

```bash
pytest APP/tests/
```

## API Documentation

FastAPI provides interactive API documentation:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development Context

This is part of the end-to-end SDLC simulation (go/no-go test) to validate:
- GitHub Issues → SDLC Board automation
- PLAN artifact creation
- Code implementation following engineering standards
- PR workflow with machine-board validation
- Artifact lifecycle (PLAN → EXECUTION → VERIFICATION → RELEASE)
- STATUS_LEDGER updates
- Resume protocol execution
