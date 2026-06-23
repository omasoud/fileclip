# FileClip Design Specification

## 1. Overview

FileClip is a local Python-launched web application that packages a single browser-dropped file into a text clipboard envelope and reconstructs a file from a compatible clipboard envelope. It is intended for environments where clipboard text is already synchronized by another system.

The app has two runtime modes:

- **Plain mode**: no passphrase is configured; file bytes are base64 encoded into the envelope.
- **Encrypted mode**: a passphrase is configured at launch; file bytes are encrypted in the browser using a key derived from the passphrase, then base64 encoded into the envelope.

The app does not upload files, sync clipboards, store files, or provide a network transfer service.

## 2. Working name

The working name used in this specification is `fileclip`. The final package, command, and app display name may be changed without changing the design.

## 3. Architecture

```text
+----------------------------+
| Python CLI                 |
|                            |
| fileclip                   |
| - parses options           |
| - starts uvicorn/FastAPI   |
| - optionally opens browser |
+-------------+--------------+
              |
              | localhost HTTP
              v
+----------------------------+
| FastAPI local server        |
|                            |
| GET /                      |
| GET /static/app.js         |
| GET /static/app.css        |
| GET /config.json           |
+-------------+--------------+
              |
              | Browser APIs
              v
+----------------------------+
| Browser UI                 |
|                            |
| - drag/drop file input     |
| - clipboard read/write     |
| - SHA-256 hashing          |
| - optional Web Crypto      |
| - base64 encode/decode     |
| - Blob URL download        |
+----------------------------+
```

## 4. Component responsibilities

### 4.1 Python CLI

Responsibilities:

- Provide the user-facing command.
- Accept host, port, open-browser, and optional passphrase configuration.
- Start the FastAPI app under uvicorn.
- Bind to loopback by default.
- Avoid logging passphrases, file contents, or clipboard envelopes.
- Optionally open the browser to the local app URL.

The CLI does not read, encode, encrypt, copy, paste, decode, or download files.

### 4.2 FastAPI app

Responsibilities:

- Serve the static browser UI.
- Provide launch configuration to the browser.
- Avoid storing files or envelopes.
- Avoid accepting file uploads.
- Avoid server-side clipboard operations.

The FastAPI app is a local app host, not a file-transfer service.

### 4.3 Browser frontend

Responsibilities:

- Maintain the UI state machine.
- Read dropped files.
- Compute file metadata and SHA-256.
- Build and parse FileClip envelopes.
- Perform optional passphrase encryption/decryption.
- Copy envelope text to clipboard.
- Read envelope text from clipboard.
- Validate envelope compatibility and integrity.
- Provide a download for the decoded file.

## 5. Suggested CLI

```bash
fileclip
```

Suggested options:

```bash
fileclip \
  --host 127.0.0.1 \
  --port 0 \
  --open \
  --passphrase "shared secret"
```

### 5.1 CLI option behavior

| Option | Default | Behavior |
|---|---:|---|
| `--host` | `127.0.0.1` | Address passed to uvicorn. |
| `--port` | `0` | `0` means choose an available local port. |
| `--open / --no-open` | `--open` | Whether to open the browser automatically. |
| `--passphrase TEXT` | unset | Enables encrypted mode when set. |
| `--passphrase-prompt` | unset | Optional safer alternative that prompts without putting the passphrase in shell history. |

### 5.2 Remote bind safety

The default bind address is `127.0.0.1`.

If the app supports binding to `0.0.0.0` or a LAN address, the implementation should require an explicit override such as `--allow-remote`. This matters because the browser configuration may include the passphrase or passphrase-derived material needed by the frontend.

For the initial implementation, loopback-only behavior is sufficient.

## 6. Launch configuration

The browser needs to know:

- app name;
- schema version;
- whether passphrase mode is active;
- passphrase, or enough information to derive the local encryption key.

For the simplest implementation, the server may expose:

```http
GET /config.json
```

