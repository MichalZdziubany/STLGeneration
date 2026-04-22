from typing import Any, Dict, Optional
from io import BytesIO
import zipfile
import logging

from fastapi import APIRouter, HTTPException, Response, Header
from pydantic import BaseModel, Field

from app.services.slicer import (
    slice_stl_to_gcode, 
    slice_model, 
    list_settings_profiles,
    get_profile_settings,
    list_printers,
    list_material_presets,
    get_material_preset_settings,
    merge_settings,
    normalize_settings,
)
from app.services.template_catalog import get_template_metadata
from app.services.user_template_generator import generate_stl_from_scad_code, validate_scad_code
from pathlib import Path
from app.services.stl_generator import generate_multi_part_stls
from app.services.job_history import record_run


def _build_slice_repro_context(profile: str, overrides: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    try:
        profile_data = get_profile_settings(profile)
        base_settings = profile_data.get("settings", {})
        printer_definition = profile_data.get("metadata", {}).get("printer_definition")
    except FileNotFoundError:
        base_settings = {}
        printer_definition = None

    merged = merge_settings(base_settings, overrides or {})
    effective = normalize_settings(merged)

    return {
        "profile": profile,
        "slice_settings": overrides or None,
        "effective_slice_settings": effective,
        "printer_definition": printer_definition,
    }


class SliceRequest(BaseModel):
    template_id: Optional[str] = Field(None, description="Template identifier or file name")
    params: Dict[str, Any] = Field(default_factory=dict, description="Template parameters")
    slice_settings: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Slicing settings to override profile defaults"
    )
    profile: str = Field(
        default="balanced_profile",
        description="Settings profile to use (default: balanced_profile)"
    )
    material_preset: str = Field(
        default="preset",
        description="Material preset to apply on top of the quality profile",
    )
    user_id: Optional[str] = Field(None, description="User ID for user templates")
    scad_code: Optional[str] = Field(None, description="Pre-generated SCAD code (from user template execution)")
    multi_part: bool = Field(
        default=False,
        description="When true, slices one STL per part selector value and returns a ZIP.",
    )
    parts: list[str] = Field(
        default_factory=list,
        description="Part selector values, e.g. [bolt, nut].",
    )
    part_selector_param: str = Field(
        default="PART_MODE",
        description="Template parameter used as part selector.",
    )


class SliceSTLRequest(BaseModel):
    stl_filename: str = Field(..., description="STL filename in jobs directory")
    slice_settings: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Slicing settings to override profile defaults"
    )
    profile: str = Field(
        default="balanced_profile",
        description="Settings profile to use (default: balanced_profile)"
    )
    material_preset: str = Field(
        default="preset",
        description="Material preset to apply on top of the quality profile",
    )


router = APIRouter()
logger = logging.getLogger(__name__)


def _build_slice_overrides(payload: SliceRequest | SliceSTLRequest) -> Dict[str, Any]:
    overrides: Dict[str, Any] = dict(payload.slice_settings or {})
    material_settings = get_material_preset_settings(payload.material_preset)
    return merge_settings(material_settings, overrides)


