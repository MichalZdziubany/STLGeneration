import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

from app.services.utils import JOBS_DIR

HISTORY_FILE = JOBS_DIR / "run_history.jsonl"
_HISTORY_LOCK = Lock()


def _ensure_history_file() -> None:
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not HISTORY_FILE.exists():
        HISTORY_FILE.touch()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def record_run(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Persist a run record as one JSON line and return the saved record."""
    _ensure_history_file()

    record = {
        "id": str(uuid.uuid4()),
        "created_at": _utc_now_iso(),
        **entry,
    }

    with _HISTORY_LOCK:
        with open(HISTORY_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=True) + "\n")

    return record


def _read_all_runs() -> List[Dict[str, Any]]:
    _ensure_history_file()
    records: List[Dict[str, Any]] = []

    with _HISTORY_LOCK:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    parsed = json.loads(line)
                    if isinstance(parsed, dict):
                        records.append(parsed)
                except Exception:
                    continue

    return records


def list_runs(limit: int = 50, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    records = _read_all_runs()

    if user_id:
        records = [r for r in records if r.get("user_id") == user_id]

    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return records[: max(1, min(limit, 500))]


def get_run(run_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    for record in _read_all_runs():
        if record.get("id") != run_id:
            continue
        if user_id and record.get("user_id") != user_id:
            continue
        return record
    return None
