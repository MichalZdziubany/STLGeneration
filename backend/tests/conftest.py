from fastapi.testclient import TestClient

from app.main import app


# Shared API client fixture for route-level tests.
def _create_client() -> TestClient:
    return TestClient(app)


import pytest


@pytest.fixture
def client() -> TestClient:
    return _create_client()