@router.post("/slice")
def route_slice_model(
    payload: SliceRequest,
    user_id: Optional[str] = Header(None),
):
    """
    Generate G-code from either built-in template or pre-generated SCAD code.
    """
    
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
        if not stl_path or not stl_path.exists():
            raise HTTPException(status_code=500, detail="Failed to generate STL from SCAD code")
        
        # Then slice the STL to G-code
        try:
            merged_slice_settings = _build_slice_overrides(payload)
            repro = _build_slice_repro_context(payload.profile, merged_slice_settings)
            gcode_path = slice_stl_to_gcode(
                stl_path,
                merged_slice_settings,
                payload.profile
            )
            record_run(
                {
                    "user_id": final_user_id,
                    "operation": "slice",
                    "template_id": payload.template_id,
                    "template_file": None,
                    "template_source": "scad_code",
                    "params": payload.params,
                    "profile": repro["profile"],
                    "slice_settings": payload.slice_settings,
                    "material_preset": payload.material_preset,
                    "effective_slice_settings": repro["effective_slice_settings"],
                    "printer_definition": repro["printer_definition"],
                    "multi_part": False,
                    "parts": [],
                    "part_selector_param": payload.part_selector_param,
                    "outputs": [
                        {
                            "type": "stl",
                            "filename": stl_path.name,
                            "path": str(stl_path),
                            "size_bytes": stl_path.stat().st_size,
                        },
                        {
                            "type": "gcode",
                            "filename": gcode_path.name,
                            "path": str(gcode_path),
                            "size_bytes": gcode_path.stat().st_size,
                        },
                    ],
                }
            )
            return Response(
                content=gcode_path.read_bytes(),
                media_type="text/plain",
                headers={
                    "Content-Disposition": f'attachment; filename="{gcode_path.name}"'
                }
            )
        except Exception as e:
            logger.exception("Slicing failed for scad_code payload")
            raise HTTPException(status_code=500, detail=f"Slicing failed: {str(e)}")
    
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
            merged_slice_settings = _build_slice_overrides(payload)
            repro = _build_slice_repro_context(payload.profile, merged_slice_settings)
            stl_paths = generate_multi_part_stls(
                template["file"],
                payload.params,
                payload.parts,
                payload.part_selector_param,
            )

            gcode_paths = [
                slice_stl_to_gcode(stl_path, merged_slice_settings, payload.profile)
                for stl_path in stl_paths
            ]

            record_run(
                {
                    "user_id": final_user_id,
                    "operation": "slice",
                    "template_id": template["id"],
                    "template_file": template["file"],
                    "template_source": "template_id",
                    "params": payload.params,
                    "profile": repro["profile"],
                    "slice_settings": payload.slice_settings,
                    "material_preset": payload.material_preset,
                    "effective_slice_settings": repro["effective_slice_settings"],
                    "printer_definition": repro["printer_definition"],
                    "multi_part": True,
                    "parts": payload.parts,
                    "part_selector_param": payload.part_selector_param,
                    "outputs": [
                        {
                            "type": "stl",
                            "filename": stl_path.name,
                            "path": str(stl_path),
                            "size_bytes": stl_path.stat().st_size,
                        }
                        for stl_path in stl_paths
                    ]
                    + [
                        {
                            "type": "gcode",
                            "filename": gcode_path.name,
                            "path": str(gcode_path),
                            "size_bytes": gcode_path.stat().st_size,
                        }
                        for gcode_path in gcode_paths
                    ],
                }
            )
        except Exception as e:
            logger.exception("Slicing failed for multi_part payload")
            raise HTTPException(status_code=500, detail=f"Slicing failed: {str(e)}")

        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for gcode_path in gcode_paths:
                zf.writestr(gcode_path.name, gcode_path.read_bytes())

        zip_name = f"{template['id']}-gcodes.zip"
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
        )

    try:
        merged_slice_settings = _build_slice_overrides(payload)
        repro = _build_slice_repro_context(payload.profile, merged_slice_settings)
        stl_path, gcode_path = slice_model(
            template["file"],
            payload.params,
            merged_slice_settings,
            payload.profile
        )
        record_run(
            {
                "user_id": final_user_id,
                "operation": "slice",
                "template_id": template["id"],
                "template_file": template["file"],
                "template_source": "template_id",
                "params": payload.params,
                "profile": repro["profile"],
                "slice_settings": payload.slice_settings,
                "material_preset": payload.material_preset,
                "effective_slice_settings": repro["effective_slice_settings"],
                "printer_definition": repro["printer_definition"],
                "multi_part": False,
                "parts": [],
                "part_selector_param": payload.part_selector_param,
                "outputs": [
                    {
                        "type": "stl",
                        "filename": stl_path.name,
                        "path": str(stl_path),
                        "size_bytes": stl_path.stat().st_size,
                    },
                    {
                        "type": "gcode",
                        "filename": gcode_path.name,
                        "path": str(gcode_path),
                        "size_bytes": gcode_path.stat().st_size,
                    },
                ],
            }
        )
        
        return Response(
            content=gcode_path.read_bytes(),
            media_type="text/plain",
            headers={
                "Content-Disposition": f'attachment; filename="{gcode_path.name}"'
            }
        )
    except Exception as e:
        logger.exception("Slicing failed for template payload")
        raise HTTPException(status_code=500, detail=f"Slicing failed: {str(e)}")


