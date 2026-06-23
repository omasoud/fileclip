# FileClip Requirements

## 1. Purpose

FileClip is a small local web application for transferring files through text clipboard synchronization. It converts a dropped file into a self-contained clipboard-safe envelope, copies that envelope to the local clipboard, and can later hydrate the same envelope from the clipboard to reconstruct and download the original file.

The application does not provide clipboard synchronization itself. It assumes another mechanism already syncs clipboard text between machines or environments, such as remote desktop clipboard sharing, operating-system clipboard sync, VM clipboard integration, or another user-managed synchronization path.

## 2. Scope

### 2.1 In scope

- Launching a local Python web application from a CLI.
- Serving a browser UI using FastAPI/uvicorn.
- Accepting one dropped file at a time.
- Encoding the file into a text envelope suitable for clipboard copy/paste.
- Including file metadata, including filename, MIME type when available, file size, and content hash.
- Copying the envelope to the browser clipboard.
- Reading a clipboard envelope from the browser clipboard.
- Validating the envelope before hydration.
- Reconstructing the original file bytes.
- Downloading the reconstructed file from the browser.
- Optional passphrase-based encrypted envelope mode.
- Strict schema-version matching with no forward/backward compatibility requirement.

### 2.2 Out of scope

- Providing clipboard synchronization between machines.
- Uploading files to a server.
- Storing files on disk after drop or paste.
- Managing multiple files in a single envelope.
- Providing cloud, account, sharing, or collaboration features.
- Supporting arbitrary historical schema versions.
- Guaranteeing successful transfer of arbitrarily large payloads through all browsers, operating systems, clipboard managers, or clipboard-sync channels.
- Providing high-assurance secrecy against local machine compromise, browser compromise, shell history exposure, process-list exposure, or clipboard-monitoring software.

## 3. Operating assumptions

- The app is normally launched locally from a Python CLI.
- The default server bind address is loopback-only.
- The user opens the local browser UI served by the CLI.
- Browser clipboard APIs are available to the page.
- The browser permits clipboard read/write operations when triggered by user gestures.
- The external clipboard-sync mechanism handles large text payloads well enough for the user's intended workflow.
- Files are usually already compressed, such as ZIP archives, so base64 overhead is acceptable.
- No explicit application-level file-size limit is required.

## 4. User-facing workflow

### 4.1 Initial state

When the app opens:

- The drop zone is active.
- The paste button is active.
- The copy button is disabled.
- The download button is disabled.
- No file metadata is shown.

### 4.2 Drop/copy workflow

1. The user drops a file onto the drop zone.
2. The app reads the file in the browser.
3. The app computes file metadata and hash.
4. The app builds a `FILECLIP/1` envelope.
5. If launched with a passphrase, the app encrypts the payload before packaging the envelope.
6. The app shows the filename and relevant status.
7. The app enables the copy button.
8. The app may also enable the download button for the currently loaded file.
9. When the user presses copy, the app writes the envelope text to the clipboard.
10. The app shows success or failure status.

### 4.3 Paste/download workflow

1. The user presses paste.
2. The app reads text from the clipboard.
3. The app validates that the clipboard text is a `FILECLIP/1` envelope.
4. The app validates exact schema compatibility.
5. The app validates that the envelope mode is compatible with the app's current passphrase mode.
6. If encrypted, the app derives the key from the configured passphrase and decrypts the payload.
7. The app verifies the decoded file hash and size.
8. The app shows the filename.
9. The app enables the download button.
10. The user presses download.
11. The app downloads the reconstructed file using the original filename after filename sanitization.

## 5. Functional requirements

### 5.1 CLI and launch

| ID | Requirement |
|---|---|
| FR-CLI-001 | The application shall provide a Python CLI entry point. |
| FR-CLI-002 | The CLI shall launch a FastAPI/uvicorn local web server. |
| FR-CLI-003 | The CLI shall bind to `127.0.0.1` by default. |
| FR-CLI-004 | The CLI shall support a configurable port. |
| FR-CLI-005 | The CLI should support selecting an available port automatically. |
| FR-CLI-006 | The CLI should open the browser automatically by default. |
| FR-CLI-007 | The CLI shall support disabling automatic browser launch. |
| FR-CLI-008 | The CLI shall support an optional passphrase argument or equivalent launch-time passphrase mechanism. |
| FR-CLI-009 | The CLI shall not place the passphrase in a URL query parameter. |
| FR-CLI-010 | The CLI shall not log the passphrase. |
| FR-CLI-011 | The CLI shall not log file payloads or clipboard envelope contents. |

### 5.2 Browser UI

| ID | Requirement |
|---|---|
| FR-UI-001 | The UI shall show a drop zone. |
| FR-UI-002 | The UI shall show a paste button. |
| FR-UI-003 | The UI shall show a copy button. |
| FR-UI-004 | The UI shall show a download button. |
| FR-UI-005 | The drop zone shall be active in the initial state. |
| FR-UI-006 | The paste button shall be active in the initial state. |
| FR-UI-007 | The copy button shall be disabled in the initial state. |
| FR-UI-008 | The download button shall be disabled in the initial state. |
| FR-UI-009 | The UI shall show the current filename after a successful drop or paste. |
| FR-UI-010 | The UI shall show clear success, progress, and failure messages. |
| FR-UI-011 | The UI shall not rely on an audible ding as the only failure indication. |
| FR-UI-012 | The UI shall clearly indicate whether the current app instance is operating in plain mode or passphrase mode. |

