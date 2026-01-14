import uuid
import subprocess
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

from app.services.utils import JOBS_DIR as DEFAULT_JOBS_DIR, TEMPLATES_DIR, normalize_values

# Allow tests to override at module level
JOBS_DIR = DEFAULT_JOBS_DIR

env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))


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