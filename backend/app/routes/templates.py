from fastapi import APIRouter

from app.services.template_catalog import list_templates

router = APIRouter()


@router.get("/templates")
def get_templates():
    return {"templates": list_templates()}
