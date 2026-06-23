# FileClip Implementation Plan

## Overview

This is the master implementation plan for FileClip. It is the durable task tracker for building the initial local web app described in:

- `dev/docs/requirements.md`
- `dev/docs/design-specification.md`

The initial target is a small Python CLI that launches a loopback-only FastAPI app, serves a browser UI, and lets the browser package one dropped file into a `FILECLIP/1` clipboard envelope or hydrate a compatible envelope back into a downloadable file. File processing, hashing, clipboard access, optional encryption, decoding, and download preparation happen in the browser. The server only serves static assets and launch configuration.

## Phase 0: Project Foundation

Establish the package shape, dependency set, and test baseline before adding behavior.

- [x] CORE-01 Replace the placeholder package entry point with a real `fileclip` package surface that exposes version metadata without performing CLI side effects.
- [x] CORE-02 Add Python modules for the initial structure: `cli.py`, `server.py`, and `__main__.py`.
- [x] CORE-03 Add FastAPI and uvicorn runtime dependencies.
- [x] CORE-04 Keep Typer as the CLI framework and wire the `fileclip` console script to the real CLI entry point.
- [x] CORE-05 Add a minimal pytest baseline that verifies the package imports and the CLI app can be constructed.
- [x] CORE-06 Add static asset directories and placeholder `index.html`, `app.css`, and `app.js` files under `src/fileclip/static/`.
- [x] CORE-07 Configure package data so `index.html`, `app.css`, and `app.js` are included in built distributions.
- [x] CORE-08 Choose the frontend verification approach before frontend implementation; prefer Python pytest with Playwright unless project constraints require a different harness.

## Phase 1: CLI Launch Behavior

Implement the local launch command and make loopback-only operation the safe default.

- [x] CLI-01 Add a `fileclip serve` Typer subcommand.
- [x] CLI-02 Support `--host` with default `127.0.0.1`.
- [x] CLI-03 Support `--port` with default `0` for automatic available-port selection.
- [x] CLI-04 Support `--open / --no-open` with browser launch enabled by default.
- [x] CLI-05 Support `--passphrase TEXT` to enable encrypted mode.
- [x] CLI-06 Support `--passphrase-prompt` as a safer launch-time input path.
- [x] CLI-07 Reject non-loopback bind addresses for the initial implementation.
- [x] CLI-08 Ensure passphrases, envelopes, and file payloads are never logged by CLI code.
- [x] CLI-09 Add CLI tests for default options, explicit host/port options, browser-open toggles, and passphrase mode selection.
- [x] CLI-10 Add CLI tests that verify remote bind addresses are refused by default.
- [x] CLI-11 Implement reliable automatic port selection by pre-binding a socket or otherwise discovering the assigned uvicorn port before browser launch.
- [x] CLI-12 Add tests for `--port 0` URL generation and browser launch behavior.
- [x] CLI-13 Reject using `--passphrase` and `--passphrase-prompt` together.
- [x] CLI-14 Reject empty passphrases in encrypted mode.

## Phase 2: Local Server And Launch Configuration

Build the FastAPI host that serves only the app shell, static files, and launch config.

- [x] SERV-01 Add a FastAPI app factory that accepts launch configuration from the CLI.
- [x] SERV-02 Serve `index.html` at `GET /`.
- [x] SERV-03 Serve browser assets from `/static/`.
- [x] SERV-04 Serve `GET /config.json` with app name, schema version, and mode.
- [x] SERV-05 Include the passphrase in `/config.json` only when encrypted mode is active.
- [x] SERV-06 Prevent access-log or application-log output from including passphrases or config response bodies.
- [x] SERV-07 Add server tests for `/`, static asset serving, plain-mode config, and encrypted-mode config.
- [x] SERV-08 Add a server test or regression check that there are no upload routes or file persistence paths.
- [x] SERV-09 Return `Cache-Control: no-store` for `/config.json`.
- [x] SERV-10 Add a regression test that encrypted-mode config is not cacheable.

## Phase 3: Browser App Shell And State Machine

Create the usable browser interface and core state transitions before implementing envelope logic.