Example plain-mode response:

```json
{
  "app": "fileclip",
  "schema": 1,
  "mode": "plain"
}
```

Example encrypted-mode response:

```json
{
  "app": "fileclip",
  "schema": 1,
  "mode": "encrypted",
  "passphrase": "shared secret"
}
```

The passphrase must not be included in the page URL. The server must not log this response body.

A future hardening improvement may avoid returning the raw passphrase by prompting in the browser or deriving/importing key material in a more controlled way. This is not required for the initial local-loopback implementation.

## 7. Browser state machine

### 7.1 States

```text
Empty
  - drop enabled
  - paste enabled
  - copy disabled
  - download disabled

LoadedFromDrop
  - file bytes available
  - envelope available or buildable
  - drop enabled
  - paste enabled
  - copy enabled
  - download enabled

LoadedFromPaste
  - file bytes available
  - envelope available or regeneratable
  - drop enabled
  - paste enabled
  - copy enabled
  - download enabled

Error
  - transient status only
  - previous valid loaded state is preserved when possible
```

### 7.2 Transitions

```text
Empty --drop valid file--> LoadedFromDrop
Empty --paste valid envelope--> LoadedFromPaste
Empty --paste invalid--> Empty + error status

LoadedFromDrop --copy success--> LoadedFromDrop + success status
LoadedFromDrop --copy failure--> LoadedFromDrop + error status
LoadedFromDrop --paste valid envelope--> LoadedFromPaste
LoadedFromDrop --paste invalid--> LoadedFromDrop + error status
LoadedFromDrop --drop valid file--> LoadedFromDrop with new file

LoadedFromPaste --download--> LoadedFromPaste + browser download
LoadedFromPaste --copy success--> LoadedFromPaste + success status
LoadedFromPaste --copy failure--> LoadedFromPaste + error status
LoadedFromPaste --drop valid file--> LoadedFromDrop
LoadedFromPaste --paste invalid--> LoadedFromPaste + error status
```

## 8. Envelope format

Clipboard text generated by this app has the following shape:

```text
FILECLIP/1:
{"protectedB64":"...","payloadB64":"..."}
```

The text before the JSON is the magic prefix. The JSON object is the envelope container.

### 8.1 Prefix

The exact prefix is:

```text
FILECLIP/1:
```

Validation rules:

- Missing prefix means the clipboard content is not a FileClip payload.
- Prefix version must match the app schema family.
- The text after the prefix must parse as JSON.

### 8.2 Container JSON

The container JSON has two required fields:

```json
{
  "protectedB64": "...",
  "payloadB64": "..."
}
```

| Field | Meaning |
|---|---|
| `protectedB64` | Base64-encoded UTF-8 JSON protected header. |
| `payloadB64` | Base64-encoded payload bytes. In plain mode this is the original file bytes. In encrypted mode this is AES-GCM ciphertext bytes, including the authentication tag as produced by Web Crypto. |

Unknown fields should cause rejection for schema `1`. This keeps validation strict and avoids accidental compatibility assumptions.

## 9. Protected header

The protected header is a JSON object encoded as UTF-8 and then base64 encoded into `protectedB64`.

### 9.1 Plain-mode protected header

```json
{
  "kind": "fileclip.envelope",
  "schema": 1,
  "mode": "plain-base64",
  "createdUtc": "2026-06-22T00:00:00.000Z",
  "file": {
    "name": "archive.zip",
    "mime": "application/zip",
    "size": 1234567,
    "sha256": "hex-encoded-sha256"
  }
}
```

### 9.2 Encrypted-mode protected header

