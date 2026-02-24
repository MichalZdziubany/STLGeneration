from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header
from typing import Optional, List
import json

from app.services.template_catalog import list_templates
from app.services.j2_parser import extract_parameters_from_js
from app.services.user_templates import (
    save_user_template,
    get_user_templates,
    get_public_templates,
    get_template_content,
    delete_user_template,
    update_template_metadata,
)

router = APIRouter()


@router.get("/templates")
def get_templates(user_id: Optional[str] = Header(None)):
    """Get all available templates (built-in + user's + public)."""
    templates = list_templates()
    
    # Add public templates from all users
    templates.extend(get_public_templates())
    
    # If user is authenticated, add their templates
    if user_id:
        user_templates = get_user_templates(user_id)
        templates.extend(user_templates)
    
    return {"templates": templates}


@router.post("/templates/upload")
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(...),
    is_public: bool = Form(False),
    tags: str = Form(""),
    user_id: Optional[str] = Header(None),
):
    """
    Upload a new template file.
    
    - file: JavaScript file containing template code
    - name: Template name
    - description: Template description
    - is_public: Whether template is public (True/False)
    - tags: Comma-separated tags
    - user_id: Firebase user ID (passed in header)
    """
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    if not file.filename.endswith(".scad.j2"):
        raise HTTPException(status_code=400, detail="Only .scad.j2 files are supported")
    
    try:
        # Read file content
        template_content = await file.read()
        template_text = template_content.decode("utf-8")
        
        # Parse parameters from Jinja2 template
        parameters = extract_parameters_from_js(template_text)
        
        # Parse tags
        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
        
        # Save template
        template_metadata = save_user_template(
            user_id=user_id,
            js_content=template_text,
            template_name=name,
            description=description,
            parameters=parameters,
            is_public=is_public,
            tags=tag_list,
        )
        
        return {
            "success": True,
            "template": template_metadata,
            "parameters": parameters,
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/templates/{template_id}")
def get_template(template_id: str, user_id: Optional[str] = Header(None)):
    """Get template content and metadata."""
    
    # Try to get as user template
    if user_id:
        content = get_template_content(user_id, template_id)
        if content:
            templates = get_user_templates(user_id)
            metadata = next((t for t in templates if t["id"] == template_id), None)
            if metadata:
                return {"content": content, "metadata": metadata}
    
    # Try public templates
    public_templates = get_public_templates()
    metadata = next((t for t in public_templates if t["id"] == template_id), None)
    
    if metadata:
        user_id = metadata.get("userId")
        content = get_template_content(user_id, template_id)
        return {"content": content, "metadata": metadata}
    
    raise HTTPException(status_code=404, detail="Template not found")


@router.delete("/templates/{template_id}")
def delete_template(template_id: str, user_id: Optional[str] = Header(None)):
    """Delete a template (owner only)."""
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    if delete_user_template(user_id, template_id):
        return {"success": True, "message": "Template deleted"}
    
    raise HTTPException(status_code=404, detail="Template not found or permission denied")


@router.patch("/templates/{template_id}")
def update_template(
    template_id: str,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    is_public: Optional[bool] = Form(None),
    tags: Optional[str] = Form(None),
    user_id: Optional[str] = Header(None),
):
    """Update template metadata (owner only)."""
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID required")
    
    updates = {}
    if name is not None:
        updates["name"] = name
    if description is not None:
        updates["description"] = description
    if is_public is not None:
        updates["isPublic"] = is_public
    if tags is not None:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        updates["tags"] = tag_list
    
    result = update_template_metadata(user_id, template_id, **updates)
    
    if result:
        return {"success": True, "template": result}
    
    raise HTTPException(status_code=404, detail="Template not found or permission denied")
