"""
Memory Schema - Validation and Construction

Defines memory record schemas and validation for ContextStream integration.
Enforces structure and safety for memory operations.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

# Allowed memory types
MEMORY_TYPES = [
    'decision',  # Architectural or policy decisions
    'gotcha',    # Pitfalls, bugs, or lessons learned
    'pattern',   # Successful approaches or best practices
    'incident',  # Issues, failures, or recovery actions
    'mapping'    # Relationships, dependencies, or connections
]

class MemoryValidationError(Exception):
    """Raised when memory record validation fails."""
    pass

def validate_record(record: Dict[str, Any]) -> None:
    """
    Validate a memory record against the required schema.

    Args:
        record: Memory record to validate

    Raises:
        MemoryValidationError: If validation fails
    """
    required_fields = ['id', 'type', 'summary', 'sources', 'date', 'tags']
    errors = []

    # Check required fields
    for field in required_fields:
        if field not in record:
            errors.append(f"Missing required field: {field}")
        elif not record[field]:
            errors.append(f"Empty required field: {field}")

    if errors:
        raise MemoryValidationError(f"Validation failed: {', '.join(errors)}")

    # Validate type
    if record['type'] not in MEMORY_TYPES:
        errors.append(f"Invalid type '{record['type']}'. Must be one of: {', '.join(MEMORY_TYPES)}")

    # Validate sources
    if not isinstance(record['sources'], list):
        errors.append("sources must be a list")
    elif not record['sources']:
        errors.append("sources cannot be empty")
    else:
        # Check that sources are reasonable (not too long, no dangerous patterns)
        for source in record['sources']:
            if len(str(source)) > 500:
                errors.append(f"Source too long: {str(source)[:100]}...")
            if any(char in str(source) for char in ['<', '>', '|', '&']):
                errors.append(f"Unsafe characters in source: {source}")

    # Validate tags
    if not isinstance(record['tags'], list):
        errors.append("tags must be a list")
    else:
        for tag in record['tags']:
            if len(str(tag)) > 50:
                errors.append(f"Tag too long: {str(tag)[:30]}...")
            if any(char in str(tag) for char in [' ', '\n', '\t']):
                errors.append(f"Invalid whitespace in tag: {tag}")

    # Validate date format (ISO 8601)
    try:
        datetime.fromisoformat(record['date'].replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        errors.append(f"Invalid date format: {record['date']}. Must be ISO 8601")

    # Validate summary length
    if len(record['summary']) > 500:
        errors.append(f"Summary too long: {len(record['summary'])} chars (max 500)")

    # Optional validation for additional fields
    if 'confidence' in record:
        confidence = record['confidence']
        if not isinstance(confidence, (int, float)) or not (0.0 <= confidence <= 1.0):
            errors.append(f"Confidence must be float between 0.0 and 1.0, got: {confidence}")

    if errors:
        raise MemoryValidationError(f"Validation failed: {'; '.join(errors)}")

def build_record(
    task: str,
    summary: str,
    sources: List[str],
    tags: List[str],
    memory_type: str,
    confidence: Optional[float] = None
) -> Dict[str, Any]:
    """
    Build a validated memory record.

    Args:
        task: Original task description
        summary: Brief summary of the memory
        sources: List of source references (file paths, docs, etc.)
        tags: List of relevant tags
        memory_type: Type of memory (decision/gotcha/pattern/incident/mapping)
        confidence: Optional confidence score (0.0-1.0)

    Returns:
        Validated memory record dictionary

    Raises:
        MemoryValidationError: If the built record fails validation
    """
    if memory_type not in MEMORY_TYPES:
        raise MemoryValidationError(f"Invalid memory type: {memory_type}")

    record = {
        'id': str(uuid.uuid4()),
        'type': memory_type,
        'summary': summary.strip(),
        'sources': [str(s).strip() for s in sources],
        'date': datetime.now().isoformat(),
        'tags': [str(t).strip().lower() for t in tags],
        'task': task.strip()
    }

    if confidence is not None:
        if not isinstance(confidence, (int, float)) or not (0.0 <= confidence <= 1.0):
            raise MemoryValidationError(f"Confidence must be between 0.0 and 1.0, got: {confidence}")
        record['confidence'] = confidence

    # Validate the built record
    validate_record(record)

    return record

def format_record_preview(record: Dict[str, Any]) -> str:
    """
    Format a memory record for user preview.

    Args:
        record: Memory record to format

    Returns:
        Human-readable preview string
    """
    lines = [
        f"📝 Memory Record Preview",
        f"Type: {record['type']}",
        f"Summary: {record['summary']}",
        f"Tags: {', '.join(record['tags'])}",
        f"Sources: {len(record['sources'])} items",
    ]

    for i, source in enumerate(record['sources'][:3]):  # Show first 3 sources
        lines.append(f"  • {source}")

    if len(record['sources']) > 3:
        lines.append(f"  ... and {len(record['sources']) - 3} more")

    if 'confidence' in record:
        lines.append(f"Confidence: {record['confidence']:.2f}")

    return "\n".join(lines)

# Convenience functions for common memory types
def build_decision_record(task: str, decision: str, sources: List[str], tags: List[str]) -> Dict[str, Any]:
    """Build a decision-type memory record."""
    summary = f"Decision: {decision}"
    return build_record(task, summary, sources, tags, 'decision')

def build_gotcha_record(task: str, lesson: str, sources: List[str], tags: List[str]) -> Dict[str, Any]:
    """Build a gotcha-type memory record."""
    summary = f"Lesson learned: {lesson}"
    return build_record(task, summary, sources, tags, 'gotcha')

def build_pattern_record(task: str, pattern: str, sources: List[str], tags: List[str]) -> Dict[str, Any]:
    """Build a pattern-type memory record."""
    summary = f"Successful pattern: {pattern}"
    return build_record(task, summary, sources, tags, 'pattern')

def build_incident_record(task: str, incident: str, sources: List[str], tags: List[str]) -> Dict[str, Any]:
    """Build an incident-type memory record."""
    summary = f"Incident: {incident}"
    return build_record(task, summary, sources, tags, 'incident')

def build_mapping_record(task: str, mapping: str, sources: List[str], tags: List[str]) -> Dict[str, Any]:
    """Build a mapping-type memory record."""
    summary = f"Mapping discovered: {mapping}"
    return build_record(task, summary, sources, tags, 'mapping')

# Schema constants for external reference
SCHEMA_VERSION = "1.0"
REQUIRED_FIELDS = ['id', 'type', 'summary', 'sources', 'date', 'tags']
OPTIONAL_FIELDS = ['confidence', 'task']