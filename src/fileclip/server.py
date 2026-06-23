"""FastAPI application factory for FileClip."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from fileclip import __version__

APP_NAME = "fileclip"
SCHEMA_VERSION = 1
PLAIN_MODE = "plain"
ENCRYPTED_MODE = "encrypted"
CONFIG_CACHE_CONTROL = "no-store"


@dataclass(frozen=True)
class LaunchConfig:
    """Runtime configuration exposed to the browser app."""

    passphrase: str | None = None
    app_name: str = APP_NAME
    schema: int = SCHEMA_VERSION
    version: str = __version__

    @property
    def mode(self) -> str:
        """Return the public launch mode."""

        if self.passphrase is None:
            return PLAIN_MODE
        return ENCRYPTED_MODE

    def as_public_config(self) -> dict[str, Any]:
        """Return the JSON-safe browser launch configuration."""

        config: dict[str, Any] = {
            "app": self.app_name,
            "version": self.version,
            "schema": self.schema,
            "mode": self.mode,
        }
        if self.passphrase is not None:
            config["passphrase"] = self.passphrase
        return config


def static_dir() -> Path:
    """Return the packaged static asset directory."""

    return Path(__file__).with_name("static")


def create_app(config: LaunchConfig | None = None) -> FastAPI:
    """Create the local FileClip ASGI application."""

    launch_config = config or LaunchConfig()
    assets = static_dir()
    app = FastAPI(
        title="FileClip",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.launch_config = launch_config

    @app.get("/", include_in_schema=False)
    def index() -> FileResponse:
        """Serve the browser app shell."""

        return FileResponse(assets / "index.html", media_type="text/html")

    @app.get("/config.json", include_in_schema=False)
    def config_json() -> JSONResponse:
        """Serve launch configuration without allowing browser caching."""

        return JSONResponse(
            launch_config.as_public_config(),
            headers={"Cache-Control": CONFIG_CACHE_CONTROL},
        )

    app.mount("/static", StaticFiles(directory=assets), name="static")
    return app
