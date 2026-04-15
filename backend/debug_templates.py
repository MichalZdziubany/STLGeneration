#!/usr/bin/env python
import sys
sys.path.insert(0, '/app')

from app.services.template_catalog import list_templates, TEMPLATES_DIR

print(f"TEMPLATES_DIR: {TEMPLATES_DIR}")
print(f"TEMPLATES_DIR exists: {TEMPLATES_DIR.exists()}")

# List files in directory
if TEMPLATES_DIR.exists():
    files = list(TEMPLATES_DIR.glob("*.scad.j2"))
    print(f"\nFiles found by glob: {len(files)}")
    for f in sorted(files):
        print(f"  - {f.name}")

# Test list_templates
templates = list_templates()
print(f"\nTemplates from list_templates(): {len(templates)}")
for t in templates:
    print(f"  - {t['id']}: {t['name']}")
