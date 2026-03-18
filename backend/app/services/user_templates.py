import json
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

from app.services.utils import JOBS_DIR


USER_TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "user_templates"


def _atomic_write_json(path: Path, data: Dict[str, Any]) -> None:
    """Atomically write JSON to avoid partial reads while listing templates."""
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    tmp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp_path.replace(path)


def ensure_user_template_dir(user_id: str) -> Path:
    """Create user template directory if it doesn't exist."""
    user_dir = USER_TEMPLATES_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    return user_dir


def save_user_template(
    user_id: str,
    js_content: str,
    template_name: str,
    description: str,
    parameters: List[Dict[str, Any]],
    is_public: bool = False,
    tags: List[str] = None,
) -> Dict[str, Any]:
    """
    Save a user-provided template file and metadata.
    
    Returns the template metadata object.
    """
    if tags is None:
        tags = []
    
    template_id = str(uuid.uuid4())[:8]  # Short ID for URLs
    user_dir = ensure_user_template_dir(user_id)
    template_dir = user_dir / template_id
    template_dir.mkdir(parents=True, exist_ok=True)
    
    # Save the template file as .scad.j2
    template_file_path = template_dir / "template.scad.j2"
    template_file_path.write_text(js_content, encoding="utf-8")
    
    # Create and save metadata
    metadata = {
        "id": template_id,
        "userId": user_id,
        "name": template_name,
        "description": description,
        "parameters": parameters,
        "isPublic": is_public,
        "tags": tags,
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
        "file": "template.scad.j2",
    }
    
    metadata_path = template_dir / "metadata.json"
    _atomic_write_json(metadata_path, metadata)
    
    return metadata


def get_user_templates(user_id: str) -> List[Dict[str, Any]]:
    """Get all templates for a user."""
    user_dir = USER_TEMPLATES_DIR / user_id
    if not user_dir.exists():
        return []
    
    templates = []
    for template_dir in sorted(user_dir.iterdir()):
        if template_dir.is_dir():
            metadata_path = template_dir / "metadata.json"
            if metadata_path.exists():
                try:
                    with open(metadata_path, "r") as f:
                        metadata = json.load(f)
                        # Normalize parameters to match built-in template format
                        # Convert from [{"name": "x", "type": "number", ...}] to ["x", "y", "z"]
                        if "parameters" in metadata and isinstance(metadata["parameters"], list):
                            if metadata["parameters"] and isinstance(metadata["parameters"][0], dict):
                                metadata["parameters"] = [p["name"] for p in metadata["parameters"]]
                        templates.append(metadata)
                except Exception:
                    pass
    
    return templates


def get_public_templates() -> List[Dict[str, Any]]:
    """Get all public templates from all users."""
    public_templates = []
    
    if not USER_TEMPLATES_DIR.exists():
        return []
    
    for user_dir in USER_TEMPLATES_DIR.iterdir():
        if user_dir.is_dir():
            for template_dir in user_dir.iterdir():
                if template_dir.is_dir():
                    metadata_path = template_dir / "metadata.json"
                    if metadata_path.exists():
                        try:
                            with open(metadata_path, "r") as f:
                                metadata = json.load(f)
                                if metadata.get("isPublic", False):
                                    # Normalize parameters to match built-in template format
                                    if "parameters" in metadata and isinstance(metadata["parameters"], list):
                                        if metadata["parameters"] and isinstance(metadata["parameters"][0], dict):
                                            metadata["parameters"] = [p["name"] for p in metadata["parameters"]]
                                    public_templates.append(metadata)
                        except Exception:
                            pass
    
    return public_templates


def get_user_template_metadata(user_id: str, template_id: str) -> Optional[Dict[str, Any]]:
    """Get metadata for a single user template."""
    metadata_path = USER_TEMPLATES_DIR / user_id / template_id / "metadata.json"
    if not metadata_path.exists():
        return None

    try:
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
    except Exception:
        return None

    if "parameters" in metadata and isinstance(metadata["parameters"], list):
        if metadata["parameters"] and isinstance(metadata["parameters"][0], dict):
            metadata["parameters"] = [p["name"] for p in metadata["parameters"]]

    return metadata


def get_template_content(user_id: str, template_id: str) -> Optional[str]:
    """Get the template file content for a user template."""
    template_dir = USER_TEMPLATES_DIR / user_id / template_id
    template_file = template_dir / "template.scad.j2"
    
    if template_file.exists():
        return template_file.read_text(encoding="utf-8")
    
    return None


def delete_user_template(user_id: str, template_id: str) -> bool:
    """Delete a user template (only owner can delete)."""
    template_dir = USER_TEMPLATES_DIR / user_id / template_id
    
    if template_dir.exists():
        import shutil
        try:
            shutil.rmtree(template_dir)
            return True
        except Exception:
            return False
    
    return False


def update_template_metadata(
    user_id: str,
    template_id: str,
    **updates
) -> Optional[Dict[str, Any]]:
    """Update metadata for a template (only owner can update)."""
    metadata_path = USER_TEMPLATES_DIR / user_id / template_id / "metadata.json"
    
    if not metadata_path.exists():
        return None
    
    try:
        with open(metadata_path, "r") as f:
            metadata = json.load(f)
        
        # Update allowed fields
        allowed_fields = {"name", "description", "tags", "isPublic"}
        for key, value in updates.items():
            if key in allowed_fields:
                metadata[key] = value
        
        metadata["updatedAt"] = datetime.utcnow().isoformat()
        
        _atomic_write_json(metadata_path, metadata)
        
        # Normalize parameters before returning
        if "parameters" in metadata and isinstance(metadata["parameters"], list):
            if metadata["parameters"] and isinstance(metadata["parameters"][0], dict):
                metadata["parameters"] = [p["name"] for p in metadata["parameters"]]
        
        return metadata
    except Exception:
        return None
