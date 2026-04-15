from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query

from app.services.job_history import list_runs, get_run

router = APIRouter()


@router.get("/runs")
def route_list_runs(
    limit: int = Query(default=50, ge=1, le=500),
    user_id: Optional[str] = Header(None),
):
    """List recent generation/slicing runs, optionally scoped to the current user."""
    return {"runs": list_runs(limit=limit, user_id=user_id)}


@router.get("/runs/{run_id}")
def route_get_run(run_id: str, user_id: Optional[str] = Header(None)):
    """Get one run record for reproducibility and comparison."""
    record = get_run(run_id=run_id, user_id=user_id)
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")
    return record