```json
{
  "kind": "fileclip.envelope",
  "schema": 1,
  "mode": "aes-gcm-pbkdf2-sha256",
  "createdUtc": "2026-06-22T00:00:00.000Z",
  "file": {
    "name": "archive.zip",
    "mime": "application/zip",
    "size": 1234567,
    "sha256": "hex-encoded-sha256"
  },
  "crypto": {
    "kdf": {
      "name": "PBKDF2",
      "hash": "SHA-256",
      "iterations": 300000,
      "saltB64": "base64-random-salt"
    },
    "cipher": {
      "name": "AES-GCM",
      "length": 256,
      "ivB64": "base64-random-iv"
    }
  }
}
```

### 9.3 Header validation

The app must reject the envelope if:

- `kind` is not `fileclip.envelope`;
- `schema` is not exactly `1`;
- `mode` is not supported;
- required file metadata is missing or invalid;
- encrypted mode is missing required crypto parameters;
- plain mode includes crypto parameters;
- unknown top-level fields are present in schema `1`;
- metadata types are not as expected.

## 10. Encoding and decoding

### 10.1 Base64 helpers

The browser should encode and decode bytes using explicit byte-safe helpers. It should not assume arbitrary binary data can safely pass through JavaScript strings without conversion.

Recommended internal helpers:

- `bytesToBase64(Uint8Array): string`
- `base64ToBytes(string): Uint8Array`
- `utf8ToBase64(string): string`
- `base64ToUtf8(string): string`

Large payloads may require chunked conversion internally to avoid call-stack or string-size issues.

### 10.2 Plain-mode encode

1. Read file as `ArrayBuffer`.
2. Convert to `Uint8Array`.
3. Compute SHA-256 of original bytes.
4. Build protected header with `mode = "plain-base64"`.
5. Base64 encode protected header JSON.
6. Base64 encode original file bytes as `payloadB64`.
7. Build final text as `FILECLIP/1:` plus container JSON.

### 10.3 Plain-mode decode

1. Verify prefix.
2. Parse container JSON.
3. Decode protected header.
4. Validate header.
5. Verify current app is plain mode.
6. Decode `payloadB64` to bytes.
7. Verify decoded size equals header file size.
8. Compute SHA-256 and compare to header file hash.
9. Hydrate UI state with file bytes and sanitized filename.

### 10.4 Encrypted-mode encode

1. Read file as `ArrayBuffer`.
2. Convert to `Uint8Array`.
3. Compute SHA-256 of original bytes.
4. Generate random salt.
5. Generate random AES-GCM IV.
6. Build protected header with file metadata and crypto parameters.
7. Serialize protected header JSON.
8. Base64 encode protected header into `protectedB64`.
9. Derive AES-GCM key from passphrase using PBKDF2/SHA-256 and the random salt.
10. Encrypt original file bytes with AES-GCM.
11. Use the exact `protectedB64` string bytes as AES-GCM additional authenticated data.
12. Base64 encode ciphertext bytes into `payloadB64`.
13. Build final text as `FILECLIP/1:` plus container JSON.

### 10.5 Encrypted-mode decode

1. Verify prefix.
2. Parse container JSON.
3. Decode protected header.
4. Validate header.
5. Verify current app is encrypted mode.
6. Derive AES-GCM key from the current passphrase using the envelope salt and KDF parameters.
7. Decrypt `payloadB64` with AES-GCM using the envelope IV.
8. Use the exact `protectedB64` string bytes as AES-GCM additional authenticated data.
9. If decryption fails, refuse hydration.
10. Verify decoded size equals header file size.
11. Compute SHA-256 and compare to header file hash.
12. Hydrate UI state with file bytes and sanitized filename.

## 11. Cryptographic design

### 11.1 Algorithms

Encrypted mode uses:

- KDF: PBKDF2
- KDF hash: SHA-256
- KDF iterations: 300,000
- Salt: 16 random bytes minimum
- Cipher: AES-GCM
- Key length: 256 bits
- IV/nonce: 12 random bytes
- Additional authenticated data: UTF-8 bytes of the exact `protectedB64` string

### 11.2 Rationale

