from typing import Any, Dict, List

from app.services.utils import TEMPLATES_DIR

TEMPLATE_METADATA: Dict[str, Dict[str, Any]] = {
    "cube_template.scad.j2": {
        "id": "cube",
        "name": "Parametric Cube",
        "geometry": "Cube",
        "dimensions": "Edge 20-150 mm",
        "description": "Dial precise cube dimensions, add chamfers, and export calibration blocks instantly.",
        "parameters": ["CUBE_SIZE"],
        "tags": ["Beginner", "Stable"],
    },
    "cylinder_template.scad.j2": {
        "id": "cylinder",
        "name": "Cylinder",
        "geometry": "Cylinder",
        "dimensions": "Ø 10-120 mm",
        "description": "Generate adapters, lids, and spacers with pitch-aware walls ready for printing.",
        "parameters": ["HEIGHT", "DIAMETER", "SEGMENTS"],
        "tags": ["Mechanical", "Reusable"],
    },
    "pyramid_template.scad.j2": {
        "id": "pyramid",
        "name": "Pyramid",
        "geometry": "Pyramid",
        "dimensions": "Base 25-200 mm",
        "description": "Architectural studies with tunable base sizes and apex heights for quick demos.",
        "parameters": ["BASE_SIZE", "HEIGHT"],
        "tags": ["Showcase", "Advanced"],
    },
    "threaded_nut_bolt_template.scad.j2": {
        "id": "threaded_nut_bolt",
        "name": "Threaded Nut + Bolt Pair",
        "geometry": "Multi-part Mechanical",
        "dimensions": "M6-M24 class, pitch-aware",
        "description": "Generate a matched bolt and nut pair from bolt-driven parameters only.",
        "parameters": [
            "BOLT_LENGTH",
            "THREAD_MAJOR_DIAMETER",
            "THREAD_PITCH",
            "THREAD_DEPTH",
            "HEAD_HEIGHT",
            "HEAD_FLAT_DIAMETER",
            "SEGMENTS",
        ],
        "tags": ["Mechanical", "Advanced", "Multi-part"],
    },
    "box_template.scad.j2": {
        "id": "box",
        "name": "Parametric Box",
        "geometry": "Rectangular Prism",
        "dimensions": "W/L/D 20-200 mm",
        "description": "Create rectangular boxes with independent width, length, and depth values.",
        "parameters": ["WIDTH", "LENGTH", "DEPTH"],
        "tags": ["Beginner", "Utility"],
    },
    "nozzle_adapter_template.scad.j2": {
        "id": "nozzle_adapter",
        "name": "Nozzle Adapter",
        "geometry": "Tapered Hollow Cylinder",
        "dimensions": "Length + dual diameters",
        "description": "Hollow adapter with start diameter, tapered middle third, and end diameter.",
        "parameters": ["DIAMETER_START", "DIAMETER_END", "LENGTH"],
        "tags": ["Mechanical", "Adapter"],
    },
    "hook_template.scad.j2": {
        "id": "hook",
        "name": "Wall Hook",
        "geometry": "Wall-Mounted Hook",
        "dimensions": "Height + reach + thickness",
        "description": "Generate a wall-mounted hook with a screw-hole backplate and reinforced arm.",
        "parameters": ["HOOK_HEIGHT", "HOOK_REACH", "THICKNESS"],
        "tags": ["Utility", "Beginner"],
    },
    "gear_template.scad.j2": {
        "id": "gear",
        "name": "Spur Gear",
        "geometry": "Involute Gear",
        "dimensions": "Teeth + module + angle + thickness",
        "description": "Generate a printable spur gear using tooth count, module, pressure angle, and thickness.",
        "parameters": ["TEETH_COUNT", "MODULE", "PRESSURE_ANGLE", "THICKNESS"],
        "tags": ["Mechanical", "Advanced"],
    },
    "hinge_template.scad.j2": {
        "id": "hinge",
        "name": "Customizable Hinge",
        "geometry": "Interleaved Barrel Hinge (Multi-part)",
        "dimensions": "Pin + length + knuckles",
        "description": "Generate a hinge body and matching pin as separate multi-part outputs.",
        "parameters": ["PIN_DIAMETER", "LEAF_LENGTH", "KNUCKLE_COUNT"],
        "tags": ["Mechanical", "Utility", "Multi-part"],
    },
    "threaded_container_template.scad.j2": {
        "id": "threaded_container",
        "name": "Threaded Container",
        "geometry": "Container + Cap",
        "dimensions": "Diameter + pitch + wall + height",
        "description": "Generate a threaded container body and matching cap from four core parameters.",
        "parameters": ["DIAMETER", "PITCH", "WALL_THICKNESS", "HEIGHT"],
        "tags": ["Mechanical", "Utility", "Container"],
    },
    "spiral_vase_template.scad.j2": {
        "id": "spiral_vase",
        "name": "Spiral Vase",
        "geometry": "Twisted Vase",
        "dimensions": "Twist + height + radius curve",
        "description": "Generate a twisted vase silhouette with wave-shaped radius control and closed base.",
        "parameters": ["TWIST", "HEIGHT", "RADIUS_CURVE"],
        "tags": ["Decorative", "Advanced"],
    },
    "phone_stand_template.scad.j2": {
        "id": "phone_stand",
        "name": "Phone Stand",
        "geometry": "Desk Stand",
        "dimensions": "Width + thickness + height",
        "description": "Generate a sturdy angled desk stand with front lip and slanted back support.",
        "parameters": ["PHONE_WIDTH", "PHONE_THICKNESS", "STAND_HEIGHT"],
        "tags": ["Utility", "Beginner"],
    },
    "ring_template.scad.j2": {
        "id": "ring",
        "name": "Parametric Ring",
        "geometry": "Torus Ring",
        "dimensions": "Inner Ø 16.5-24.6 mm (US sizes 4-14)",
        "description": "Generate custom rings by inner diameter and band width. Supports all common US ring sizes.",
        "parameters": ["inner_diameter", "band_width", "ring_height"],
        "tags": ["Jewelry", "Beginner", "Accessory"],
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
