"""
Firebase Firestore helpers for template management.

Templates collection structure:
{
  "templates": {
    "{userId}": {
      "{templateId}": {
        "name": string,
        "description": string,
        "isPublic": boolean,
        "tags": [string],
        "createdAt": timestamp,
        "updatedAt": timestamp,
        "userId": string,
        "jsFile": string  // relative path
      }
    }
  }
}
"""

from typing import List, Dict, Any
from datetime import datetime


def firebase_template_to_dict(template_data: Dict[str, Any]) -> Dict[str, Any]:
    """Convert Firebase document to template dict."""
    return {
        "id": template_data.get("id"),
        "userId": template_data.get("userId"),
        "name": template_data.get("name"),
        "description": template_data.get("description"),
        "isPublic": template_data.get("isPublic", False),
        "tags": template_data.get("tags", []),
        "createdAt": template_data.get("createdAt"),
        "updatedAt": template_data.get("updatedAt"),
        "jsFile": template_data.get("jsFile"),
    }


def dict_to_firebase_template(template: Dict[str, Any]) -> Dict[str, Any]:
    """Convert template dict to Firebase document format."""
    return {
        "id": template.get("id"),
        "userId": template.get("userId"),
        "name": template.get("name"),
        "description": template.get("description"),
        "isPublic": template.get("isPublic", False),
        "tags": template.get("tags", []),
        "createdAt": template.get("createdAt", datetime.utcnow().isoformat()),
        "updatedAt": template.get("updatedAt", datetime.utcnow().isoformat()),
        "jsFile": template.get("jsFile"),
    }


# Example structure for initialization
FIRESTORE_INIT_DATA = {
    "templates": {
        # Each user has a document with their templates
        # Example:
        # "user-123": {
        #     "template-abc": {
        #         "name": "My Cube",
        #         "description": "...",
        #         "isPublic": False,
        #         "tags": ["custom"],
        #         "createdAt": "2024-01-01...",
        #         "userId": "user-123",
        #         "jsFile": "user-123/template-abc/template.js"
        #     }
        # }
    }
}


def create_firestore_template_doc(
    user_id: str,
    template_id: str,
    name: str,
    description: str,
    is_public: bool,
    tags: List[str],
    js_file_path: str,
) -> Dict[str, Any]:
    """Create a Firestore template document structure."""
    return {
        "id": template_id,
        "userId": user_id,
        "name": name,
        "description": description,
        "isPublic": is_public,
        "tags": tags,
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
        "jsFile": js_file_path,
    }
