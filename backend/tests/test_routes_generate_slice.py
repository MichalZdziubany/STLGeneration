from pathlib import Path


def test_generate_stl_requires_template_or_scad(client):
    response = client.post("/generate-stl", json={"params": {}})
    assert response.status_code == 400
    assert "Either template_id or scad_code" in response.json()["detail"]


def test_generate_stl_template_not_found(client):
    response = client.post("/generate-stl", json={"template_id": "does-not-exist", "params": {}})
    assert response.status_code == 404
    assert response.json()["detail"] == "Template not found"


def test_generate_stl_scad_validation_failure(client, monkeypatch):
    import app.routes.generate as generate_route

    monkeypatch.setattr(generate_route, "validate_scad_code", lambda _code: (False, "bad pattern"))

    response = client.post("/generate-stl", json={"scad_code": "cube(10);", "params": {}})
    assert response.status_code == 400
    assert "Invalid SCAD code" in response.json()["detail"]


def test_generate_stl_success_with_template(client, monkeypatch, tmp_path: Path):
    import app.routes.generate as generate_route

    stl_path = tmp_path / "fake.stl"
    stl_path.write_bytes(b"solid fake\nendsolid fake\n")

    monkeypatch.setattr(
        generate_route,
        "get_template_metadata",
        lambda _template_id: {"id": "cube", "file": "cube_template.scad.j2"},
    )
    monkeypatch.setattr(generate_route, "generate_stl", lambda _file, _params: stl_path)

    recorded = []
    monkeypatch.setattr(generate_route, "record_run", lambda payload: recorded.append(payload))

    response = client.post("/generate-stl", json={"template_id": "cube", "params": {"CUBE_SIZE": 20}})

    assert response.status_code == 200
    assert response.content == stl_path.read_bytes()
    assert recorded, "Expected run history to be recorded"


def test_slice_requires_template_or_scad(client):
    response = client.post("/slice", json={"params": {}})
    assert response.status_code == 400
    assert "Either template_id or scad_code" in response.json()["detail"]


def test_slice_template_not_found(client):
    response = client.post("/slice", json={"template_id": "does-not-exist", "params": {}})
    assert response.status_code == 404
    assert response.json()["detail"] == "Template not found"


def test_slice_success_with_template(client, monkeypatch, tmp_path: Path):
    import app.routes.slice as slice_route

    stl_path = tmp_path / "fake.stl"
    gcode_path = tmp_path / "fake.gcode"
    stl_path.write_bytes(b"solid fake\nendsolid fake\n")
    gcode_path.write_text(";gcode\nG1 X1 Y1\n", encoding="utf-8")

    monkeypatch.setattr(
        slice_route,
        "get_template_metadata",
        lambda _template_id: {"id": "cube", "file": "cube_template.scad.j2"},
    )
    monkeypatch.setattr(slice_route, "slice_model", lambda *_args, **_kwargs: (stl_path, gcode_path))

    recorded = []
    monkeypatch.setattr(slice_route, "record_run", lambda payload: recorded.append(payload))

    response = client.post("/slice", json={"template_id": "cube", "params": {"CUBE_SIZE": 20}})

    assert response.status_code == 200
    assert response.text.startswith(";gcode")
    assert recorded, "Expected run history to be recorded"


def test_slice_applies_material_preset(client, monkeypatch, tmp_path: Path):
    import app.routes.slice as slice_route

    stl_path = tmp_path / "fake.stl"
    gcode_path = tmp_path / "fake.gcode"
    stl_path.write_bytes(b"solid fake\nendsolid fake\n")
    gcode_path.write_text(";gcode\nG1 X1 Y1\n", encoding="utf-8")

    captured = {}

    monkeypatch.setattr(
        slice_route,
        "get_template_metadata",
        lambda _template_id: {"id": "cube", "file": "cube_template.scad.j2"},
    )

    def fake_slice_model(_file, _params, slice_settings, _profile):
        captured["slice_settings"] = slice_settings
        return stl_path, gcode_path

    monkeypatch.setattr(slice_route, "slice_model", fake_slice_model)

    response = client.post(
        "/slice",
        json={
            "template_id": "cube",
            "params": {"CUBE_SIZE": 20},
            "material_preset": "pla",
            "slice_settings": {"adhesion_type": "brim"},
        },
    )

    assert response.status_code == 200
    assert captured["slice_settings"]["adhesion_type"] == "brim"
    assert captured["slice_settings"]["material_print_temperature"] == 205


def test_materials_endpoint(client):
    response = client.get("/materials")

    assert response.status_code == 200
    payload = response.json()
    assert payload["materials"][0]["id"] == "preset"
    assert any(material["id"] == "pla" for material in payload["materials"])


def test_profiles_and_printers_endpoints(client, monkeypatch):
    import app.routes.slice as slice_route

    monkeypatch.setattr(slice_route, "list_settings_profiles", lambda: [{"id": "balanced_profile"}])
    monkeypatch.setattr(slice_route, "list_printers", lambda: [{"id": "ender3", "name": "Ender 3"}])
    monkeypatch.setattr(slice_route, "list_material_presets", lambda: [{"id": "preset"}])

    profiles_response = client.get("/profiles")
    printers_response = client.get("/printers")
    materials_response = client.get("/materials")

    assert profiles_response.status_code == 200
    assert profiles_response.json() == {"profiles": [{"id": "balanced_profile"}]}

    assert printers_response.status_code == 200
    assert printers_response.json() == {"printers": [{"id": "ender3", "name": "Ender 3"}]}

    assert materials_response.status_code == 200
    assert materials_response.json() == {"materials": [{"id": "preset"}]}