- PBKDF2/SHA-256 and AES-GCM are available in modern browsers through Web Crypto.
- AES-GCM provides confidentiality and authentication of encrypted payloads.
- Using `protectedB64` as additional authenticated data causes metadata tampering to fail decryption.
- A wrong passphrase causes decryption/authentication failure.
- SHA-256 over the plaintext file provides an additional post-decryption integrity check and supports plain-mode integrity validation.

### 11.3 Security limitations

Passphrase mode is intended as a practical guardrail, not a high-assurance security boundary.

Known limitations:

- `--passphrase` may appear in shell history.
- `--passphrase` may be visible in local process lists.
- The passphrase may exist in browser memory.
- Decrypted file bytes exist in browser memory.
- Clipboard managers may capture plain envelopes.
- Clipboard managers may capture encrypted envelopes.
- Local malware or a compromised browser can bypass this design.
- If the server is bound outside loopback, launch configuration may be visible to other machines unless additional protections are added.

## 12. Clipboard behavior

### 12.1 Copy

The copy operation:

1. Requires a loaded file state.
2. Ensures an envelope exists or regenerates one.
3. Calls the browser clipboard write API from the copy button handler.
4. Reports success or failure.

If the current state came from paste, copy may regenerate the envelope using the current app mode. In encrypted mode, regeneration should use a new salt and IV.

### 12.2 Paste

The paste operation:

1. Calls the browser clipboard read API from the paste button handler.
2. Treats non-text, empty text, or inaccessible clipboard data as failure.
3. Attempts FileClip parsing only after prefix detection.
4. Rejects incompatible or invalid content.
5. Preserves any previous valid loaded state on failure.

## 13. Download behavior

The app creates a download by:

1. Sanitizing the filename.
2. Creating a `Blob` from the decoded bytes and MIME type.
3. Creating an object URL.
4. Creating or reusing an anchor element with `download`.
5. Programmatically clicking the anchor in response to the download button.
6. Revoking the object URL when safe.

### 13.1 Filename sanitization

Filename sanitization should:

- remove path separators `/` and `\`;
- remove control characters;
- trim leading/trailing whitespace;
- avoid reserved names where practical;
- fall back to `download.bin` if empty.

The app does not need to preserve directory paths.

## 14. UI layout

The UI should be intentionally minimal:

```text
+--------------------------------------------------+
| FileClip                                         |
| Mode: Plain / Passphrase                         |
|                                                  |
| +----------------------------------------------+ |
| | Drop one file here                            | |
| | or click/paste using the buttons below        | |
| +----------------------------------------------+ |
|                                                  |
| File: archive.zip                               |
| Size: 1.2 MB                                    |
| Status: Ready to copy                           |
|                                                  |
| [Paste from clipboard] [Copy to clipboard]       |
| [Download file]                                  |
+--------------------------------------------------+
```

### 14.1 Button enablement

| State | Paste | Copy | Download |
|---|---:|---:|---:|
| Empty | enabled | disabled | disabled |
| Loaded from drop | enabled | enabled | enabled |
| Loaded from paste | enabled | enabled | enabled |
| Error with previous loaded file | enabled | enabled | enabled |
| Error with no loaded file | enabled | disabled | disabled |

## 15. Error messages

Recommended user-facing messages:

| Condition | Message |
|---|---|
| Clipboard read denied | `Clipboard read failed or permission was denied.` |
| Clipboard write denied | `Clipboard write failed or permission was denied.` |
| Missing prefix | `Clipboard does not contain a FileClip payload.` |
| Malformed JSON | `Clipboard payload is malformed.` |
| Unsupported schema | `Clipboard payload uses an unsupported schema version.` |
| Plain/encrypted mismatch | `Clipboard payload mode does not match this app instance.` |
| Wrong passphrase | `Clipboard payload is valid, but cannot be decrypted with this instance's passphrase.` |
| Hash mismatch | `Decoded file failed integrity verification.` |
| Size mismatch | `Decoded file size does not match the envelope metadata.` |
| Large payload failure | `The operation failed. The file may be too large for this browser, clipboard, or sync path.` |
| Unsupported browser | `This browser does not support the required File, Clipboard, Blob, or Web Crypto APIs.` |

