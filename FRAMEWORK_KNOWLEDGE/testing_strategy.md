# Testing Strategy — Comprehensive Testing Approach

## Overview

This document defines the testing strategy for the Autonomous Engineering OS. Testing is not just about verifying functionality — it's about preventing regressions, enabling safe refactoring, and catching issues early.

---

## TESTING PHILOSOPHY

### Principle 1: Test-Alongside Development

**Approach**: Write tests alongside new code, not after.

**Why**:
- Catches issues immediately (context is fresh)
- Ensures testability (code designed to be testable)
- Prevents "I'll test it later" (which often means never)
- Tests serve as documentation for expected behavior

**Implementation**:
- For every new function: Write test before or immediately after
- For every bug fix: Write test that reproduces bug, then fix
- For every refactor: Write tests first if they don't exist

---

### Principle 2: Test Behavior, Not Implementation

**Approach**: Test what the code does, not how it does it.

**Why**:
- Tests survive refactoring unchanged
- Tests document external behavior
- Tests verify value, not just code paths

**Example**:

```python
# BAD: Tests implementation detail
def test_user_repository_calls_db():
    repo = UserRepository()
    repo.get_user(123)
    assert repo.db.query.called  # Tests internal implementation

# GOOD: Tests public behavior
def test_user_repository_gets_user():
    repo = UserRepository(test_db)
    user = repo.get_user(123)
    assert user.id == 123  # Tests result, not implementation
```

---

### Principle 3: Pyramid Testing

**Approach**: More unit tests, fewer integration tests, minimal e2e tests.

```
        /\
       /  \     E2E Tests: Few, slow, expensive
      /____\    Critical user paths only
     /      \
    /        \  Integration Tests: Medium count
   /__________\  API boundaries, database, external services
  /            \
 /              \ Unit Tests: Many, fast, cheap
/________________\ Individual functions, classes, modules
```

**Ratios**:
- Unit Tests: 70-80% of test suite
- Integration Tests: 15-20% of test suite
- E2E Tests: 5-10% of test suite

**Why Pyramid**:
- Unit tests are fast, catch most issues early
- Integration tests verify components work together
- E2E tests are slow/fragile, use sparingly for critical paths

---

## TESTING TYPES

### 1. Unit Tests

**Definition**: Test individual functions/classes in isolation.

**Characteristics**:
- Fast (milliseconds)
- No external dependencies (mock them)
- Test single behavior per test
- Fail fast, fail locally

**When to Write**:
- Every new function/class
- Complex business logic
- Data transformations
- Utility functions

**Example**:
```python
import pytest
from app.core.services.pricing import calculate_discount

def test_calculate_discount_ten_percent():
    """Test 10% discount calculation."""
    base_price = 100.0
    discount_percent = 10.0

    result = calculate_discount(base_price, discount_percent)

    assert result == 90.0

def test_calculate_discount_zero_percent():
    """Test no discount when percentage is zero."""
    base_price = 100.0
    discount_percent = 0.0

    result = calculate_discount(base_price, discount_percent)

    assert result == 100.0

def test_calculate_discount_negative_percentage_raises_error():
    """Test negative discount percentage raises error."""
    with pytest.raises(ValueError):
        calculate_discount(100.0, -10.0)

def test_calculate_discount_large_percentage():
    """Test 100% discount results in zero price."""
    base_price = 50.0
    discount_percent = 100.0

    result = calculate_discount(base_price, discount_percent)

    assert result == 0.0
```

---

### 2. Integration Tests

**Definition**: Test how components work together.

**Characteristics**:
- Medium speed (seconds)
- Real dependencies (database, maybe external APIs)
- Test boundaries between components
- Verify integration points work

**When to Write**:
- API endpoint tests
- Database repository tests
- Service integration tests
- External client library tests

**Example (API Integration Test)**:
```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_create_user_endpoint():
    """Test user creation through API."""
    response = client.post(
        "/api/users",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "user_value": "ExampleValue123!"
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["username"] == "testuser"
    assert "id" in data
    assert "user_value" not in data  # Never returned

def test_create_user_duplicate_email_returns_409():
    """Test duplicate email returns conflict error."""
    # Create first user
    client.post("/api/users", json={
        "email": "test@example.com",
        "username": "testuser1",
        "user_value": "ExampleValue123!"
    })

    # Try to create with same email
    response = client.post("/api/users", json={
        "email": "test@example.com",
        "username": "testuser2",
        "user_value": "ExampleValue123!"
    })

    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()

def test_get_user_returns_404_for_nonexistent():
    """Test getting non-existent user returns 404."""
    response = client.get("/api/users/999999")

    assert response.status_code == 404
```

