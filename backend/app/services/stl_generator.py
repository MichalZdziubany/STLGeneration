import uuid
import subprocess
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
import os

host_jobs_path = os.path.abspath("/app/jobs")

JOBS_DIR = Path("/app/jobs")
TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "templates"

env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))

def generate_stl(template_name: str, params: dict):
    job_id = str(uuid.uuid4())

    # 1. Render SCAD
    scad_path = JOBS_DIR / f"{job_id}.scad"
    template = env.get_template(template_name)
    scad_path.write_text(template.render(**params))

    # 2. Run OpenSCAD in container
    subprocess.run([
        "docker", "run", "--rm",
        "-v", f"{host_jobs_path}:/data",
        "openscad-cli",
        "-o", f"/data/{job_id}.stl",
        f"/data/{job_id}.scad"
    ], check=True)

    # 3. Return STL path
    return JOBS_DIR / f"{job_id}.stl"