import uuid
import subprocess
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

JOBS_DIR = Path("/app/jobs")
TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates"

env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))


def generate_stl(template_name: str, params: dict):
    job_id = str(uuid.uuid4())

    # Convert Python booleans to lowercase strings for OpenSCAD
    scad_params = {}
    for key, value in params.items():
        if isinstance(value, bool):
            scad_params[key] = str(value).lower()
        else:
            scad_params[key] = value

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