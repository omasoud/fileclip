# Changelog

All notable changes to this project will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Release notes are grouped by version and category. Dates use the `YYYY-MM-DD`
format.

## [1.0.0] - 2026-06-23

### Added

- Added the local FileClip browser app for packaging one file into a
  `FILECLIP/1` clipboard envelope and hydrating compatible envelopes back into
  downloadable files.
- Added plain base64 envelope mode and passphrase-protected AES-GCM envelope
  mode.
- Added CLI launch options for loopback host, port, browser opening, explicit
  passphrases, and hidden passphrase prompts.
- Added PyPI package metadata, installation guidance, tests, and trusted
  publishing through GitHub Actions.

### Changed

- Promoted FileClip to a stable `1.0.0` PyPI release.
- Warn when a copied envelope is large enough that Chromium on Windows may not
  be able to paste it back through the browser Clipboard API.

### Fixed

- Reused the cached envelope for dropped files during copy instead of rebuilding
  large payloads.
- Report empty or unreadable clipboard text separately from non-FileClip
  payloads.

## [0.1.0] - 2026-06-23

### Added

- Added the initial FileClip GitHub release with MIT licensing and PyPI
  publishing setup.

[1.0.0]: https://github.com/omasoud/fileclip/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/omasoud/fileclip/releases/tag/v0.1.0