- [x] UI-01 Build the initial HTML structure with app title, mode indicator, drop zone, file metadata area, status area, paste button, copy button, and download button.
- [x] UI-02 Add CSS for a minimal responsive layout with clear focus, disabled, drag-over, success, and error states.
- [x] UI-03 Fetch `/config.json` on startup and render plain or passphrase mode.
- [x] UI-04 Detect required browser APIs: File, Blob, URL object URLs, Clipboard, and Web Crypto.
- [x] UI-05 Implement the Empty, LoadedFromDrop, LoadedFromPaste, and transient Error state behavior.
- [x] UI-06 Preserve the previous valid loaded file state after paste or copy failures.
- [x] UI-07 Add status messages for startup, progress, success, and failure conditions listed in the requirements.
- [x] UI-08 Add frontend tests or browser-level checks for initial button enablement and mode display.

## Phase 4: Browser Utility Layer

Implement deterministic browser-side helpers that can be tested independently.

- [x] UTIL-01 Add byte-safe base64 encode and decode helpers with chunking suitable for larger payloads.
- [x] UTIL-02 Add UTF-8 to base64 and base64 to UTF-8 helpers.
- [x] UTIL-03 Add SHA-256 hashing helper that returns lowercase hexadecimal output.
- [x] UTIL-04 Add strict JSON object validation helpers for container and protected-header parsing.
- [x] UTIL-05 Add filename sanitization that removes path separators, control characters, unsafe names, and falls back to `download.bin`.
- [x] UTIL-06 Add user-friendly byte-size formatting for metadata display.
- [ ] UTIL-07 Add tests for arbitrary-byte base64 round trips, UTF-8 helper round trips, SHA-256 known vectors, and filename sanitization edge cases.

## Phase 5: Plain Envelope Drop, Copy, And Download

Deliver the plain-mode round trip for one dropped file.

- [x] ENV-01 Define constants for prefix `FILECLIP/1:`, protected-header kind, schema `1`, and mode `plain-base64`.
- [x] ENV-02 Implement plain-mode protected-header creation with `kind`, `schema`, `mode`, `createdUtc`, and file metadata.
- [x] ENV-03 Implement plain-mode envelope serialization with strict container fields `protectedB64` and `payloadB64`.
- [x] DROP-00 Reject multi-file drops with a clear `Drop one file at a time` message instead of silently selecting the first file.
- [x] DROP-01 Accept exactly one dropped file at a time and replace the current loaded state on successful drop.
- [x] DROP-02 Read dropped file bytes in the browser and capture name, MIME type, size, and SHA-256.
- [x] DROP-03 Build a plain `FILECLIP/1` envelope after a successful drop when the app is in plain mode.
- [x] COPY-01 Enable copy only after a valid loaded state exists.
- [x] COPY-02 Write the current envelope text to the clipboard from the copy button handler.
- [x] COPY-03 Report clipboard write success and failure without corrupting loaded state.
- [x] COPY-04 Report copy success as copied to the local clipboard without implying a remote machine has received it.
- [x] DL-01 Enable download only after a valid loaded state exists.
- [x] DL-02 Download loaded bytes through a Blob URL using the sanitized original filename.
- [x] DL-03 Revoke Blob URLs after use or replacement.
- [ ] ENV-04 Add tests for plain envelope serialization and strict container shape.
- [ ] DROP-04 Add browser/manual checks for drop, copy, and download in plain mode.
- [x] DROP-05 Use `application/octet-stream` when the browser does not provide a MIME type.
- [ ] DROP-06 Add a browser/manual check for dropping file A, then file B in the same app instance; file B must become the active file for UI metadata, copy, and download.

## Phase 6: Clipboard Paste And Plain Hydration

Validate clipboard text and hydrate plain envelopes back into downloadable bytes.

- [x] PASTE-01 Read clipboard text from the paste button handler.
- [x] PASTE-02 Reject clipboard text that does not start with `FILECLIP/1:`.
- [x] PASTE-03 Reject malformed container JSON.
- [x] PASTE-04 Reject containers with missing, non-string, or unknown fields.
- [x] PASTE-05 Decode and validate the protected header using exact schema `1` rules.
- [x] PASTE-06 Reject unsupported schema values and unknown protected-header fields.
- [x] PASTE-07 Reject encrypted envelopes in plain-mode instances.
- [x] PASTE-08 Decode plain payload bytes and verify declared size and SHA-256.
- [x] PASTE-09 Hydrate UI state from valid plain envelopes and enable copy/download.
- [x] PASTE-10 Preserve previous valid loaded state after invalid paste attempts.
- [ ] PASTE-11 Add tests for missing prefix, malformed JSON, unsupported schema, unknown fields, mode mismatch, size mismatch, and hash mismatch.
- [ ] PASTE-12 Add browser/manual checks for copying a plain dropped file and pasting it into another plain-mode app instance.

