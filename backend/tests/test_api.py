"""Backend tests — auth, users, channels, messages."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="session")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.anyio
async def test_demo_credentials(client):
    r = await client.get("/demo-credentials")
    assert r.status_code == 200
    data = r.json()
    assert len(data["accounts"]) == 4
    assert data["accounts"][0]["email"] == "demo@withoutborder.app"


@pytest.mark.anyio
async def test_register_and_login(client):
    import random
    suffix = random.randint(1000, 9999)
    # Register
    r = await client.post("/api/v1/auth/register", json={
        "email": f"test{suffix}@test.com",
        "username": f"testuser{suffix}",
        "password": "test1234",
        "preferred_language": "en",
    })
    assert r.status_code == 201
    tokens = r.json()
    assert "access_token" in tokens

    # Login
    r = await client.post("/api/v1/auth/login", json={
        "email": f"test{suffix}@test.com",
        "password": "test1234",
    })
    assert r.status_code == 200
    assert "access_token" in r.json()

    # Get me
    access = r.json()["access_token"]
    r = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert r.json()["username"] == f"testuser{suffix}"


@pytest.mark.anyio
async def test_login_wrong_password(client):
    r = await client.post("/api/v1/auth/login", json={"email": "nobody@test.com", "password": "wrong"})
    assert r.status_code == 401


@pytest.mark.anyio
async def test_protected_route_no_token(client):
    r = await client.get("/api/v1/users/me")
    assert r.status_code == 403  # No credentials


@pytest.mark.anyio
async def test_create_channel(client):
    # Login as demo user
    r = await client.post("/api/v1/auth/login", json={
        "email": "demo@withoutborder.app", "password": "demo1234"
    })
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create channel
    r = await client.post("/api/v1/channels", json={
        "name": "test-channel", "type": "team", "member_ids": []
    }, headers=headers)
    assert r.status_code == 201
    assert r.json()["name"] == "test-channel"


@pytest.mark.anyio
async def test_list_channels(client):
    r = await client.post("/api/v1/auth/login", json={
        "email": "demo@withoutborder.app", "password": "demo1234"
    })
    token = r.json()["access_token"]
    r = await client.get("/api/v1/channels", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)