**Example (Database Integration Test)**:
```python
import pytest
from app.core.repositories.user_repository import UserRepository

@pytest.fixture
def user_repository(test_db):
    """User repository with test database."""
    return UserRepository(test_db)

def test_repository_creates_and_retrieves_user(user_repository):
    """Test repository can create and retrieve user."""
    user_id = user_repository.create({
        "email": "test@example.com",
        "username": "testuser",
        "user_value_encrypted": "encrypted_value"
    })

    user = user_repository.get_by_id(user_id)

    assert user is not None
    assert user.email == "test@example.com"
    assert user.username == "testuser"
```

---

### 3. End-to-End (E2E) Tests

**Definition**: Test complete user workflows through the system.

**Characteristics**:
- Slow (seconds to minutes)
- Real system (or as close as possible)
- Test critical paths only
- Most expensive/friable

**When to Write**:
- User signup/login flow
- Core value delivery workflow
- Payment processing
- Any path that, if broken, is critical

**Example**:
```python
# tests/e2e/test_user_onboarding_flow.py

def test_complete_user_onboarding_flow():
    """Test full user signup and first-use flow."""
    # 1. User signs up
    signup_response = app_client.post("/api/auth/signup", json={
        "email": "newuser@example.com",
        "user_value": "ExampleValue123!"
    })
    assert signup_response.status_code == 201
    user_id = signup_response.json()["user"]["id"]

    # 2. User logs in
    login_response = app_client.post("/api/auth/login", json={
        "email": "newuser@example.com",
        "user_value": "ExampleValue123!"
    })
    assert login_response.status_code == 200
    session_id = login_response.json()["session_id"]

    # 3. User completes profile
    profile_response = app_client.post(
        "/api/users/me/profile",
        headers={"Auth-Session": f"{session_id}"},
        json={"name": "New User", "bio": "Test bio"}
    )
    assert profile_response.status_code == 200

    # 4. Verify user can access protected endpoint
    protected_response = app_client.get(
        "/api/users/me",
        headers={"Auth-Session": f"{session_id}"}
    )
    assert protected_response.status_code == 200
    assert protected_response.json()["name"] == "New User"
```

---

## TEST COVERAGE

### Coverage Targets

| Area | Minimum Target | Ideal Target |
|------|----------------|--------------|
| Business Logic (core/) | 90% | 95%+ |
| API Endpoints | 80% | 85%+ |
| Utilities | 85% | 90%+ |
| Configuration | 50% | N/A (minimal) |
| **Overall** | 80% | 85%+ |

**Important**: Coverage is a tool, not a goal. High coverage of bad tests is worse than lower coverage of good tests.

### What Coverage Matters

**Test these paths**:
- All public functions/classes
- All error handling paths
- All branches (if/else statements)
- Edge cases (empty, null, boundary values)

**Can skip coverage for**:
- Main/entry points (test via integration)
- Configuration loading (hard to unit test)
- Simple data classes (no logic)
- Generated code

---

## TEST ORGANIZATION

### Directory Structure

```
tests/
├── unit/                   # Unit tests
│   ├── test_models.py
│   ├── test_repositories.py
│   ├── test_services/
│   │   ├── test_pricing.py
│   │   └── test_auth.py
│   └── test_utils.py
├── integration/            # Integration tests
│   ├── test_api_users.py
│   ├── test_api_auth.py
│   └── test_database.py
├── e2e/                    # End-to-end tests
│   ├── test_user_journey.py
│   └── test_payment_flow.py
├── fixtures/               # Test fixtures
│   ├── user_fixtures.py
│   └── order_fixtures.py
└── conftest.py            # Shared fixtures and config
```

### File Naming

- Test files: `test_{{module_name}}.py`
- Test classes: `Test{{ClassName}}`
- Test functions: `test_{{what_it_tests}}{{condition}}`

**Examples**:
- `test_user_repository.py`
- `TestUserService`
- `test_get_by_id_returns_user()`
- `test_get_by_id_returns_none_when_not_found()`

---

## MOCKING

### When to Mock

**Mock**:
- External services (Stripe API, SendGrid, etc.)
- File system operations (for unit tests)
- Time (for time-dependent logic)
- Database (for unit tests of business logic)

**Don't Mock**:
- Database (for integration tests of database code)
- Your own code (unless testing integration boundary)
- Data structures (create real instances)

### Mocking Example

