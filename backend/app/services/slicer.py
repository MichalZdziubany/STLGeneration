import uuid
import subprocess
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional

JOBS_DIR = Path("/app/jobs")
SETTINGS_DIR = Path(__file__).resolve().parents[1] / "settings"
DEFINITIONS_DIR = SETTINGS_DIR  # Definition files are also in settings dir


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
    """
    Normalize settings by removing None/empty values and converting booleans.
    
    Args:
        settings: Raw settings dictionary
        
    Returns:
        Normalized settings dictionary
    """
    normalized = {}
    for key, value in settings.items():
        # Skip None values
        if value is None:
            continue
        # Skip empty strings
        if isinstance(value, str) and value.strip() == "":
            continue
        # Convert booleans to lowercase strings
        if isinstance(value, bool):
            value = str(value).lower()
        normalized[key] = value
    return normalized


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
        # Get printer definition from profile metadata if specified
        printer_definition = profile_data.get("metadata", {}).get("printer_definition", "ender3v3_simple.def.json")
    except FileNotFoundError:
        # Fallback to minimal defaults if profile not found
        base_settings = {}
        printer_definition = "ender3v3_simple.def.json"
    
    # Merge with user overrides
    final_settings = merge_settings(base_settings, settings or {})
    
    # Normalize settings (remove None/empty values, convert booleans)
    final_settings = normalize_settings(final_settings)
    
    # Check if printer definition file exists
    definition_path = DEFINITIONS_DIR / printer_definition
    if not definition_path.exists():
        raise FileNotFoundError(f"Printer definition file not found: {printer_definition}")
    
    # Build CuraEngine command with definition file
    # Set CURA_ENGINE_SEARCH_PATH to allow CuraEngine to find inherited definitions
    command = [
        "CuraEngine",
        "slice",
        "-v",
        "-j", str(definition_path),
        "-o", str(gcode_path),
        "-l", str(stl_path),
    ]
    
    # Add settings overrides as -s parameters
    # The definition file provides all required defaults
    for key, value in final_settings.items():
        command.extend(["-s", f"{key}={value}"])
    
    # Set environment variable for CuraEngine to find definition files
    env = {
        **subprocess.os.environ,
        "CURA_ENGINE_SEARCH_PATH": str(DEFINITIONS_DIR)
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
