import uuid
import subprocess
import re
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

from app.services.utils import JOBS_DIR as DEFAULT_JOBS_DIR, TEMPLATES_DIR, normalize_values

# Allow tests to override at module level
JOBS_DIR = DEFAULT_JOBS_DIR

env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))


def _safe_suffix(value: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip())
    return sanitized[:48] or "part"


def generate_stl(template_name: str, params: dict):
    job_id = str(uuid.uuid4())

    # Convert Python booleans to lowercase strings for OpenSCAD
    scad_params = normalize_values(params, bool_to_lower=True, skip_none=False, skip_empty_str=False)

    # 1. Render SCAD
    scad_path = JOBS_DIR / f"{job_id}.scad"
    template = env.get_template(template_name)
    scad_path.write_text(template.render(**scad_params))

    # 2. Run OpenSCAD CLI directly inside container
    stl_path = JOBS_DIR / f"{job_id}.stl"
    subprocess.run(
        [
            "openscad",
            "-o",
            str(stl_path),
            str(scad_path),
        ],
        check=True,
    )

    return stl_path


def generate_multi_part_stls(
    template_name: str,
    params: dict,
    parts: list[str],
    selector_param: str = "PART_MODE",
) -> list[Path]:
    """
    Render multiple STLs from one template by overriding a selector parameter.

    Example: selector_param=PART_MODE and parts=["bolt", "nut"].
    """
    template = env.get_template(template_name)
    stl_paths: list[Path] = []

    base_params = normalize_values(
        params,
        bool_to_lower=True,
        skip_none=False,
        skip_empty_str=False,
    )

    for part_name in parts:
        job_id = str(uuid.uuid4())
        safe_part = _safe_suffix(part_name)

        scad_params = dict(base_params)
        scad_params[selector_param] = part_name

        scad_path = JOBS_DIR / f"{job_id}-{safe_part}.scad"
        scad_path.write_text(template.render(**scad_params))

        stl_path = JOBS_DIR / f"{job_id}-{safe_part}.stl"
        subprocess.run(
            [
                "openscad",
                "-o",
                str(stl_path),
                str(scad_path),
            ],
            check=True,
        )

        stl_paths.append(stl_path)

    return stl_paths