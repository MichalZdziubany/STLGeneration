from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from app.services.slicer import (
    slice_stl_to_gcode, 
    slice_model, 
    list_settings_profiles,
    get_profile_settings
)
from app.services.template_catalog import get_template_metadata
from pathlib import Path


class SliceRequest(BaseModel):
    template_id: str = Field(..., description="Template identifier or file name")
    params: Dict[str, Any] = Field(default_factory=dict, description="Template parameters")
    slice_settings: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Slicing settings to override profile defaults"
    )
    profile: str = Field(
        default="balanced_profile",
        description="Settings profile to use (default: balanced_profile)"
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


router = APIRouter()


@router.post("/slice")
def route_slice_model(payload: SliceRequest):
    """
    Generate an STL from a template and slice it to G-code using a settings profile.
    Returns the G-code file.
    """
    template = get_template_metadata(payload.template_id)

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    try:
        stl_path, gcode_path = slice_model(
            template["file"],
            payload.params,
            payload.slice_settings,
            payload.profile
        )
        
        return Response(
            content=gcode_path.read_bytes(),
            media_type="text/plain",
            headers={
                "Content-Disposition": f'attachment; filename="{gcode_path.name}"'
            }
        )
    except Exception as e:
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
        gcode_path = slice_stl_to_gcode(
            stl_path, 
            payload.slice_settings,
            payload.profile
        )
        
        return Response(
            content=gcode_path.read_bytes(),
            media_type="text/plain",
            headers={
                "Content-Disposition": f'attachment; filename="{gcode_path.name}"'
            }
        )
    except Exception as e:
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
