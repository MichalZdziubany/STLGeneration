import os
import json
from pathlib import Path
from typing import Any, Dict

# Shared directories
JOBS_DIR = Path("/app/jobs")
TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates"
SETTINGS_DIR = Path(__file__).resolve().parents[1] / "settings"


def get_cura_resources_root() -> Path:
    """Resolve Cura resources root from environment, defaulting to /opt/cura-resources."""
    root = os.getenv("CURA_RESOURCES", "/opt/cura-resources")
    return Path(root)


def load_json(path: Path) -> Dict[str, Any]:
    """Best-effort JSON loader returning empty dict on error."""
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def normalize_values(
    data: Dict[str, Any],
    *,
    bool_to_lower: bool = True,
    skip_none: bool = True,
    skip_empty_str: bool = True,
) -> Dict[str, Any]:
    """
    Normalize a dictionary by:
    - Converting booleans to lowercase strings
    - Optionally skipping None values
    - Optionally skipping empty strings
    """
    normalized: Dict[str, Any] = {}
    for key, value in data.items():
        if skip_none and value is None:
            continue
        if skip_empty_str and isinstance(value, str) and value.strip() == "":
            continue
        if bool_to_lower and isinstance(value, bool):
            value = str(value).lower()
        normalized[key] = value
    return normalized