@router.post("/slice-stl")
def route_slice_existing_stl(payload: SliceSTLRequest):
    """
    Slice an existing STL file to G-code using a settings profile.
    Returns the G-code file.
    """
    stl_path = Path("/app/jobs") / payload.stl_filename
    
    if not stl_path.exists():
        raise HTTPException(status_code=404, detail="STL file not found")
    
    try:
        merged_slice_settings = _build_slice_overrides(payload)
        repro = _build_slice_repro_context(payload.profile, merged_slice_settings)
        gcode_path = slice_stl_to_gcode(
            stl_path, 
            merged_slice_settings,
            payload.profile
        )

        record_run(
            {
                "user_id": None,
                "operation": "slice_stl",
                "template_id": None,
                "template_file": None,
                "template_source": "stl_file",
                "params": {"stl_filename": payload.stl_filename},
                "profile": repro["profile"],
                "slice_settings": payload.slice_settings,
                "material_preset": payload.material_preset,
                "effective_slice_settings": repro["effective_slice_settings"],
                "printer_definition": repro["printer_definition"],
                "multi_part": False,
                "parts": [],
                "part_selector_param": "PART_MODE",
                "outputs": [
                    {
                        "type": "stl",
                        "filename": stl_path.name,
                        "path": str(stl_path),
                        "size_bytes": stl_path.stat().st_size,
                    },
                    {
                        "type": "gcode",
                        "filename": gcode_path.name,
                        "path": str(gcode_path),
                        "size_bytes": gcode_path.stat().st_size,
                    },
                ],
            }
        )
        
        return Response(
            content=gcode_path.read_bytes(),
            media_type="text/plain",
            headers={
                "Content-Disposition": f'attachment; filename="{gcode_path.name}"'
            }
        )
    except Exception as e:
        logger.exception("Slicing existing STL failed")
        raise HTTPException(status_code=500, detail=f"Slicing failed: {str(e)}")


@router.get("/profiles")
def get_profiles():
    """
    List all available slicing profiles.
    """
    try:
        profiles = list_settings_profiles()
        return {"profiles": profiles}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list profiles: {str(e)}")


@router.get("/profiles/{profile_name}")
def get_profile(profile_name: str):
    """
    Get detailed settings for a specific profile.
    """
    try:
        profile_data = get_profile_settings(profile_name)
        return profile_data
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Profile not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load profile: {str(e)}")


@router.get("/printers")
def get_printers():
    """
    List discovered Cura printer definitions with build volume dimensions.
    """
    try:
        printers = list_printers()
        return {"printers": printers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list printers: {str(e)}")


@router.get("/materials")
def get_materials():
    """
    List the material presets available to the slicer UI.
    """
    try:
        materials = list_material_presets()
        return {"materials": materials}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list materials: {str(e)}")


@router.get("/slice-settings")
def get_slice_settings():
    """
    Get default slicing settings and their descriptions (deprecated - use /profiles instead).
    """
    return {
        "message": "This endpoint is deprecated. Use /profiles to list available profiles and /profiles/{name} to get profile details.",
        "defaults": {
            "layer_height": 0.2,
            "wall_thickness": 1.2,
            "infill_density": 20,
            "print_speed": 50,
            "nozzle_temp": 200,
            "bed_temp": 60
        },
        "descriptions": {
            "layer_height": "Layer height in mm (0.1-0.4)",
            "wall_thickness": "Wall thickness in mm (0.8-2.4)",
            "infill_density": "Infill density percentage (0-100)",
            "print_speed": "Print speed in mm/s (20-100)",
            "nozzle_temp": "Nozzle temperature in °C (180-260)",
            "bed_temp": "Bed temperature in °C (0-110)"
        }
    }
