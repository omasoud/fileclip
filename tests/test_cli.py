import socket

import pytest
import typer
from typer.testing import CliRunner

from fileclip.cli import (
    app,
    build_app_url,
    close_sockets,
    is_loopback_host,
    prepare_server_launch,
    resolve_passphrase,
)


def test_cli_app_can_be_constructed() -> None:
    runner = CliRunner()
    result = runner.invoke(app, ["--help"])

    assert result.exit_code == 0
    assert "Start the local FileClip browser app." in result.output
    assert "serve" not in result.output


def test_root_command_runs_server_with_root_options(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []

    def fake_run_local_server(**kwargs: object) -> None:
        calls.append(kwargs)

    monkeypatch.setattr("fileclip.cli.run_local_server", fake_run_local_server)
    runner = CliRunner()
    result = runner.invoke(
        app,
        [
            "--host",
            "127.0.0.1",
            "--port",
            "8123",
            "--no-open",
            "--passphrase",
            "secret",
        ],
    )

    assert result.exit_code == 0
    assert calls == [
        {
            "host": "127.0.0.1",
            "port": 8123,
            "open_browser": False,
            "passphrase": "secret",
            "passphrase_prompt": False,
        }
    ]


@pytest.mark.parametrize("host", ["127.0.0.1", "localhost", "::1"])
def test_loopback_hosts_are_accepted(host: str) -> None:
    assert is_loopback_host(host)


@pytest.mark.parametrize("host", ["0.0.0.0", "192.168.0.10", "example.com"])
def test_non_loopback_hosts_are_rejected(host: str) -> None:
    assert not is_loopback_host(host)


def test_remote_bind_is_rejected_by_cli() -> None:
    runner = CliRunner()
    result = runner.invoke(app, ["--host", "0.0.0.0", "--no-open"])

    assert result.exit_code != 0


def test_remote_bind_validation_message_is_clear() -> None:
    with pytest.raises(typer.BadParameter, match="Loopback-only"):
        prepare_server_launch("0.0.0.0", 8080)


def test_port_zero_prebinds_socket_and_builds_actual_url() -> None:
    launch = prepare_server_launch("127.0.0.1", 0)
    try:
        assert launch.requested_port == 0
        assert launch.port > 0
        assert launch.url == f"http://127.0.0.1:{launch.port}/"
        assert launch.sockets is not None
        assert isinstance(launch.sockets[0], socket.socket)
    finally:
        close_sockets(launch.sockets)


def test_explicit_port_does_not_prebind_socket() -> None:
    launch = prepare_server_launch("127.0.0.1", 8123)

    assert launch.port == 8123
    assert launch.url == "http://127.0.0.1:8123/"
    assert launch.sockets is None


def test_ipv6_url_is_bracketed() -> None:
    assert build_app_url("::1", 8080) == "http://[::1]:8080/"


def test_passphrase_option_and_prompt_are_mutually_exclusive() -> None:
    with pytest.raises(typer.BadParameter, match="either --passphrase"):
        resolve_passphrase("secret", True, prompt_func=lambda: "prompted")


@pytest.mark.parametrize("value,prompt", [("", False), ("", True)])
def test_empty_passphrases_are_rejected(value: str, prompt: bool) -> None:
    with pytest.raises(typer.BadParameter, match="cannot be empty"):
        resolve_passphrase(value if not prompt else None, prompt, prompt_func=lambda: value)


def test_passphrase_prompt_returns_prompt_value() -> None:
    assert resolve_passphrase(None, True, prompt_func=lambda: "secret") == "secret"