### 5.3 File drop and encoding

| ID | Requirement |
|---|---|
| FR-DROP-001 | The app shall accept one dropped file at a time. |
| FR-DROP-002 | Dropping a new file shall replace the current in-memory file state. |
| FR-DROP-003 | The app shall read the dropped file as bytes in the browser. |
| FR-DROP-004 | The app shall capture the original filename. |
| FR-DROP-005 | The app shall capture the browser-provided MIME type when available. |
| FR-DROP-006 | The app shall capture the original file size. |
| FR-DROP-007 | The app shall compute a SHA-256 hash of the original file bytes. |
| FR-DROP-008 | The app shall build a valid `FILECLIP/1` envelope. |
| FR-DROP-009 | The app shall not impose an application-level file-size limit. |
| FR-DROP-010 | The app shall handle browser memory, read, encoding, encryption, and clipboard failures gracefully. |

### 5.4 Clipboard copy

| ID | Requirement |
|---|---|
| FR-COPY-001 | The copy button shall be enabled after a file is successfully loaded from drop or paste. |
| FR-COPY-002 | Pressing copy shall write the current envelope text to the clipboard. |
| FR-COPY-003 | Copy shall be initiated only by a user gesture. |
| FR-COPY-004 | The app shall report clipboard write success. |
| FR-COPY-005 | The app shall report clipboard write failure. |
| FR-COPY-006 | Clipboard write failure shall not corrupt the current loaded file state. |

### 5.5 Clipboard paste

| ID | Requirement |
|---|---|
| FR-PASTE-001 | The paste button shall be enabled in the initial state. |
| FR-PASTE-002 | Pressing paste shall read text from the clipboard. |
| FR-PASTE-003 | Paste shall be initiated only by a user gesture. |
| FR-PASTE-004 | The app shall reject clipboard content that does not start with the expected `FILECLIP/1` prefix. |
| FR-PASTE-005 | The app shall reject malformed JSON envelopes. |
| FR-PASTE-006 | The app shall reject envelopes with an unsupported schema. |
| FR-PASTE-007 | The app shall reject envelopes whose mode is incompatible with the current app passphrase mode. |
| FR-PASTE-008 | The app shall reject encrypted envelopes that cannot be decrypted with the current passphrase. |
| FR-PASTE-009 | The app shall reject envelopes whose decoded bytes do not match the declared size or SHA-256 hash. |
| FR-PASTE-010 | Invalid paste attempts shall show a clear failure message. |
| FR-PASTE-011 | Invalid paste attempts shall not erase an existing valid loaded file unless the user explicitly clears it. |

### 5.6 Download

| ID | Requirement |
|---|---|
| FR-DOWNLOAD-001 | The download button shall be enabled after a file is successfully loaded from drop or paste. |
| FR-DOWNLOAD-002 | Pressing download shall create a browser download using the reconstructed bytes. |
| FR-DOWNLOAD-003 | The downloaded file shall use the original filename after filename sanitization. |
| FR-DOWNLOAD-004 | The app shall strip or replace path separators and unsafe filename characters. |
| FR-DOWNLOAD-005 | If the filename is empty or invalid after sanitization, the app shall use a safe fallback such as `download.bin`. |
| FR-DOWNLOAD-006 | The app shall release object URLs when no longer needed. |

## 6. Envelope requirements

| ID | Requirement |
|---|---|
| FR-ENV-001 | Clipboard content generated by the app shall start with the exact prefix `FILECLIP/1:`. |
| FR-ENV-002 | The prefix shall be followed by a JSON object. |
| FR-ENV-003 | The JSON object shall include a protected header encoded as base64 text. |
| FR-ENV-004 | The JSON object shall include a payload encoded as base64 text. |
| FR-ENV-005 | The protected header shall include `kind`, `schema`, `mode`, `createdUtc`, and `file` metadata. |
| FR-ENV-006 | The `kind` value shall identify the envelope as a FileClip envelope. |
| FR-ENV-007 | The `schema` value shall be exactly `1` for this version. |
| FR-ENV-008 | The `mode` value shall indicate either plain or passphrase-encrypted mode. |
| FR-ENV-009 | The `file` metadata shall include name, MIME type, size, and SHA-256 hash. |
| FR-ENV-010 | Encrypted envelopes shall include the KDF and cipher parameters needed for decryption. |
| FR-ENV-011 | Encrypted envelopes shall not include the passphrase. |
| FR-ENV-012 | The envelope shall be self-contained except for the optional passphrase. |

## 7. Passphrase and encryption requirements

