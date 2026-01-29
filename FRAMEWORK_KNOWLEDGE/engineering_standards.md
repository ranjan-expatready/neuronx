# Engineering Standards — Code Quality and Development Practices

## Overview

This document defines the engineering standards and best practices that should be applied across all code written by the Autonomous Engineering OS.

---

## CODE QUALITY PRINCIPLES

### Principle 1: Code is Read More Than Written

**Implication**: Optimize for readability, not cleverness.

**Guidelines**:
- Prefer clarity over brevity
- Use descriptive names for variables, functions, classes
- Comment the "why", not the "what"
- Break complex functions into smaller, simpler ones

**Example**:

```python
# BAD: Clever but opaque
def p(d: dict, k: str) -> Optional[Any]:
    return d.get(k) if k in d else None

# GOOD: Clear and obvious
def get_value_safely(data: dict, key: str) -> Optional[Any]:
    """Get dictionary value, returning None if key doesn't exist."""
    return data.get(key) if key in data else None
```

---

### Principle 2: DRY (Don't Repeat Yourself)

**Implication**: Repeated code has bugs in multiple places when fixed once.

**Guidelines**:
- Extract common functionality into functions/modules
- Use inheritance or composition appropriately
- Maintain a single source of truth for logic
- When changing code, check for similar patterns to consolidate

**Example**:

```python
# BAD: Repeated logic
def process_order_with_shipping(user_id: int, order: dict):
    if not order.get('item'):
        raise ValueError("Order must have an item")
    # Process order...
    add_shipping_cost(order, user_id)

def process_order_without_shipping(user_id: int, order: dict):
    if not order.get('item'):
        raise ValueError("Order must have an item")
    # Process order... (same as above)

# GOOD: Extract common logic
def validate_order(order: dict):
    """Validate order has required fields."""
    if not order.get('item'):
        raise ValueError("Order must have an item")
    return True

def process_order(user_id: int, order: dict, add_shipping: bool):
    """Process order, optionally adding shipping."""
    validate_order(order)
    # Process order...
    if add_shipping:
        add_shipping_cost(order, user_id)
```

---

### Principle 3: Single Responsibility

**Implication**: Each function/class does one thing well.

**Guidelines**:
- Functions should fit on one screen (< 30 lines typically)
- Classes should have a single reason to change
- Business logic separate from I/O/formatting
- One level of abstraction per function

**Example**:

```python
# BAD: Function does multiple things
def process_user_payment(user_id: int, amount: float):
    # Validate user
    user = db.query(User).get(user_id)
    if not user:
        raise ValueError("User not found")
    # Create payment
    payment = Payment(user_id=user_id, amount=amount)
    db.add(payment)
    # Process with Stripe
    stripe.Charge.create(amount=amount*100, currency="usd", customer=user.stripe_id)
    # Send email
    send_confirmation_email(user.email, amount)
    # Update user balance
    user.balance += amount
    db.commit()

# GOOD: Separate into focused functions
def get_user(user_id: int) -> User:
    """Validate user exists and return user object."""
    user = db.query(User).get(user_id)
    if not user:
        raise ValueError("User not found")
    return user

def create_payment_record(user_id: int, amount: float) -> Payment:
    """Create payment record in database."""
    payment = Payment(user_id=user_id, amount=amount)
    db.add(payment)
    return payment

def process_stripe_charge(user: User, amount: float) -> str:
    """Process payment with Stripe API."""
    charge = stripe.Charge.create(
        amount=int(amount*100),
        currency="usd",
        customer=user.stripe_id
    )
    return charge.id

def send_payment_confirmation(user: User, amount: float) -> None:
    """Send payment confirmation email to user."""
    send_confirmation_email(user.email, amount)

def update_user_balance(user: User, amount: float) -> None:
    """Update user balance in database."""
    user.balance += amount
    db.commit()

def process_user_payment(user_id: int, amount: float) -> None:
    """Orchestrate payment processing."""
    user = get_user(user_id)
    create_payment_record(user_id, amount)
    process_stripe_charge(user, amount)
    send_payment_confirmation(user, amount)
    update_user_balance(user, amount)
```

