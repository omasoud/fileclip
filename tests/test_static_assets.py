from importlib import resources


def read_static_asset(name: str) -> str:
    return resources.files("fileclip").joinpath("static", name).read_text(encoding="utf-8")


def test_html_exposes_expected_controls() -> None:
    html = read_static_asset("index.html")

    assert 'id="dropZone"' in html
    assert 'id="pasteButton"' in html
    assert 'id="copyButton"' in html
    assert 'id="downloadButton"' in html


def test_javascript_declares_envelope_contract() -> None:
    javascript = read_static_asset("app.js")

    assert 'const PREFIX = "FILECLIP/1:";' in javascript
    assert 'const SCHEMA = 1;' in javascript
    assert 'const PLAIN_MODE = "plain-base64";' in javascript
    assert 'const ENCRYPTED_MODE = "aes-gcm-pbkdf2-sha256";' in javascript
    assert "additionalData: textEncoder.encode(protectedB64)" in javascript
    assert "additionalData: textEncoder.encode(container.protectedB64)" in javascript


def test_javascript_includes_required_user_messages() -> None:
    javascript = read_static_asset("app.js")

    assert "Copied to local clipboard." in javascript
    assert "Drop one file at a time." in javascript
    assert "application/octet-stream" in javascript
    assert "Clipboard payload mode does not match this app instance." in javascript
