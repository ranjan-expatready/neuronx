# Build Instructions

To build the Autonomous Engineering OS application, follow these steps:

## Prerequisites

- Python 3.11+
- pip

## Installation

```bash
pip install -r APP/requirements.txt
```

## Running the Application

```bash
uvicorn APP.main:app --reload
```

## Running Tests

```bash
python3 -m pytest APP/tests/ -v
```
