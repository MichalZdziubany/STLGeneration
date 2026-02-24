from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Response, Header
from pydantic import BaseModel, Field

from app.services.stl_generator import generate_stl
from app.services.user_template_generator import generate_stl_from_scad_code, validate_scad_code
from app.services.template_catalog import get_template_metadata


class GenerateRequest(BaseModel):
    template_id: Optional[str] = Field(None, description="Template identifier or file name")
    params: Dict[str, Any] = Field(default_factory=dict)
    user_id: Optional[str] = Field(None, description="User ID for user templates")
    scad_code: Optional[str] = Field(None, description="Pre-generated SCAD code (from user template execution)")


router = APIRouter()


@router.post("/generate-stl")
def route_generate_stl(
    payload: GenerateRequest,
    user_id: Optional[str] = Header(None),
):
    """Generate STL from either built-in template or pre-generated SCAD code."""
    
    # Use user_id from header if not in payload
    final_user_id = payload.user_id or user_id
    
    # If SCAD code is provided, use it directly
    if payload.scad_code:
        # Validate SCAD code
        is_valid, validation_msg = validate_scad_code(payload.scad_code)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid SCAD code: {validation_msg}")
        
        # Generate STL from SCAD code
        stl_path = generate_stl_from_scad_code(payload.scad_code, payload.params)
        
        if stl_path and stl_path.exists():
            return Response(content=stl_path.read_bytes(), media_type="model/stl")
        
        raise HTTPException(status_code=500, detail="Failed to generate STL from SCAD code")
    
    # Otherwise use template_id (built-in templates)
    if not payload.template_id:
        raise HTTPException(status_code=400, detail="Either template_id or scad_code is required")
    
    template = get_template_metadata(payload.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    stl_path = generate_stl(template["file"], payload.params)
    return Response(content=stl_path.read_bytes(), media_type="model/stl")