---

## NAMING CONVENTIONS

### General Guidelines

- Be descriptive: `get_user_by_id` not `get` or `fetch`
- Be consistent: Use same terminology throughout codebase
- Use active verbs for functions: `create_user`, `calculate_total`
- Use nouns for classes and variables: `UserRepository`, `user_id`
- Avoid abbreviations unless well-known: `config` is OK, `usr_nm` is not

### Language-Specific Conventions

**Python (PEP 8)**:
```python
# Variables and functions: snake_case
user_name = "Alice"
def get_user(user_id: int):
    pass

# Classes: PascalCase
class UserRepository:
    pass

# Constants: UPPER_CASE
MAX_RETRIES = 3

# Private members: single underscore prefix
class Order:
    def _calculate_tax(self):  # Internally used
        pass
```

**JavaScript/TypeScript**:
```javascript
// Variables and functions: camelCase
const userName = "Alice";
function getUser(userId) { ... }

// Classes: PascalCase
class UserRepository { ... }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
```

**SQL**:
```sql
-- Tables: snake_case, singular
CREATE TABLE user ( ... );

-- Columns: snake_case
user_id, created_at, is_active

-- Indexes: idx_[table]_[columns]
CREATE INDEX idx_user_email ON user(email);

-- Foreign keys: fk_[table]_[column]
fk_user_id
```

---

## ERROR HANDLING

### Principles

1. **Fail Explicitly**: Don't silently swallow errors
2. **Fail Gracefully**: Provide helpful error messages
3. **Fail at Right Level**: Handle errors at appropriate abstraction level
4. **Log Context**: Log enough information to debug

### Guidelines

**Do Handle**:
- Expected failures: Invalid input, network timeouts, API rate limits
- Recoverable errors: Retry with backoff, fallback to alternative
- Boundary failures: Validate inputs at function boundaries

**Don't Handle**:
- Development errors: These are bugs, should propagate and be fixed
- System errors: Out of memory, disk full (let system handle)

### Example

```python
# GOOD: Proper error handling
async def fetch_user_data(user_id: int) -> dict:
    """Fetch user data from external API with retry logic."""
    MAX_RETRIES = 3
    BASE_DELAY = 1  # seconds

    for attempt in range(MAX_RETRIES):
        try:
            response = await http.get(f"/api/users/{user_id}")
            response.raise_for_status()  # Raises on 4xx/5xx
            return response.json()
        except requests.HTTPError as e:
            if e.response.status_code == 404:
                raise UserNotFoundError(f"User {user_id} not found") from None
            if e.response.status_code == 429:  # Rate limit
                if attempt < MAX_RETRIES - 1:
                    delay = BASE_DELAY * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Rate limited, retrying in {delay}s")
                    await asyncio.sleep(delay)
                    continue
                raise RateLimitError("API rate limit exceeded") from None
            raise APIError(f"API request failed: {e}")
        except requests.ConnectionError:
            logger.error(f"Connection error fetching user {user_id}, attempt {attempt + 1}")
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(BASE_DELAY * (2 ** attempt))
                continue
            raise ConnectionError("Failed to connect to API after retries")
```

```python
# BAD: Swallowing errors
async def fetch_user_data(user_id: int) -> dict:
    try:
        response = await http.get(f"/api/users/{user_id}")
        return response.json()
    except:
        return {}  # Returns empty dict on ANY error - bad!
```

---

## CODE STRUCTURE AND ORGANIZATION

### Directory Structure

