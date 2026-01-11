import os
import shutil
import importlib
import importlib.util
from pathlib import Path

import pytest


def _has_module(name: str) -> bool:
    spec = importlib.util.find_spec(name)
    return spec is not None


@pytest.mark.parametrize(
    "template_name,params",
    [
        ("cube_template.scad.j2", {"CUBE_SIZE": 20, "CENTERED": False}),
        # You can add more templates as needed, e.g. cylinder:
        # ("cylinder_template.scad.j2", {"HEIGHT": 20, "DIAMETER": 15, "CENTERED": False, "SEGMENTS": 64}),
    ],
)
def test_generate_stl_succeeds(tmp_path: Path, template_name: str, params: dict):
    """Generate STL from a template and verify outputs exist and are non-empty.

    Skips if OpenSCAD CLI or Jinja2 isn't available in the environment.
    """
    # Environment guards
    if not _has_module("jinja2"):
        pytest.skip("Jinja2 is not installed; skipping STL generation test.")

    openscad_bin = shutil.which("openscad")
    if openscad_bin is None:
        pytest.skip("OpenSCAD CLI not found; skipping STL generation test.")

    # Import the generator from the backend package
    stl_gen = importlib.import_module("backend.app.services.stl_generator")

    # Redirect jobs dir to a temp path for isolated testing
    stl_gen.JOBS_DIR = tmp_path

    # Generate STL
    stl_path = stl_gen.generate_stl(template_name, params)

    # Basic validations
    assert stl_path.exists(), "STL file was not created"
    assert stl_path.suffix == ".stl", "Output file does not have .stl extension"

    # Non-trivial size check (binary STL header is 84 bytes; a cube should be > 200 bytes)
    size = stl_path.stat().st_size
    assert size > 200, f"STL file seems too small (size={size} bytes)"

    # Check that the corresponding SCAD source was rendered
    scad_path = stl_path.with_suffix(".scad")
    assert scad_path.exists(), "SCAD source file was not created"
    scad_text = scad_path.read_text(encoding="utf-8")
    assert len(scad_text) > 10, "SCAD file appears empty"
