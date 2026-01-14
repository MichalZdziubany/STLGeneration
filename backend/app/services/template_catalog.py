from typing import Any, Dict, List

from app.services.utils import TEMPLATES_DIR

TEMPLATE_METADATA: Dict[str, Dict[str, Any]] = {
    "cube_template.scad.j2": {
        "id": "cube",
        "name": "Parametric Cube",
        "geometry": "Cube",
        "dimensions": "Edge 20-150 mm",
        "description": "Dial precise cube dimensions, add chamfers, and export calibration blocks instantly.",
        "parameters": ["CUBE_SIZE", "CENTERED"],
        "tags": ["Beginner", "Stable"],
    },
    "cylinder_template.scad.j2": {
        "id": "cylinder",
        "name": "Threaded Cylinder",
        "geometry": "Cylinder",
        "dimensions": "Ø 10-120 mm",
        "description": "Generate adapters, lids, and spacers with pitch-aware walls ready for printing.",
        "parameters": ["HEIGHT", "DIAMETER", "SEGMENTS"],
        "tags": ["Mechanical", "Reusable"],
    },
    "pyramid_template.scad.j2": {
        "id": "pyramid",
        "name": "Lightweight Pyramid",
        "geometry": "Pyramid",
        "dimensions": "Base 25-200 mm",
        "description": "Architectural studies with tunable base sizes and apex heights for quick demos.",
        "parameters": ["BASE_SIZE", "HEIGHT", "CENTERED"],
        "tags": ["Showcase", "Advanced"],
    },
}


def list_templates() -> List[Dict[str, Any]]:
    templates: List[Dict[str, Any]] = []

    for template_file in sorted(TEMPLATES_DIR.glob("*.scad.j2")):
        metadata = TEMPLATE_METADATA.get(template_file.name, {})
        templates.append(
            {
                "id": metadata.get("id", template_file.stem.replace("_template", "")),
                "name": metadata.get("name", template_file.stem.replace("_", " ").title()),
                "geometry": metadata.get("geometry", "Custom"),
                "dimensions": metadata.get("dimensions", ""),
                "description": metadata.get(
                    "description",
                    "Customize parameters and export STL + G-code instantly.",
                ),
                "parameters": metadata.get("parameters", []),
                "tags": metadata.get("tags", []),
                "file": template_file.name,
            }
        )

    return templates


def get_template_metadata(template_id: str) -> Dict[str, Any] | None:
    normalized_id = template_id.strip().lower()

    for template in list_templates():
        candidates = {
            template["id"].lower(),
            template["file"].lower(),
            template["file"].replace(".scad.j2", "").lower(),
        }

        if normalized_id in candidates:
            return template

    return None
