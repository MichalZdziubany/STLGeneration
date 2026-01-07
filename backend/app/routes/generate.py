from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from app.services.stl_generator import generate_stl
from app.services.template_catalog import get_template_metadata


class GenerateRequest(BaseModel):
    template_id: str = Field(..., description="Template identifier or file name")
    params: Dict[str, Any] = Field(default_factory=dict)


router = APIRouter()


@router.post("/generate-stl")
def route_generate_stl(payload: GenerateRequest):
    template = get_template_metadata(payload.template_id)

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    stl_path = generate_stl(template["file"], payload.params)
    return Response(content=stl_path.read_bytes(), media_type="model/stl")