| ID | Requirement |
|---|---|
| FR-CRYPTO-001 | If the app is launched without a passphrase, it shall operate in plain mode. |
| FR-CRYPTO-002 | If the app is launched with a passphrase, it shall operate in encrypted mode. |
| FR-CRYPTO-003 | Plain-mode instances shall generate plain envelopes. |
| FR-CRYPTO-004 | Encrypted-mode instances shall generate encrypted envelopes. |
| FR-CRYPTO-005 | Plain-mode instances shall reject encrypted envelopes. |
| FR-CRYPTO-006 | Encrypted-mode instances shall reject plain envelopes by default. |
| FR-CRYPTO-007 | Encrypted envelopes shall use PBKDF2 with SHA-256 to derive an AES-GCM key from the passphrase. |
| FR-CRYPTO-008 | Encrypted envelopes shall use a random salt per envelope. |
| FR-CRYPTO-009 | Encrypted envelopes shall use a random IV/nonce per envelope. |
| FR-CRYPTO-010 | Encrypted envelopes shall authenticate protected metadata as additional authenticated data. |
| FR-CRYPTO-011 | A wrong passphrase or metadata tampering shall cause decryption failure. |
| FR-CRYPTO-012 | Decryption failure shall be reported as a refusal to hydrate the payload. |
| FR-CRYPTO-013 | The app shall not treat base64 as a security mechanism. |

## 8. Error-handling requirements

The app shall provide clear status messages for at least the following conditions:

- Clipboard read denied or unavailable.
- Clipboard write denied or unavailable.
- Clipboard content is not a FileClip payload.
- Clipboard payload is malformed.
- Clipboard payload has an unsupported schema.
- Clipboard payload mode does not match the app's current passphrase mode.
- Passphrase decryption failed.
- Payload hash mismatch.
- Payload size mismatch.
- File read failed.
- Encoding failed.
- Encryption failed.
- Decoding failed.
- Download preparation failed.
- Operation failed because the payload is too large for the browser, clipboard, or external sync path.

## 9. Non-functional requirements

### 9.1 Simplicity

- The implementation should remain small enough to be understood and modified easily.
- The server should only serve the local web UI and launch configuration.
- The browser should perform file processing, clipboard access, hashing, optional encryption, decoding, and download preparation.

### 9.2 Privacy and persistence

- The server shall not persist files.
- The server shall not persist clipboard envelope contents.
- The browser shall keep the active file and envelope only in memory.
- Refreshing the page may clear the in-memory state.
- No analytics, telemetry, or remote calls are required.

### 9.3 Compatibility

- The app targets modern browsers with File, Clipboard, Blob URL, and Web Crypto support.
- The app requires exact schema-version matching.
- The app does not need forward or backward compatibility for mismatched schemas.
- The app should display a clear unsupported-browser message if required APIs are absent.

### 9.4 Large payload behavior

- The app shall not impose a fixed file-size cap.
- The app shall process files using reasonable browser-side memory practices.
- The app shall report failures caused by browser memory pressure, clipboard limits, or clipboard-sync limitations.
- The app does not guarantee successful copy/paste of arbitrarily large files.

## 10. Suggested acceptance tests

| ID | Scenario | Expected result |
|---|---|---|
| AT-001 | Open app with no passphrase | Drop zone and paste enabled; copy and download disabled. |
| AT-002 | Drop a small text file in plain mode | Filename appears; copy and download enabled. |
| AT-003 | Copy dropped file in plain mode, paste into another plain-mode instance | File hydrates; filename appears; download produces identical bytes. |
| AT-004 | Paste arbitrary clipboard text | App rejects content with a clear message. |
| AT-005 | Paste malformed `FILECLIP/1` JSON | App rejects content with a clear message. |
| AT-006 | Paste schema `2` envelope into schema `1` app | App rejects content with unsupported-schema message. |
| AT-007 | Launch with passphrase and drop a file | App generates encrypted envelope. |
| AT-008 | Paste encrypted envelope into app with same passphrase | File hydrates and downloads with identical bytes. |
| AT-009 | Paste encrypted envelope into app with wrong passphrase | App refuses transfer and does not enable download. |
| AT-010 | Paste encrypted envelope into plain-mode app | App refuses transfer due to mode mismatch. |
| AT-011 | Paste plain envelope into encrypted-mode app | App refuses transfer due to mode mismatch. |
| AT-012 | Tamper with payload bytes | App rejects due to decryption failure or hash mismatch. |
| AT-013 | Tamper with protected metadata in encrypted mode | App rejects due to authentication failure. |
| AT-014 | Drop a file with path-like or unsafe filename characters | Download filename is sanitized. |
| AT-015 | Clipboard write fails | App shows failure and preserves current file state. |
| AT-016 | Clipboard read fails | App shows failure and preserves current file state. |
| AT-017 | Large payload fails due to browser or clipboard limits | App shows failure without crashing when possible. |

## 11. Open decisions

No additional product decisions are required for the initial implementation. The following defaults are assumed:

- Single-file envelopes only.
- No artificial file-size limit.
- Strict schema-version matching.
- Strict passphrase-mode matching.
- Loopback-only server by default.
- No server-side file persistence.
- No forward/backward compatibility support.
