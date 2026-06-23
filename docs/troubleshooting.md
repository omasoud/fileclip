# FileClip Troubleshooting

## Clipboard Permission Errors

Clipboard read and write operations must be triggered by button clicks and may still be blocked by the browser. Use `Paste from clipboard` and `Copy to clipboard` from the FileClip page, and make sure the page is served from `127.0.0.1` or `localhost`.

## Unsupported Browser

FileClip requires modern browser support for File, Blob URL, Clipboard, and Web Crypto APIs. Try a current Chromium, Firefox, or Safari release if startup reports missing browser support.

## Large Payload Failures

FileClip does not set a fixed file-size cap. A transfer can still fail because the browser, clipboard, clipboard manager, or external clipboard-sync path cannot handle the generated text envelope. Try a smaller archive or a different sync path.

## Passphrase Mismatch

Encrypted envelopes can only be hydrated by an app instance launched with the same passphrase. A wrong passphrase, modified encrypted payload, or modified protected metadata is reported as a decryption refusal.

## Metadata Visibility

Encrypted mode protects file bytes, but metadata in the protected header remains visible in the clipboard envelope. This includes the filename, MIME type, file size, and SHA-256 hash.
