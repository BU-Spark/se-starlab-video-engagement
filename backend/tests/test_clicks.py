from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.db import get_supabase
from app.main import app


class FakeSupabase:
    """Stands in for the Supabase client and records what was inserted."""

    def __init__(self):
        self.inserted = None

    def table(self, name):
        self.table_name = name
        return self

    def insert(self, row):
        self.inserted = row
        return self

    def execute(self):
        return SimpleNamespace(data=[{"id": 1, "created_at": "2026-10-10T18:46:15+00:00", **self.inserted}])


def test_create_click_stores_timestamp():
    fake = FakeSupabase()
    app.dependency_overrides[get_supabase] = lambda: fake
    try:
        response = TestClient(app).post("/clicks", json={"clicked_at": "2026-10-10T18:46:14.123Z"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert fake.table_name == "button_clicks"
    assert fake.inserted == {"clicked_at": "2026-10-10T18:46:14.123000+00:00"}
    assert response.json()["id"] == 1


def test_create_click_rejects_timestamp_without_timezone():
    app.dependency_overrides[get_supabase] = lambda: FakeSupabase()
    try:
        response = TestClient(app).post("/clicks", json={"clicked_at": "2026-10-10T18:46:14"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
