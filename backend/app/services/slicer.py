import uuid
import subprocess
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional

JOBS_DIR = Path("/app/jobs")
SETTINGS_DIR = Path(__file__).resolve().parents[1] / "settings"

# Resolve Cura resources root from environment, defaulting to /opt/cura-resources
def _get_cura_resources_root() -> Path:
    root = os.getenv("CURA_RESOURCES", "/opt/cura-resources")
    return Path(root)

# Definitions live under resources/definitions in official Cura repo
DEFINITIONS_DIR = _get_cura_resources_root() / "definitions"
# Extruders live under resources/extruders
EXTRUDERS_DIR = _get_cura_resources_root() / "extruders"
# Quality profiles (inst.cfg) live under resources/quality
# Note: CuraEngine expects JSON definition/resolved settings via -j/-r.
#       .inst.cfg files are NOT JSON and cannot be passed to -j directly.
QUALITY_DIR = _get_cura_resources_root() / "quality"


def _load_json(path: Path) -> Dict[str, Any]:
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return {}

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


def _compute_safe_start_gcode(printer_def_path: Path, final_settings: Dict[str, Any]) -> str:
    """
    Compute a bed-aware purge line sequence that stays within bounds
    whether the printer uses center-zero or front-left origin.
    """
    def_json = _load_json(printer_def_path)

    # Fallbacks if not explicitly overridden in machine definition
    width = float(_get_override_value(def_json, "machine_width", 220))
    depth = float(_get_override_value(def_json, "machine_depth", 220))

    # Margins to keep purge inside the printable area
    margin_x = 2.0
    margin_y = 20.0

    # Always assume front-left origin to avoid negative X on printers like Ender-3 V3 KE
    x1 = margin_x
    x2 = margin_x + 0.4
    y_front = margin_y
    y_back = depth - margin_y

    # Use explicit first-layer temperature to avoid unresolved variables
    first_layer_temp = int(final_settings.get("material_print_temperature_layer_0", 215))

    start_gcode = (
        "M220 S100 ;Reset Feedrate\n"
        "M221 S100 ;Reset Flowrate\n\n"
        "G28 ;Home\n\n"
        "G92 E0 ;Reset Extruder\n"
        "G1 Z2.0 F3000 ;Move Z Axis up\n"
        f"G1 X{x1:.2f} Y{y_front:.2f} Z0.28 F5000.0 ;Move to start position (inside bed)\n"
        f"M109 S{first_layer_temp} ;Heat to first-layer temp\n"
        f"G1 X{x1:.2f} Y{y_back:.2f} Z0.28 F1500.0 E15 ;First purge line\n"
        f"G1 X{x2:.2f} Y{y_back:.2f} Z0.28 F5000.0 ;Move to side a little\n"
        f"G1 X{x2:.2f} Y{y_front:.2f} Z0.28 F1500.0 E30 ;Second purge line\n"
        "G92 E0 ;Reset Extruder\n"
        "G1 E-1 F1800 ;Retract a bit\n"
        "G1 Z2.0 F3000 ;Move Z Axis up\n"
        "G1 E0 F1800\n"
    )
    return start_gcode


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
    # To avoid zero-byte G-code when no resolved settings are provided, set minimal defaults.
    final_settings.setdefault("roofing_layer_count", 0)
    final_settings.setdefault("flooring_layer_count", 0)

    # Remove brim/skirt unless explicitly requested by user
    if "adhesion_type" not in user_overrides:
        final_settings["adhesion_type"] = "none"
    if "brim_line_count" not in user_overrides:
        final_settings["brim_line_count"] = 0
    if "skirt_line_count" not in user_overrides:
        final_settings["skirt_line_count"] = 0

    # Increase default speeds for a faster machine unless user specified
    if "speed_infill" not in user_overrides:
        final_settings["speed_infill"] = 120
    if "speed_wall_0" not in user_overrides:
        final_settings["speed_wall_0"] = 60
    if "speed_wall_x" not in user_overrides:
        final_settings["speed_wall_x"] = 120
    if "speed_travel" not in user_overrides:
        final_settings["speed_travel"] = 200

    # Safe in-bed purge line; avoid unresolved variables from Cura frontend
    final_settings.setdefault("material_print_temperature_layer_0", 215)
    # Ensure front-left origin to prevent negative coordinates
    if "machine_center_is_zero" not in user_overrides:
        final_settings["machine_center_is_zero"] = False
    # Force our safe start gcode unless the user explicitly provided one
    if "machine_start_gcode" not in user_overrides:
        final_settings["machine_start_gcode"] = _compute_safe_start_gcode(printer_def_path, final_settings)

    # Add settings overrides as -s parameters
    # The definition file provides all required defaults
    for key, value in final_settings.items():
        if isinstance(value, str):
            safe_val = value.replace("\n", "\\n")
        else:
            safe_val = value
        command.extend(["-s", f"{key}={safe_val}"])
    
    # Set environment variable for CuraEngine to find definitions, materials, quality profiles
    resources_root = _get_cura_resources_root()
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
        
        # Best-effort post-processing: fix start purge to be in-bounds and resolve temp
        try:
            with open(gcode_path, 'r', encoding='utf-8', errors='ignore') as f:
                gcode_text = f.read()

            # Load machine definition to get dimensions
            def_json = _load_json(printer_def_path)
            machine_depth = float(_get_override_value(def_json, 'machine_depth', 220))
            temp0 = str(final_settings.get('material_print_temperature_layer_0', 215))

            safe_start = (
                "M220 S100 ;Reset Feedrate\n"
                "M221 S100 ;Reset Flowrate\n\n"
                "G28 ;Home\n\n"
                "G92 E0 ;Reset Extruder\n"
                "G1 Z2.0 F3000 ;Move Z Axis up\n"
                "G1 X2.0 Y20 Z0.28 F5000.0 ;Move to start position (inside bed)\n"
                f"M109 S{temp0} ;Heat to first-layer temp\n"
                f"G1 X2.0 Y{max(20.0, machine_depth - 20.0):.1f} Z0.28 F1500.0 E15 ;First purge line\n"
                f"G1 X2.4 Y{max(20.0, machine_depth - 20.0):.1f} Z0.28 F5000.0 ;Move to side a little\n"
                "G1 X2.4 Y20 Z0.28 F1500.0 E30 ;Second purge line\n"
                "G92 E0 ;Reset Extruder\n"
                "G1 E-1 F1800 ;Retract a bit\n"
                "G1 Z2.0 F3000 ;Move Z Axis up\n"
                "G1 E0 F1800\n"
            )

            # Direct replacements to avoid pattern mismatch across Cura versions
            new_text = gcode_text
            y_back = f"{max(20.0, machine_depth - 20.0):.1f}"
            new_text = new_text.replace(
                "G1 X-2.0 Y20 Z0.28 F5000.0 ;Move to start position",
                "G1 X2.0 Y20 Z0.28 F5000.0 ;Move to start position (inside bed)"
            )
            new_text = new_text.replace(
                "M109 S{material_print_temperature_layer_0}",
                f"M109 S{temp0}"
            )
            new_text = new_text.replace(
                "G1 X-2.0 Y145.0 Z0.28 F1500.0 E15 ;Draw the first line",
                f"G1 X2.0 Y{y_back} Z0.28 F1500.0 E15 ;First purge line"
            )
            new_text = new_text.replace(
                "G1 X-1.7 Y145.0 Z0.28 F5000.0 ;Move to side a little",
                f"G1 X2.4 Y{y_back} Z0.28 F5000.0 ;Move to side a little"
            )
            new_text = new_text.replace(
                "G1 X-1.7 Y20 Z0.28 F1500.0 E30 ;Draw the second line",
                "G1 X2.4 Y20 Z0.28 F1500.0 E30 ;Second purge line"
            )

            if new_text != gcode_text:
                with open(gcode_path, 'w', encoding='utf-8') as f:
                    f.write(new_text)

            # Second pass: remove any SKIRT sections entirely if present
            try:
                lines = new_text.splitlines()
                cleaned = []
                in_skirt = False
                for line in lines:
                    if line.startswith(';TYPE:SKIRT'):
                        in_skirt = True
                        continue
                    if in_skirt:
                        # End skirt when next type or new layer begins
                        if line.startswith(';TYPE:') or line.startswith(';LAYER:'):
                            in_skirt = False
                            cleaned.append(line)
                        # Skip skirt line
                        continue
                    cleaned.append(line)
                final_text = '\n'.join(cleaned)
                if final_text != new_text:
                    with open(gcode_path, 'w', encoding='utf-8') as f:
                        f.write(final_text)
            except Exception:
                pass
        except Exception:
            # If anything goes wrong, return original file
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
