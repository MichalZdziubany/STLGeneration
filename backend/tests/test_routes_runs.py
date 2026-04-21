def test_runs_list_and_get(client, monkeypatch):
    import app.routes.runs as runs_route

    sample = {
        "id": "run-1",
        "user_id": "u1",
        "operation": "generate_stl",
        "created_at": "2026-01-01T00:00:00Z",
    }

    monkeypatch.setattr(runs_route, "list_runs", lambda limit=50, user_id=None: [sample])
    monkeypatch.setattr(runs_route, "get_run", lambda run_id, user_id=None: sample if run_id == "run-1" else None)

    list_response = client.get("/runs")
    assert list_response.status_code == 200
    assert list_response.json() == {"runs": [sample]}

    get_response = client.get("/runs/run-1")
    assert get_response.status_code == 200
    assert get_response.json() == sample


def test_runs_get_404_when_missing(client, monkeypatch):
    import app.routes.runs as runs_route

    monkeypatch.setattr(runs_route, "get_run", lambda run_id, user_id=None: None)

    response = client.get("/runs/missing")
    assert response.status_code == 404
    assert response.json()["detail"] == "Run not found"
