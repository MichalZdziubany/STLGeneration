from fastapi import APIRouter, Response
from app.services.stl_generator import generate_stl

router = APIRouter()

@router.post("/generate-stl")
def route_generate_stl(params: dict):
    stl_path = generate_stl("cube_template.scad.j2", params)
    return Response(content=stl_path.read_bytes(), media_type="model/stl")