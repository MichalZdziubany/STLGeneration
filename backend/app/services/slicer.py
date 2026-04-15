import uuid
import subprocess
import json
import re
import os
import shutil
from pathlib import Path
from typing import Dict, Any, Optional, List, Set

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


def _resolve_curaengine_binary() -> str:
    """Resolve the CuraEngine executable path reliably inside container/runtime."""
    explicit = os.getenv("CURA_ENGINE_BIN")
    if explicit:
        explicit_path = Path(explicit)
        if explicit_path.exists() and explicit_path.is_file():
            return str(explicit_path)

    candidates = [
        Path("/opt/CuraEngine/build/Release/CuraEngine"),
        Path("/opt/CuraEngine/build/CuraEngine"),
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return str(candidate)

    discovered = shutil.which("CuraEngine")
    if discovered:
        return discovered

    raise FileNotFoundError(
        "CuraEngine executable not found. Set CURA_ENGINE_BIN or ensure CuraEngine is installed in the backend container."
    )


def _split_path_list(value: Optional[str]) -> List[Path]:
    if not value:
        return []
    return [Path(part.strip()).expanduser() for part in value.split(os.pathsep) if part.strip()]


def _get_definition_dirs() -> List[Path]:
    """
    Resolve all directories that may contain Cura machine definitions.

    Search order prefers user/downstream definitions before the bundled resources,
    so custom downloaded printers can override base names when needed.
    """
    paths: List[Path] = []

    # Optional explicit directories containing .def.json files.
    paths.extend(_split_path_list(os.getenv("CURA_DEFINITIONS_DIRS")))

    # Optional resource roots where each root contains a definitions/ folder.
    for root in _split_path_list(os.getenv("CURA_USER_RESOURCES")):
        paths.append(root / "definitions")

    # Common Cura user resource locations by platform.
    home = Path.home()
    for root in (
        home / ".local" / "share" / "cura",
        home / ".config" / "cura",
        home / "AppData" / "Roaming" / "cura",
    ):
        if root.exists() and root.is_dir():
            for entry in root.iterdir():
                if not entry.is_dir():
                    continue
                definitions_dir = entry / "definitions"
                if definitions_dir.exists() and definitions_dir.is_dir():
                    paths.append(definitions_dir)

    # Bundled Cura resources (used as baseline/fallback).
    paths.append(DEFINITIONS_DIR)

    deduped: List[Path] = []
    seen: Set[str] = set()
    for raw_path in paths:
        p = raw_path.expanduser()
        key = str(p)
        if key in seen:
            continue
        seen.add(key)
        if p.exists() and p.is_dir():
            deduped.append(p)

    return deduped


def _build_definition_index() -> Dict[str, Path]:
    """
    Build a definition-name to file-path index from all known definitions directories.
    """
    index: Dict[str, Path] = {}
    for directory in _get_definition_dirs():
        for def_path in sorted(directory.glob("*.def.json")):
            # Keep first match to preserve search priority.
            index.setdefault(def_path.name, def_path)
    return index


def _normalize_definition_name(name: str) -> str:
    name = name.strip()
    if name.endswith(".def.json"):
        return name
    return f"{name}.def.json"


def _resolve_definition_path(definition_name: str, definition_index: Dict[str, Path]) -> Optional[Path]:
    return definition_index.get(_normalize_definition_name(definition_name))


def _to_float(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned == "":
            return None

        # Keep only the first numeric token (e.g. "220", "220.0", "220mm").
        match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
        if not match:
            return None

        try:
            return float(match.group(0))
        except ValueError:
            return None

    return None


def _resolve_inherited_override_value(
    definition_name: str,
    key: str,
    definition_index: Dict[str, Path],
) -> Any:
    """
    Resolve a Cura setting value from a definition, following its inheritance chain.
    """
    visited: Set[str] = set()
    current_name = _normalize_definition_name(definition_name)

    while current_name and current_name not in visited:
        visited.add(current_name)
        current_path = _resolve_definition_path(current_name, definition_index)
        if not current_path:
            break

        current_json = _load_json(current_path)
        if not current_json:
            break

        value = _get_override_value(current_json, key, None)
        if value is not None:
            return value

        inherits = current_json.get("inherits")
        if not isinstance(inherits, str) or not inherits.strip():
            break

        current_name = _normalize_definition_name(inherits)

    return None


def _extract_machine_dimension(
    definition_name: str,
    key: str,
    definition_index: Dict[str, Path],
) -> Optional[float]:
    value = _resolve_inherited_override_value(definition_name, key, definition_index)
    return _to_float(value)


def _normalize_printer_name(file_name: str, def_json: Dict[str, Any]) -> str:
    for candidate in (
        def_json.get("name"),
        def_json.get("metadata", {}).get("name"),
        def_json.get("metadata", {}).get("machine_name"),
    ):
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()

    return file_name.replace(".def.json", "").replace("_", " ").title()


def list_printers() -> List[Dict[str, Any]]:
    """
    List Cura printer definitions discovered from the installed Cura resources.

    Returns only definitions that expose machine width/depth/height values.
    """
    printers: List[Dict[str, Any]] = []

    definition_index = _build_definition_index()
    if not definition_index:
        return printers

    ignored_files = {
        "fdmprinter.def.json",
        "fdmextruder.def.json",
        "fdmprinter_errata.def.json",
        "fdmextruder_errata.def.json",
    }

    for def_name in sorted(definition_index.keys()):
        if def_name in ignored_files:
            continue

        def_path = definition_index[def_name]

        def_json = _load_json(def_path)
        if not def_json:
            continue

        width = _extract_machine_dimension(def_name, "machine_width", definition_index)
        depth = _extract_machine_dimension(def_name, "machine_depth", definition_index)
        height = _extract_machine_dimension(def_name, "machine_height", definition_index)

        if width is None or depth is None or height is None:
            continue

        printers.append(
            {
                "id": def_path.name,
                "name": _normalize_printer_name(def_path.name, def_json),
                "definition": def_path.name,
                "build_volume": {
                    "width": width,
                    "depth": depth,
                    "height": height,
                },
            }
        )

    return printers


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


def _sanitize_gcode_comment_value(value: Any) -> str:
    return str(value).replace("\r", " ").replace("\n", " ").strip()


def _build_applied_settings_block(
    profile: str,
    printer_definition: str,
    settings: Dict[str, Any],
) -> str:
    """
    Build a deterministic G-code header block so applied preset values are visible
    in the exported file and critical machine settings are explicitly set.
    """
    lines = [
        "; --- APPLIED SLICER PRESET START ---",
        f"; profile={_sanitize_gcode_comment_value(profile)}",
        f"; printer_definition={_sanitize_gcode_comment_value(printer_definition)}",
    ]

    for key in sorted(settings.keys()):
        value = settings[key]
        lines.append(f"; setting.{key}={_sanitize_gcode_comment_value(value)}")

    nozzle_temp = _to_float(
        settings.get("material_print_temperature_layer_0", settings.get("material_print_temperature"))
    )
    bed_temp = _to_float(
        settings.get("material_bed_temperature_layer_0", settings.get("material_bed_temperature"))
    )
    print_speed = _to_float(settings.get("speed_print", settings.get("print_speed")))

    if nozzle_temp is not None:
        rounded_nozzle = int(round(nozzle_temp))
        lines.append(f"M104 S{rounded_nozzle}")
        lines.append(f"M109 S{rounded_nozzle}")

    if bed_temp is not None:
        rounded_bed = int(round(bed_temp))
        lines.append(f"M140 S{rounded_bed}")
        lines.append(f"M190 S{rounded_bed}")

    if print_speed is not None and print_speed > 0:
        lines.append(f"G1 F{int(round(print_speed * 60.0))}")

    lines.append("; --- APPLIED SLICER PRESET END ---")
    return "\n".join(lines) + "\n"


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
    definition_index = _build_definition_index()
    printer_def_path = _resolve_definition_path(printer_definition, definition_index)
    base_def_path = _resolve_definition_path("fdmprinter.def.json", definition_index)
    # Ender-3 V3 KE uses this extruder definition in Cura 5.11
    extruder_def_path = EXTRUDERS_DIR / "creality_base_extruder_0.def.json"
    # Parent extruder definition referenced by the machine extruder
    # Note: base fdmextruder is located under definitions in Cura resources
    fdm_extruder_base_path = _resolve_definition_path("fdmextruder.def.json", definition_index)

    # Sanity checks for all needed files (exclude .inst.cfg quality which isn't JSON)
    for p in (base_def_path, printer_def_path, fdm_extruder_base_path, extruder_def_path):
        if not p or not p.exists():
            raise FileNotFoundError(f"Required definition file not found: {p}")

    # Build CuraEngine command with *all* definitions
    cura_engine_bin = _resolve_curaengine_binary()
    command = [
        cura_engine_bin,
        "slice",
        "-v",
        # Load base printer and base extruder first, then specific extruder, then printer
        "-j", str(base_def_path),
        "-j", str(fdm_extruder_base_path),
        "-j", str(extruder_def_path),
        "-j", str(printer_def_path),
        "-o", str(gcode_path),
    ]
    
    # CuraEngine 5.12 introduces derived settings (e.g., roofing/flooring_*),
    # which are normally computed in the Cura frontend and provided via -r.
    # If your profiles already define these, you can remove these fallbacks.
    final_settings.setdefault("roofing_layer_count", 0)
    final_settings.setdefault("flooring_layer_count", 0)
    # Required by some machine definitions during gcode export.
    final_settings.setdefault("initial_extruder_nr", 0)

    # Keep initial layer height aligned with selected preset unless caller sets it.
    if "layer_height" in final_settings and "layer_height_0" not in final_settings:
        final_settings["layer_height_0"] = final_settings["layer_height"]

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

    # Load the model after settings so per-slice overrides are applied.
    command.extend(["-l", str(stl_path)])
    
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
        
        # Post-process: Replace start-script placeholder and stamp applied settings
        try:
            with open(gcode_path, 'r', encoding='utf-8', errors='ignore') as f:
                gcode_text = f.read()
            
            temp = int(final_settings.get("material_print_temperature_layer_0", 200))
            modified = gcode_text.replace(
                "M109 S{material_print_temperature_layer_0}",
                f"M109 S{temp}"
            )

            marker = "; --- APPLIED SLICER PRESET START ---"
            if marker not in modified:
                applied_block = _build_applied_settings_block(
                    profile=profile,
                    printer_definition=printer_definition,
                    settings=final_settings,
                )
                modified = applied_block + modified
            
            if modified != gcode_text:
                with open(gcode_path, 'w', encoding='utf-8') as f:
                    f.write(modified)
        except Exception:
            pass
        
        return gcode_path
        
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "").strip()
        stdout = (e.stdout or "").strip()
        details = stderr or stdout or "No output from CuraEngine"
        raise RuntimeError(
            f"CuraEngine slicing failed (exit code {e.returncode}). Command: {' '.join(command)}. Output: {details}"
        )


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

    profiles.sort(
        key=lambda p: (
            p.get("metadata", {}).get("guided_order", 999),
            p.get("name", "").lower(),
        )
    )
    
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