## 16. Suggested implementation structure

```text
fileclip/
  pyproject.toml
  README.md
  src/
    fileclip/
      __init__.py
      __main__.py
      cli.py
      server.py
      static/
        index.html
        app.js
        app.css
  tests/
    test_cli.py
    test_server.py
    test_static_assets.py
```

### 16.1 Python modules

| File | Responsibility |
|---|---|
| `cli.py` | Typer or argparse CLI, option parsing, uvicorn launch, browser opening. |
| `server.py` | FastAPI app factory, config route, static file mounting. |
| `__main__.py` | Allows `python -m fileclip`. |

### 16.2 Frontend modules

For the initial implementation, a single `app.js` is acceptable.

If split later:

```text
static/
  app.js
  envelope.js
  crypto.js
  clipboard.js
  file_state.js
  ui.js
```

## 17. FastAPI routes

### 17.1 `GET /`

Returns `index.html`.

### 17.2 `GET /config.json`

Returns launch configuration.

No request body. No file payloads. No persistence.

### 17.3 Static files

The app may use FastAPI static file mounting for JavaScript and CSS assets.

## 18. Testing strategy

### 18.1 Python tests

- CLI default option parsing.
- Config generation in plain mode.
- Config generation in encrypted mode.
- Passphrase not logged.
- Loopback default.
- Static assets served.
- `/config.json` served with expected mode.

### 18.2 Frontend unit tests

If a JavaScript test harness is used:

- base64 helpers round-trip arbitrary bytes;
- envelope generation/parsing;
- strict schema validation;
- filename sanitization;
- plain-mode hash verification;
- encrypted-mode decrypt with same passphrase;
- encrypted-mode reject with wrong passphrase;
- encrypted-mode reject after header tamper;
- encrypted-mode reject after payload tamper;
- plain/encrypted mode mismatch rejection.

### 18.3 Manual browser tests

- Drop/copy/paste/download round trip in same browser.
- Drop/copy/paste/download round trip between two app instances.
- Drop/copy/paste/download round trip between two machines using clipboard sync.
- Clipboard permission denial behavior.
- Large ZIP behavior through the intended clipboard-sync path.
- Browser refresh clears state.
- Wrong passphrase refusal.
- Plain/encrypted mismatch refusal.

## 19. Implementation notes

### 19.1 No server upload

The drop zone must not upload the file to FastAPI. All file processing happens in the browser.

### 19.2 No artificial file-size limit

The implementation should not reject files based on a fixed application limit. It should still handle and report failures from the browser, clipboard API, memory pressure, or the external clipboard-sync path.

### 19.3 Progress/status

For large files, the UI should show at least coarse status:

- `Reading file...`
- `Hashing file...`
- `Encrypting file...`
- `Encoding envelope...`
- `Writing clipboard...`
- `Ready to download.`

True byte-level progress is optional for the initial implementation.

### 19.4 Regeneration after paste

After successful paste, the app has the decoded file bytes. The copy button may regenerate a new envelope from those bytes using the current mode and passphrase. In encrypted mode this should produce a new salt and IV.

### 19.5 Exact schema matching

Schema `1` implementations should reject anything that is not exactly a schema `1` FileClip envelope. No migration layer is required.

## 20. Future enhancements

These are not required for the initial implementation:

- Multi-file envelope support.
- Folder drop support.
- Streaming/chunked envelope format.
- Compression before encryption.
- Browser prompt for passphrase instead of server-provided launch config.
- QR-code transfer for tiny files.
- Native desktop wrapper.
- Clipboard polling with explicit opt-in.
- Recent-transfer history stored only in browser session storage.
- Dark mode.
- Local-only HTTPS.
- Automatic integrity summary after paste.
