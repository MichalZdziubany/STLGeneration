from pathlib import Path


def test_record_list_get_runs(monkeypatch, tmp_path: Path):
    import app.services.job_history as history

    history_file = tmp_path / "run_history.jsonl"
    monkeypatch.setattr(history, "HISTORY_FILE", history_file)

    first = history.record_run({"user_id": "u1", "operation": "generate_stl"})
    second = history.record_run({"user_id": "u2", "operation": "slice"})

    all_runs = history.list_runs(limit=10)
    assert len(all_runs) == 2
    assert all_runs[0]["id"] in {first["id"], second["id"]}

    filtered = history.list_runs(limit=10, user_id="u1")
    assert len(filtered) == 1
    assert filtered[0]["user_id"] == "u1"

    fetched = history.get_run(first["id"])
    assert fetched is not None
    assert fetched["id"] == first["id"]

    missing = history.get_run("does-not-exist")
    assert missing is None
