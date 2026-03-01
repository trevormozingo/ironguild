"""
Schema loader and validator.

Loads JSON Schema files from the models/ directory and validates
data against them. This is the ONLY place validation rules live —
the schemas are the single source of truth.
"""

import json
import os
from pathlib import Path
from typing import Any

from jsonschema import Draft7Validator, FormatChecker, ValidationError
from jsonschema.validators import RefResolver

_format_checker = FormatChecker()


# Resolve the models directory relative to this file's location.
# In the container, models/ is copied alongside src/.
_MODELS_DIR = Path(__file__).resolve().parent.parent / "models"


def _load_schema(schema_path: str) -> dict:
    """Load a JSON schema file from the models directory."""
    full_path = _MODELS_DIR / schema_path
    with open(full_path, "r") as f:
        return json.load(f)


def _build_resolver() -> RefResolver:
    """
    Build a RefResolver that can follow $ref pointers across schema files.
    The derived schemas use relative $ref like "base.schema.json#/properties/username",
    so we key the store by just the filename as well as the full URI.
    """
    profile_dir = _MODELS_DIR / "profile"
    base_schema = _load_schema("profile/base.schema.json")
    base_uri = profile_dir.as_uri() + "/"
    store = {}

    # Pre-load all schemas into the store so $ref resolution works.
    # Key by both the full file URI and the bare filename, so that
    # relative $ref like "base.schema.json" resolve correctly.
    for schema_file in profile_dir.glob("*.schema.json"):
        schema = json.loads(schema_file.read_text())
        store[schema_file.as_uri()] = schema
        store[schema_file.name] = schema

    return RefResolver(base_uri, base_schema, store=store)


# Build resolver once at import time
_resolver = _build_resolver()

# Pre-load and compile validators for each action schema
VALIDATORS = {
    "create": Draft7Validator(
        _load_schema("profile/create.schema.json"), resolver=_resolver, format_checker=_format_checker
    ),
    "update": Draft7Validator(
        _load_schema("profile/update.schema.json"), resolver=_resolver, format_checker=_format_checker
    ),
    "public": Draft7Validator(
        _load_schema("profile/public.schema.json"), resolver=_resolver, format_checker=_format_checker
    ),
    "private": Draft7Validator(
        _load_schema("profile/private.schema.json"), resolver=_resolver, format_checker=_format_checker
    ),
}


def validate(schema_name: str, data: dict[str, Any]) -> list[str]:
    """
    Validate data against a named schema.

    Args:
        schema_name: One of "create", "update", "public", "private"
        data: The dictionary to validate

    Returns:
        A list of validation error messages. Empty list means valid.
    """
    validator = VALIDATORS.get(schema_name)
    if validator is None:
        raise ValueError(f"Unknown schema: {schema_name}")

    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
    return [_format_error(e) for e in errors]


def _format_error(error: ValidationError) -> str:
    """Format a validation error into a human-readable message."""
    path = ".".join(str(p) for p in error.absolute_path)
    if path:
        return f"{path}: {error.message}"
    return error.message