```python
import pytest
from unittest.mock import Mock, patch
from app.core.services.notification_service import NotificationService

@patch('app.core.services.notification_service.sendgrid_client')
def test_send_welcome_email_calls_sendgrid(mock_sendgrid):
    """Test welcome email calls SendGrid API."""
    mock_sendgrid.send.return_value = {"status": 202}

    service = NotificationService()
    service.send_welcome_email("user@example.com", "John")

    # Verify SendGrid was called with correct parameters
    mock_sendgrid.send.assert_called_once_with(
        to="user@example.com",
        subject="Welcome!",
        body="Hi John, welcome to our app!"
    )

@patch('app.core.services.notification_service.sendgrid_client')
def test_send_welcome_email_handles_failure(mock_sendgrid):
    """Test email send failure is handled gracefully."""
    mock_sendgrid.send.side_effect = Exception("SendGrid down")

    service = NotificationService()

    # Should not raise exception, just log error
    service.send_welcome_email("user@example.com", "John")

    # Email might not be sent, but function doesn't crash
```

---

## TEST FIXTURES

### Pytest Fixtures

Use fixtures to set up common test data:

```python
# tests/conftest.py
import pytest
from app.main import app
from fastapi.testclient import TestClient
from app.core.database import test_db

@pytest.fixture
def client():
    """Test client for API testing."""
    return TestClient(app)

@pytest.fixture
def authenticated_client(client):
    """Client with authenticated user."""
    # Create and login user
    client.post("/api/auth/signup", json={
        "email": "test@example.com",
        "user_value": "ExampleValue123!"
    })
    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "user_value": "ExampleValue123!"
    })
    client.headers.update({
        "Auth-Session": f'{response.json()["session_id"]}'
    })
    return client

@pytest.fixture
def sample_user():
    """Sample user data for testing."""
    return {
        "email": "test@example.com",
        "username": "testuser",
        "user_value": "ExampleValue123!"
    }

# tests/unit/test_user_service.py
def test_create_user_with_fixture(sample_user):
    """Test using fixture."""
    service = UserService()
    user_id = service.create_user(sample_user)
    assert user_id is not None
```

---

## RUNNING TESTS

### Command Pattern

```bash
# Run all tests
pytest

# Run unit tests only
pytest tests/unit/

# Run integration tests only
pytest tests/integration/

# Run specific file
pytest tests/unit/test_user_service.py

# Run specific test
pytest tests/unit/test_user_service.py::test_create_user

# Run with coverage
pytest --cov=app --cov-report=html tests/

# Run tests matching pattern
pytest -k "user"  # All tests with "user" in name

# Run tests in parallel (faster)
pytest -n auto
```

---

## CONTINUOUS TESTING

### CI/CD Integration

Tests must run in CI/CD before merge:

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov
      - name: Run tests
        run: |
          pytest --cov=app --cov-fail-under=80 tests/
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

---

## GOOD TEST VS BAD TEST

### Good Test

```python
def test_calculate_total_with_discount_applied():
    """
    Test order total calculation when discount is applied.

    Given: An order with subtotal $100 and $10 discount
    When: Calculate total
    Then: Total is $100 - $10 = $90
    """
    order = Order(subtotal=100.0, discount=10.0)
    total = calculate_order_total(order)
    assert total == 90.0
```

**Why Good**:
- Descriptive name
- Clear Given/When/Then structure
- Tests single behavior
- Independent of other tests
- Fast

### Bad Test

```python
def test_order_stuff():
    # Create user
    user = User(name="Alice")
    # Create order
    order = Order(user=user, items=[])
    # Add items
    order.add_item(Item(name="widget", price=10.0))
    # Calculate
    total = order.get_total()
    # Save to database
    db.save(order)
    # Load back
    loaded = db.load(Order, order.id)
    # And do some other related tests in one...
    assert loaded.total == 10.0
```

**Why Bad**:
- Vague name
- Tests multiple unrelated things
- Depends on database integration (should be integration test)
- If any step fails, test fails (hard to debug)
- Not isolated

---

## TESTING CHECKLIST

Before committing code, verify:

- [ ] Unit tests written for all new functions
- [ ] Tests cover happy path and error cases
- [ ] Integration tests for API changes
- [ ] All tests pass locally
- [ ] Test coverage meets targets (80%+)
- [ ] No flaky tests (tests that fail intermittently)
- [ ] Tests are fast (unit test < 100ms typical)
- [ ] Tests use descriptive names
- [ ] Tests are independent (no test depends on another)

---

## SUMMARY OF TESTING STRATEGY

| Aspect | Approach |
|--------|----------|
| **Philosophy** | Write tests alongside code, test behavior not implementation |
| **Pyramid** | 70-80% unit, 15-20% integration, 5-10% e2e |
| **Coverage** | Minimum 80% overall, 95% for business logic |
| **Mocking** | External services, file system, time; not database for integration |
| **Running** | pytest with coverage, CI/CD integration |
| **Good Tests** | Descriptive, isolated, single behavior |

---

## VERSION HISTORY

- v1.0 (Initial): Comprehensive testing strategy with examples and guidelines