## Phase 7: Passphrase Encryption Mode

Add encrypted envelope generation and hydration using browser Web Crypto.

- [x] CRYPTO-01 Define encrypted mode constant `aes-gcm-pbkdf2-sha256`.
- [x] CRYPTO-02 Generate a random salt and IV per encrypted envelope.
- [x] CRYPTO-03 Derive AES-GCM 256-bit keys from the passphrase using PBKDF2/SHA-256 with 300,000 iterations.
- [x] CRYPTO-04 Build encrypted protected headers with required KDF and cipher parameters.
- [x] CRYPTO-05 Encrypt file bytes with AES-GCM and authenticate the exact `protectedB64` string as additional authenticated data.
- [x] CRYPTO-06 Serialize encrypted envelopes without including the passphrase.
- [x] CRYPTO-07 Reject plain envelopes in encrypted-mode instances by default.
- [x] CRYPTO-08 Decrypt encrypted payloads with the current passphrase and envelope crypto parameters.
- [x] CRYPTO-09 Report wrong passphrase or metadata tampering as decryption refusal.
- [x] CRYPTO-10 Verify decrypted size and SHA-256 before hydrating UI state.
- [x] CRYPTO-11 Regenerate a new encrypted envelope with fresh salt and IV when copying a file loaded from paste.
- [ ] CRYPTO-12 Add tests for encrypted round trip, wrong passphrase rejection, header tamper rejection, payload tamper rejection, mode mismatch, and fresh salt/IV regeneration.
- [ ] CRYPTO-13 Add browser/manual checks for encrypted transfer between two app instances with the same passphrase.

## Phase 8: Error Handling, Compatibility, And Large Payload Behavior

Harden the user-facing behavior around expected browser, clipboard, and payload failures.

- [x] ERR-01 Map all required error conditions to clear status messages.
- [x] ERR-02 Ensure unsupported-browser startup errors disable unavailable actions while leaving the page understandable.
- [x] ERR-03 Wrap file read, hashing, encoding, encryption, clipboard, decoding, decryption, and download operations with failure handling.
- [x] ERR-04 Ensure large-payload failures show the documented large-payload message when possible.
- [x] ERR-05 Confirm invalid operations never log envelope contents, payload bytes, or passphrases.
- [ ] ERR-06 Add tests or browser checks for clipboard read failure, clipboard write failure, malformed payloads, and unsupported API paths where practical.
- [x] ERR-07 Ensure long-running browser operations yield visible progress/status and do not leave the UI in a misleading ready state.

## Phase 9: Documentation And Verification

Prepare the project for practical use and future implementation sessions.

- [x] DOC-01 Add user-facing README content covering purpose, install/run commands, plain mode, passphrase mode, limitations, and safety notes.
- [x] DOC-02 Add user-facing troubleshooting docs for clipboard permission errors, browser support, large payload limits, and passphrase mismatch.
- [ ] DOC-03 Update development docs if implementation choices diverge from the requirements or design specification.
- [x] DOC-04 Add a concise manual verification checklist mapped to the acceptance tests in `dev/docs/requirements.md`.
- [x] DOC-05 Document that `--passphrase-prompt` avoids shell-history and process-list exposure but does not prevent the browser from receiving the passphrase through local launch config.
- [x] DOC-06 Document that encrypted mode protects payload bytes but does not hide envelope metadata such as filename, MIME type, size, or SHA-256.
- [x] QA-01 Run the full Python test suite with `uv run pytest`.
- [x] QA-02 Run any configured frontend or browser checks.
- [ ] QA-03 Perform manual plain-mode drop/copy/paste/download verification.
- [ ] QA-04 Perform manual encrypted-mode drop/copy/paste/download verification.
- [x] QA-05 Build the package with `uv build` and confirm the console script is present.
- [x] QA-06 Install the built wheel in a clean environment and verify the static UI can be served.

## Future Work

These tasks are intentionally excluded from the initial implementation unless requirements change.

- [ ] FUT-01 Investigate browser-entered passphrases so the raw passphrase does not need to be served through `/config.json`.
- [ ] FUT-02 Investigate chunked or streaming envelope formats for very large files.
- [ ] FUT-03 Investigate optional compression before encryption for compressible inputs.
- [ ] FUT-04 Investigate local-only HTTPS for stricter browser API environments.
- [ ] FUT-05 Investigate multi-file or folder envelope support.
