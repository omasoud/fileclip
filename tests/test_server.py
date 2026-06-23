from fastapi.testclient import TestClient

from fileclip.server import LaunchConfig, create_app


def test_index_serves_static_app_shell() -> None:
    client = TestClient(create_app())

    response = client.get("/")

    assert response.status_code == 200
    assert "FileClip" in response.text
    assert response.headers["content-type"].startswith("text/html")


def test_static_assets_are_served() -> None:
    client = TestClient(create_app())

    response = client.get("/static/app.js")

    assert response.status_code == 200
    assert "FILECLIP/1:" in response.text


def test_plain_config_is_served_without_passphrase() -> None:
    client = TestClient(create_app(LaunchConfig()))

    response = client.get("/config.json")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"app": "fileclip", "schema": 1, "mode": "plain"}


def test_encrypted_config_contains_passphrase_and_is_not_cacheable() -> None:
    client = TestClient(create_app(LaunchConfig(passphrase="secret")))

    response = client.get("/config.json")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "app": "fileclip",
        "schema": 1,
        "mode": "encrypted",
        "passphrase": "secret",
    }


def test_server_has_no_file_upload_routes() -> None:
    app = create_app()
    mutating_methods = {"POST", "PUT", "PATCH"}

    for route in app.routes:
        methods = getattr(route, "methods", set()) or set()
        assert methods.isdisjoint(mutating_methods)
