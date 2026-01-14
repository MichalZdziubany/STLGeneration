import uuid
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, Optional

from app.services.utils import (
    JOBS_DIR,
    SETTINGS_DIR,
    get_cura_resources_root,
    load_json,
    normalize_values,
)

# Definitions live under resources/definitions in official Cura repo
DEFINITIONS_DIR = get_cura_resources_root() / "definitions"
# Extruders live under resources/extruders
EXTRUDERS_DIR = get_cura_resources_root() / "extruders"
# Quality profiles (inst.cfg) live under resources/quality
# Note: CuraEngine expects JSON definition/resolved settings via -j/-r.
#       .inst.cfg files are NOT JSON and cannot be passed to -j directly.
QUALITY_DIR = get_cura_resources_root() / "quality"
QUALITY_DIR = get_cura_resources_root() / "quality"


def _load_json(path: Path) -> Dict[str, Any]:
    # Backward-compatible wrapper (use shared util)
    return load_json(path)

def _get_override_value(def_json: Dict[str, Any], name: str, default: Any) -> Any:
    """
    Read a setting's override value from a Cura machine definition JSON.
    Falls back to default if not present.
    """
    overrides = def_json.get("overrides", {})
    if name in overrides:
        entry = overrides[name]
        # Cura defs may use either 'value' or 'default_value'
        if isinstance(entry, dict):
            if "value" in entry:
                return entry["value"]
            if "default_value" in entry:
                return entry["default_value"]
    return default


def load_settings_profile(profile_name: str = "balanced_profile") -> Dict[str, Any]:
    """
    Load a slicing settings profile from JSON file.
    
    Args:
        profile_name: Name of the profile (without .json extension)
        
    Returns:
        Dictionary of settings
    """
    profile_path = SETTINGS_DIR / f"{profile_name}.json"
    
    if not profile_path.exists():
        raise FileNotFoundError(f"Settings profile not found: {profile_name}")
    
    with open(profile_path, 'r') as f:
        profile_data = json.load(f)
    
    return profile_data.get("settings", {})


