# FileClip Manual Verification

Use this checklist after automated tests pass.

- [ ] Open `uv run fileclip serve` and confirm drop and paste are enabled while copy and download are disabled.
- [ ] Drop a small text file in plain mode and confirm filename, size, MIME type, and SHA-256 display.
- [ ] Copy the plain envelope, paste it into another plain-mode instance, and download identical bytes.
- [ ] Paste arbitrary clipboard text and confirm the existing loaded file, if any, is preserved.
- [ ] Paste malformed `FILECLIP/1` JSON and confirm a clear malformed-payload message.
- [ ] Paste a schema `2` envelope and confirm an unsupported-schema message.
- [ ] Launch two instances with `--passphrase-prompt`, copy from one, paste into the other, and download identical bytes.
- [ ] Paste an encrypted envelope into an instance with the wrong passphrase and confirm hydration is refused.
- [ ] Paste an encrypted envelope into plain mode and confirm a mode-mismatch message.
- [ ] Paste a plain envelope into encrypted mode and confirm a mode-mismatch message.
- [ ] Drop a file with path-like or unsafe filename characters and confirm the download name is sanitized.
- [ ] Drop file A, then file B, and confirm file B becomes the active metadata, copy, and download target.
- [ ] Attempt a multi-file drop and confirm FileClip rejects it with `Drop one file at a time`.
- [ ] Try the intended large-file workflow and confirm failures are reported without crashing the page.
