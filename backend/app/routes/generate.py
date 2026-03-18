from typing import Any, Dict, Optional
from io import BytesIO
import zipfile

from fastapi import APIRouter, HTTPException, Response, Header
from pydantic import BaseModel, Field

from app.services.stl_generator import generate_stl, generate_multi_part_stls
from app.services.user_template_generator import generate_stl_from_scad_code, validate_scad_code
from app.services.template_catalog import get_template_metadata


class GenerateRequest(BaseModel):
    template_id: Optional[str] = Field(None, description="Template identifier or file name")
    params: Dict[str, Any] = Field(default_factory=dict)
    user_id: Optional[str] = Field(None, description="User ID for user templates")
    scad_code: Optional[str] = Field(None, description="Pre-generated SCAD code (from user template execution)")
    multi_part: bool = Field(
        default=False,
        description="When true, generates one STL per part selector value and returns a ZIP.",
    )
    parts: list[str] = Field(
        default_factory=list,
        description="Part selector values, e.g. [bolt, nut].",
    )
    part_selector_param: str = Field(
        default="PART_MODE",
        description="Template parameter used as part selector.",
    )


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
        if payload.multi_part:
            raise HTTPException(
                status_code=400,
                detail="multi_part is currently supported only with template_id",
            )

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

    if payload.multi_part:
        if not payload.parts:
            raise HTTPException(status_code=400, detail="parts is required when multi_part=true")

        try:
            stl_paths = generate_multi_part_stls(
                template["file"],
                payload.params,
                payload.parts,
                payload.part_selector_param,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate multiple STLs: {str(e)}")

        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for stl_path in stl_paths:
                zf.writestr(stl_path.name, stl_path.read_bytes())

        zip_name = f"{template['id']}-stls.zip"
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
        )
    
    stl_path = generate_stl(template["file"], payload.params)
    return Response(content=stl_path.read_bytes(), media_type="model/stl")