def merge_settings(base_settings: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge user overrides with base settings profile.
    
    Args:
        base_settings: Base settings from profile
        overrides: User-provided overrides
        
    Returns:
        Merged settings dictionary
    """
    merged = base_settings.copy()
    if overrides:
        merged.update(overrides)
    return merged


def normalize_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
    # Use shared normalizer
    return normalize_values(settings, bool_to_lower=True, skip_none=True, skip_empty_str=True)


def slice_stl_to_gcode(
    stl_path: Path,
    settings: Optional[Dict[str, Any]] = None,
    profile: str = "balanced_profile"
) -> Path:
    """
    Slice an STL file to G-code using CuraEngine with a printer definition and settings profile.
    
    Args:
        stl_path: Path to the input STL file
        settings: Optional user settings to override profile defaults
        profile: Name of the settings profile to use
        
    Returns:
        Path to the generated G-code file
    """
    job_id = stl_path.stem  # Use same job ID as the STL
    gcode_path = JOBS_DIR / f"{job_id}.gcode"
    
    # Load base profile settings
    try:
        profile_data = get_profile_settings(profile)
        base_settings = profile_data.get("settings", {})
        # Prefer profile-specific printer definition if provided
        printer_definition = profile_data.get("metadata", {}).get(
            "printer_definition",
            "creality_ender3v3ke.def.json",
        )
    except FileNotFoundError:
        # Fallback to Cura official Ender 3 V3 KE if no local profile
        base_settings = {}
        printer_definition = "creality_ender3v3ke.def.json"
    
    # Merge with user overrides
    user_overrides = settings or {}
    final_settings = merge_settings(base_settings, user_overrides)
    
    # Normalize settings (remove None/empty values, convert booleans)
    final_settings = normalize_settings(final_settings)
    
    # Resolve definition stack for this printer
    printer_def_path = DEFINITIONS_DIR / printer_definition
    base_def_path = DEFINITIONS_DIR / "fdmprinter.def.json"
    # Ender-3 V3 KE uses this extruder definition in Cura 5.11
    extruder_def_path = EXTRUDERS_DIR / "creality_base_extruder_0.def.json"
    # Parent extruder definition referenced by the machine extruder
    # Note: base fdmextruder is located under definitions in Cura resources
    fdm_extruder_base_path = DEFINITIONS_DIR / "fdmextruder.def.json"

    # Sanity checks for all needed files (exclude .inst.cfg quality which isn't JSON)
    for p in (base_def_path, printer_def_path, fdm_extruder_base_path, extruder_def_path):
        if not p.exists():
            raise FileNotFoundError(f"Required definition file not found: {p}")

    # Build CuraEngine command with *all* definitions
    command = [
        "CuraEngine",
        "slice",
        "-v",
        # Load base printer and base extruder first, then specific extruder, then printer
        "-j", str(base_def_path),
        "-j", str(fdm_extruder_base_path),
        "-j", str(extruder_def_path),
        "-j", str(printer_def_path),
        "-o", str(gcode_path),
        "-l", str(stl_path),
    ]
    
    # CuraEngine 5.12 introduces derived settings (e.g., roofing/flooring_*),
    # which are normally computed in the Cura frontend and provided via -r.
    # If your profiles already define these, you can remove these fallbacks.
    final_settings.setdefault("roofing_layer_count", 0)
    final_settings.setdefault("flooring_layer_count", 0)

    # Add settings overrides as -s parameters
    # The definition file provides all required defaults
    for key, value in final_settings.items():
        if isinstance(value, bool):
            safe_val = str(value).lower()
        elif isinstance(value, str):
            safe_val = value.replace("\n", "\\n")
        else:
            safe_val = str(value)
        command.extend(["-s", f"{key}={safe_val}"])
    
    # Set environment variable for CuraEngine to find definitions, materials, quality profiles
    resources_root = get_cura_resources_root()
    env = {
        **subprocess.os.environ,
        "CURA_ENGINE_SEARCH_PATH": str(resources_root),
    }
    
    try:
        # Run CuraEngine with custom environment
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            env=env
        )
        
        if not gcode_path.exists():
            raise FileNotFoundError(f"G-code file not generated: {gcode_path}")
        
        # Post-process: Replace temperature placeholder in start G-code
        try:
            with open(gcode_path, 'r', encoding='utf-8', errors='ignore') as f:
                gcode_text = f.read()
            
            temp = int(final_settings.get("material_print_temperature_layer_0", 200))
            modified = gcode_text.replace(
                "M109 S{material_print_temperature_layer_0}",
                f"M109 S{temp}"
            )
            
            if modified != gcode_text:
                with open(gcode_path, 'w', encoding='utf-8') as f:
                    f.write(modified)
        except Exception:
            pass
        
        return gcode_path
        
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"CuraEngine slicing failed: {e.stderr}")


def slice_model(
    template_name: str,
    params: Dict[str, Any],
    slice_settings: Optional[Dict[str, Any]] = None,
    profile: str = "balanced_profile"
) -> tuple[Path, Path]:
    """
    Generate STL from template and slice it to G-code.
    
    Args:
        template_name: Name of the template file
        params: Template parameters
        slice_settings: Optional settings to override profile
        profile: Name of the settings profile to use
        
    Returns:
        Tuple of (stl_path, gcode_path)
    """
    from app.services.stl_generator import generate_stl
    
    # Generate STL first
    stl_path = generate_stl(template_name, params)
    
    # Slice to G-code
    gcode_path = slice_stl_to_gcode(stl_path, slice_settings, profile)
    
    return stl_path, gcode_path


def list_settings_profiles() -> list[Dict[str, Any]]:
    """
    List all available settings profiles.
    
    Returns:
        List of profile metadata
    """
    profiles = []
    
    if not SETTINGS_DIR.exists():
        return profiles
    
    for profile_file in SETTINGS_DIR.glob("*.json"):
        try:
            with open(profile_file, 'r') as f:
                profile_data = json.load(f)
            
            profiles.append({
                "id": profile_file.stem,
                "name": profile_data.get("name", profile_file.stem),
                "description": profile_data.get("description", ""),
                "metadata": profile_data.get("metadata", {}),
                "file": profile_file.name
            })
        except Exception:
            continue
    
    return profiles


def get_profile_settings(profile_name: str) -> Dict[str, Any]:
    """
    Get the full settings from a profile.
    
    Args:
        profile_name: Name of the profile
        
    Returns:
        Dictionary containing profile data
    """
    profile_path = SETTINGS_DIR / f"{profile_name}.json"
    
    if not profile_path.exists():
        raise FileNotFoundError(f"Settings profile not found: {profile_name}")
    
    with open(profile_path, 'r') as f:
        return json.load(f)
