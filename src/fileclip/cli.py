"""Command-line interface for FileClip."""

from __future__ import annotations

import ipaddress
import socket
import webbrowser
from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

import typer
import uvicorn

from fileclip.server import LaunchConfig, create_app

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 0

app = typer.Typer(
    add_completion=False,
    help="Run the local FileClip clipboard-envelope web app.",
    no_args_is_help=False,
)


@dataclass(frozen=True)
class ServerLaunch:
    """Resolved server launch details."""

    host: str
    requested_port: int
    port: int
    url: str
    sockets: list[socket.socket] | None = None


def is_loopback_host(host: str) -> bool:
    """Return whether host is an accepted loopback bind address."""

    normalized = host.strip().lower()
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def format_host_for_url(host: str) -> str:
    """Format a host for use in an HTTP URL."""

    if ":" in host and not host.startswith("["):
        return f"[{host}]"
    return host


def build_app_url(host: str, port: int) -> str:
    """Build the browser URL for a FileClip server."""

    return f"http://{format_host_for_url(host)}:{port}/"


def _bind_socket(host: str) -> socket.socket:
    """Bind and listen on an available port for the requested host."""

    last_error: OSError | None = None
    for family, socktype, proto, _canonname, sockaddr in socket.getaddrinfo(
        host,
        0,
        type=socket.SOCK_STREAM,
    ):
        sock = socket.socket(family, socktype, proto)
        try:
            sock.bind(sockaddr)
            sock.listen()
        except OSError as exc:
            last_error = exc
            sock.close()
            continue
        return sock
    if last_error is not None:
        raise last_error
    raise OSError(f"Could not resolve a bind address for {host!r}.")


def close_sockets(sockets: list[socket.socket] | None) -> None:
    """Close sockets that were pre-bound for uvicorn."""

    if sockets is None:
        return
    for sock in sockets:
        try:
            sock.close()
        except OSError:
            pass


def prepare_server_launch(host: str, port: int) -> ServerLaunch:
    """Validate bind options and resolve the actual browser URL."""

    if not is_loopback_host(host):
        raise typer.BadParameter(
            "Loopback-only host required.",
            param_hint="--host",
        )
    if port < 0 or port > 65535:
        raise typer.BadParameter(
            "Port must be between 0 and 65535.",
            param_hint="--port",
        )
    if port == 0:
        sock = _bind_socket(host)
        actual_port = int(sock.getsockname()[1])
        return ServerLaunch(
            host=host,
            requested_port=port,
            port=actual_port,
            url=build_app_url(host, actual_port),
            sockets=[sock],
        )
    return ServerLaunch(
        host=host,
        requested_port=port,
        port=port,
        url=build_app_url(host, port),
    )


def _prompt_passphrase() -> str:
    """Prompt for a passphrase without echoing it to the terminal."""

    return str(typer.prompt("Passphrase", hide_input=True))


def resolve_passphrase(
    passphrase: str | None,
    passphrase_prompt: bool,
    prompt_func: Callable[[], str] = _prompt_passphrase,
) -> str | None:
    """Resolve passphrase options into the configured passphrase."""

    if passphrase is not None and passphrase_prompt:
        raise typer.BadParameter(
            "Use either --passphrase or --passphrase-prompt, not both.",
            param_hint="--passphrase",
        )
    resolved = prompt_func() if passphrase_prompt else passphrase
    if resolved == "":
        raise typer.BadParameter(
            "Passphrase cannot be empty.",
            param_hint="--passphrase",
        )
    return resolved


def run_local_server(
    *,
    host: str,
    port: int,
    open_browser: bool,
    passphrase: str | None,
    passphrase_prompt: bool,
    browser_open: Callable[[str], bool] = webbrowser.open,
) -> None:
    """Run the local FileClip server."""

    resolved_passphrase = resolve_passphrase(passphrase, passphrase_prompt)
    launch = prepare_server_launch(host, port)
    asgi_app = create_app(LaunchConfig(passphrase=resolved_passphrase))
    uvicorn_config = uvicorn.Config(
        asgi_app,
        host=launch.host,
        port=launch.port,
        access_log=False,
        log_level="info",
    )
    server = uvicorn.Server(uvicorn_config)
    try:
        typer.echo(f"Serving FileClip at {launch.url}")
        if open_browser:
            browser_open(launch.url)
        server.run(sockets=launch.sockets)
    finally:
        close_sockets(launch.sockets)


@app.command()
def root(
    host: Annotated[
        str,
        typer.Option("--host", help="Loopback host to bind."),
    ] = DEFAULT_HOST,
    port: Annotated[
        int,
        typer.Option("--port", min=0, max=65535, help="Port to bind; 0 chooses one."),
    ] = DEFAULT_PORT,
    open_browser: Annotated[
        bool,
        typer.Option("--open/--no-open", help="Open the browser after launch."),
    ] = True,
    passphrase: Annotated[
        str | None,
        typer.Option("--passphrase", help="Enable encrypted mode with this passphrase."),
    ] = None,
    passphrase_prompt: Annotated[
        bool,
        typer.Option(
            "--passphrase-prompt",
            help="Prompt for a passphrase without echoing it.",
        ),
    ] = False,
) -> None:
    """Start the local FileClip browser app."""

    run_local_server(
        host=host,
        port=port,
        open_browser=open_browser,
        passphrase=passphrase,
        passphrase_prompt=passphrase_prompt,
    )


def main() -> None:
    """Run the Typer application."""

    app()