```
app/
├── api/              # API endpoints/routes
│   ├── __init__.py
│   ├── users.py
│   └── auth.py
├── core/             # Core business logic
│   ├── __init__.py
│   ├── models.py
│   ├── repositories.py
│   └── services.py
├── utils/            # Utility functions
│   ├── __init__.py
│   ├── validation.py
│   └── formatting.py
├── config.py         # Configuration
├── main.py           # Application entry point
└── dependencies.py   # Dependency injection

tests/
├── unit/
│   ├── test_models.py
│   ├── test_repositories.py
│   └── test_services.py
├── integration/
│   ├── test_api_users.py
│   └── test_api_auth.py
└── conftest.py       # Test fixtures
```

### Module Guidelines

- **api/**: Thin layer, delegates to services
- **core/**: Business logic, domain models
- **utils/**: Re utilities, no business logic
- **tests/**: Mirror package structure of app/
- Each file < 500 lines (larger files indicate need for splitting)

---

## TYPE SAFETY

### When to Use Types

**Always** (if language supports it):
- Function signatures
- Class attributes
- Return types
- Complex data structures (dicts/lists with known structure)

**Benefits**:
- Catch errors at compile/write time, not runtime
- Better IDE autocomplete and refactoring
- Self-documenting code
- Easier onboarding and maintenance

### Examples

**Python with Type Hints**:
```python
from typing import Optional, List, Dict, Any

def get_user_orders(user_id: int, include_completed: bool = False) -> List[Dict[str, Any]]:
    """Get orders for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError(f"User {user_id} not found")

    orders = db.query(Order).filter(Order.user_id == user_id)
    if not include_completed:
        orders = orders.filter(Order.status != "completed")

    return [order.to_dict() for order in orders.all()]

# Type alias for complex types
OrderItem = Dict[str, Any]
OrderSummary = Dict[str, Any]

def summarize_order(order_items: List[OrderItem]) -> OrderSummary:
    """Calculate order summary from items."""
    # ...
```

**TypeScript**:
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

interface Order {
  id: number;
  userId: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
}

async function getUserOrders(userId: number): Promise<Order[]> {
  const user = await db.getUser(userId);
  if (!user) throw new Error('User not found');

  return await db.getOrdersByUser(userId);
}
```

---

## DOCUMENTATION

### Code Documentation

**Functions/Methods**:
```python
def calculate_discount(base_price: float, discount_percentage: float) -> float:
    """
    Calculate discounted price.

    Args:
        base_price: Original price before discount
        discount_percentage: Discount as percentage (e.g., 10 for 10%)

    Returns:
        Discounted price

    Raises:
        ValueError: If discount_percentage is negative
    """
    if discount_percentage < 0:
        raise ValueError("Discount percentage cannot be negative")
    return base_price * (1 - discount_percentage / 100)
```

**Classes**:
```python
class UserRepository:
    """
    Repository for user data operations.

    Handles all database operations related to users, including
    querying, creating, updating, and deleting user records.
    """

    def __init__(self, db_session: Session):
        """Initialize repository with database session."""
        self.db = db_session
```

**Complex Logic**:
```python
# This calculates the effective tax rate based on:
# 1. User's location (state/country)
# 2. Product category (some categories exempt)
# 3. Order total (some tiers have different rates)
# See https://tax.example.com/rates for more info
effective_rate = calculate_effective_tax_rate(
    user_location=order.shipping_address.state,
    product_category=order.primary_subcategory,
    order_total=order.subtotal
)
```

### README Documentation

Each major component should have README explaining:
- What it does
- How to use it
- Configuration options
- Dependencies
- Examples

---

## DEPENDENCY MANAGEMENT

### Adding Dependencies

**Before adding**:
- Is this dependency maintained?
- Is it widely used (GitHub stars, downloads)?
- What's the license?
- What's the bundle size impact?
- Is there a simpler alternative?

**After adding**:
- Pin the version (exact or minimum)
- Document why it was added
- Add to requirements.txt/package.json
- Update documentation

### Versioning

**Pin specific versions in production**:
```txt
# requirements.txt
fastapi==0.104.1
sqlalchemy==2.0.23
```

**Version ranges for libraries (not for core dependencies)**:
```txt
requests>=2.31.0,<3.0.0  # Accept 2.x, but not 3.0
```

### Dependency Audit

Regularly run:
```bash
pip-audit  # Python (checks for vulnerabilities)
npm audit  # JavaScript/Node
```

---

## SECURITY STANDARDS

### Never Hardcode Secrets

**Bad** (hardcoded values shown as placeholders - NEVER do this):
```python
API_KEY = "EXAMPLE_KEY_VALUE..."
DB_PASSWORD = "EXAMPLE_PASS_VALUE"
```

**Good**:
```python
import os

API_KEY = os.getenv("STRIPE_API_KEY")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not API_KEY:
    raise ValueError("STRIPE_API_KEY environment variable not set")
```

### Input Validation

Always validate and sanitize user inputs:
```python
def create_user(email: str, username: str) -> User:
    # Validate email format
    if not is_valid_email(email):
        raise ValueError("Invalid email format")

    # Validate username length and characters
    if len(username) < 3 or len(username) > 30:
        raise ValueError("Username must be 3-30 characters")
    if not username.isalnum():
        raise ValueError("Username must be alphanumeric")

    # Sanitize (remove dangerous characters)
    clean_username = sanitize_username(username)

    # Create user...
```

### SQL Injection Prevention

**Bad**:
```python
# Vulnerable to SQL injection
query = f"SELECT * FROM users WHERE email = '{email}'"
user = db.execute(query).first()
```

**Good**:
```python
# Parameterized query - safe
query = "SELECT * FROM users WHERE email = :email"
user = db.execute(query, {"email": email}).first()
```

### Authentication and Authorization

- Never hardcode credentials
- Use bcrypt or similar for credential hashing
- Implement rate limiting on login endpoints
- Validate current credentials before credential changes
- Use least-privilege principle for database access

---

## PERFORMANCE STANDARDS

### Consider Performance When Writing

**Database Queries**:
- Select only needed columns (not SELECT *)
- Use indexes appropriately
- Avoid N+1 query problems
- Use pagination for large result sets

**API Calls**:
- Batch multiple calls when possible
- Implement caching for frequently accessed data
- Set reasonable timeouts
- Handle rate limits gracefully

**Algorithmic Complexity**:
- Be aware of Big O for critical paths
- Use appropriate data structures
- Avoid unnecessary nested loops
- Consider streaming for large datasets

### Example: Avoiding N+1

```python
# BAD: N+1 queries
users = db.query(User).all()
for user in users:
    # This executes a query for EACH user!
    orders = db.query(Order).filter(Order.user_id == user.id).all()
    user.orders = orders

# GOOD: Eager loading with single query
users = db.query(User).options(
    joinedload(User.orders)  # Load orders in same query
).all()
# Users already have orders loaded, no extra queries
```

---

## TESTING STANDARDS

(See FRAMEWORK_KNOWLEDGE/testing_strategy.md for detailed testing strategy)

### Quick Reference

- Write tests alongside code
- Test both happy path and error cases
- Use descriptive test names (`test_create_user_success`, `test_create_user_duplicate_email`)
- Mock external dependencies
- Aim for >80% coverage of critical paths
- No flaky tests (tests that sometimes fail without code change)

---

## SUMMARY OF ENGINEERING STANDARDS

| Area | Key Principles |
|------|----------------|
| **Code Quality** | Readability, DRY, Single Responsibility |
| **Naming** | Descriptive, consistent, language-appropriate |
| **Error Handling** | Explicit, graceful, with logging |
| **Structure** | Organized by layer (api, core, utils) |
| **Type Safety** | Use type hints, catch errors early |
| **Documentation** | Docstrings for functions/classes/complex logic |
| **Dependencies** | Careful selection, version pinning, audit |
| **Security** | No hardcoded secrets, input validation, safe queries |
| **Performance** | Consider DB queries, API calls, algorithmic complexity |
| **Testing** | Write with code, cover cases, no flaky tests |

---

## VERSION HISTORY

- v1.0 (Initial): Core engineering standards covering all major aspects of code quality
