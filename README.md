# FileClip

FileClip is a small local web app for moving one file through text clipboard synchronization. It packages a dropped file into a self-contained `FILECLIP/1` text envelope, copies that envelope to the local clipboard, and can later hydrate a compatible envelope back into a downloadable file.

FileClip does not sync clipboards, upload files, or store file contents on disk. It assumes another system already syncs clipboard text between the environments you care about.

## Install

For CLI use:

```bash
uv tool install fileclip
```

Or with pipx:

```bash
pipx install fileclip
```

## Run

```bash
fileclip
```

By default the server binds to `127.0.0.1`, chooses an available port, and opens the browser.

Useful options:

```bash
fileclip --port 8080
fileclip --no-open
fileclip --passphrase-prompt
```

## Plain Mode

Without a passphrase, FileClip creates plain base64 clipboard envelopes. This is convenient for trusted local clipboard-sync paths, but the file bytes are visible to anything that can read the clipboard envelope.

## Passphrase Mode

With `--passphrase` or `--passphrase-prompt`, FileClip encrypts file bytes in the browser with PBKDF2/SHA-256 and AES-GCM before building the clipboard envelope.

`--passphrase-prompt` avoids putting the passphrase in shell history or the process list. The browser still receives the passphrase through local launch configuration so it can encrypt and decrypt files. Passphrase mode is a practical guardrail, not a high-assurance security boundary.

Encrypted mode protects payload bytes but does not hide envelope metadata such as filename, MIME type, file size, or SHA-256 hash.

## Limits

FileClip has no artificial file-size limit, but browsers, clipboards, clipboard managers, and external clipboard-sync channels do. Large payloads may fail to copy, paste, or sync. Chromium on Windows has been observed to read very large text envelopes back as empty text at roughly 128 MiB of clipboard text.

Only schema `1` envelopes are supported. FileClip intentionally rejects unknown schema versions and mode mismatches.

## Development

```bash
uv sync
uv run pytest
uv run fileclip --no-open
```

## License

FileClip is distributed under the MIT License.
