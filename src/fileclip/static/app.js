(() => {
  "use strict";

  const PREFIX = "FILECLIP/1:";
  const KIND = "fileclip.envelope";
  const SCHEMA = 1;
  const CONFIG_PLAIN_MODE = "plain";
  const CONFIG_ENCRYPTED_MODE = "encrypted";
  const PLAIN_MODE = "plain-base64";
  const ENCRYPTED_MODE = "aes-gcm-pbkdf2-sha256";
  const DEFAULT_MIME = "application/octet-stream";
  const KDF_ITERATIONS = 300000;
  const SALT_BYTES = 16;
  const IV_BYTES = 12;
  const BASE64_CHUNK_SIZE = 0x8000;
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder("utf-8", { fatal: true });
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ICONS = {
    clipboard:
      '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>',
    copy:
      '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>',
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line>',
    file:
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path>',
    fileArchive:
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 12v-1"></path><path d="M10 18v-2"></path><path d="M10 7V6"></path>',
    fileText:
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>',
    fileUp:
      '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M12 12v6"></path><path d="m15 15-3-3-3 3"></path>',
    image:
      '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path>',
    lock:
      '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
    lockOpen:
      '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>',
  };

  class FileClipError extends Error {
    constructor(message) {
      super(message);
      this.name = "FileClipError";
    }
  }

  const messages = {
    clipboardRead: "Clipboard read failed or permission was denied.",
    clipboardWrite: "Clipboard write failed or permission was denied.",
    missingPrefix: "Clipboard does not contain a FileClip payload.",
    malformed: "Clipboard payload is malformed.",
    unsupportedSchema: "Clipboard payload uses an unsupported schema version.",
    modeMismatch: "Clipboard payload mode does not match this app instance.",
    wrongPassphrase:
      "Clipboard payload is valid, but cannot be decrypted with this instance's passphrase.",
    hashMismatch: "Decoded file failed integrity verification.",
    sizeMismatch: "Decoded file size does not match the envelope metadata.",
    largePayload:
      "The operation failed. The file may be too large for this browser, clipboard, or sync path.",
    unsupportedBrowser:
      "This browser does not support the required File, Clipboard, Blob, or Web Crypto APIs.",
  };

  const state = {
    config: null,
    loaded: null,
    busy: false,
    objectUrl: null,
    supported: false,
  };

  const els = {};

  function requireElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing required element: ${id}`);
    }
    return element;
  }

  function collectElements() {
    els.shell = document.querySelector(".page-shell");
    els.appVersion = requireElement("appVersion");
    els.modeBadge = requireElement("modeBadge");
    els.modeSubtitle = requireElement("modeSubtitle");
    els.dropZone = requireElement("dropZone");
    els.fileInput = requireElement("fileInput");
    els.status = requireElement("status");
    els.pasteButton = requireElement("pasteButton");
    els.copyButton = requireElement("copyButton");
    els.downloadButton = requireElement("downloadButton");
  }

  function createIcon(name, className = "icon") {
    const icon = document.createElementNS(SVG_NS, "svg");
    icon.setAttribute("class", className);
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = ICONS[name] || ICONS.file;
    return icon;
  }

  function hydrateStaticIcons() {
    document.querySelectorAll("[data-icon]").forEach((element) => {
      element.replaceChildren(createIcon(element.dataset.icon || "file"));
    });
  }

  function appendIconText(parent, className, iconName, text) {
    const element = document.createElement("span");
    element.className = className;
    element.appendChild(createIcon(iconName));
    element.appendChild(document.createTextNode(text));
    parent.appendChild(element);
    return element;
  }

  function hasRequiredApis() {
    return Boolean(
      window.File &&
        window.Blob &&
        window.URL &&
        URL.createObjectURL &&
        URL.revokeObjectURL &&
        navigator.clipboard &&
        navigator.clipboard.readText &&
        navigator.clipboard.writeText &&
        window.crypto &&
        crypto.subtle &&
        crypto.getRandomValues,
    );
  }

  function setStatus(message, tone = "neutral") {
    els.status.textContent = message;
    els.status.className = `status status-${tone}`;
  }

  function setBusy(isBusy) {
    state.busy = isBusy;
    if (els.shell) {
      els.shell.setAttribute("aria-busy", String(isBusy));
    }
    renderControls();
  }

  function renderControls() {
    const canUse = state.supported && !state.busy;
    const hasLoaded = Boolean(state.loaded);
    els.pasteButton.disabled = !canUse;
    els.copyButton.disabled = !canUse || !hasLoaded;
    els.downloadButton.disabled = !canUse || !hasLoaded;
    els.dropZone.setAttribute("aria-disabled", String(!canUse));
  }

  function appendTextElement(parent, tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function shortHash(hash) {
    if (typeof hash !== "string" || hash.length <= 16) {
      return hash || "-";
    }
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  }

  function currentEncodingDetails() {
    if (state.config && state.config.mode === CONFIG_ENCRYPTED_MODE) {
      return { icon: "lock", text: "encrypted - AES-GCM" };
    }
    return { icon: "lockOpen", text: "plain - base64" };
  }

  function fileIconName(file) {
    const mime = String(file.mime || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    if (
      mime.startsWith("image/") ||
      /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/.test(name)
    ) {
      return "image";
    }
    if (
      mime.includes("zip") ||
      mime.includes("archive") ||
      mime.includes("gzip") ||
      mime.includes("tar") ||
      /\.(7z|gz|rar|tar|tgz|zip)$/.test(name)
    ) {
      return "fileArchive";
    }
    if (
      mime.startsWith("text/") ||
      mime.includes("json") ||
      mime.includes("xml") ||
      /\.(csv|json|log|md|txt|xml|yaml|yml)$/.test(name)
    ) {
      return "fileText";
    }
    return "file";
  }

  function renderEmptyZone() {
    els.dropZone.classList.remove("is-loaded");
    els.dropZone.classList.add("is-empty");
    const empty = document.createElement("div");
    empty.className = "empty-zone";
    const emptyIcon = document.createElement("div");
    emptyIcon.className = "empty-icon";
    emptyIcon.appendChild(createIcon("fileUp"));
    empty.appendChild(emptyIcon);
    appendTextElement(empty, "div", "empty-title", "Drop one file here");
    appendTextElement(empty, "div", "empty-subtitle", "or choose a file from this browser");
    els.dropZone.replaceChildren(empty);
  }

  function renderFileZone() {
    if (!state.loaded) {
      renderEmptyZone();
      return;
    }
    const file = state.loaded.file;
    els.dropZone.classList.remove("is-empty");
    els.dropZone.classList.add("is-loaded");

    const card = document.createElement("div");
    card.className = "file-card";

    const main = document.createElement("div");
    main.className = "file-card-main";
    const fileIcon = document.createElement("div");
    fileIcon.className = "file-icon";
    fileIcon.appendChild(createIcon(fileIconName(file)));
    main.appendChild(fileIcon);

    const text = document.createElement("div");
    text.className = "file-text";
    appendTextElement(text, "div", "file-name", file.name || "(unnamed)");
    appendTextElement(
      text,
      "div",
      "file-meta",
      `${formatBytes(file.size)} - ${file.mime || DEFAULT_MIME}`,
    );
    main.appendChild(text);
    card.appendChild(main);

    const hashRow = document.createElement("div");
    hashRow.className = "file-row file-row-mono";
    appendTextElement(hashRow, "span", "", "sha256");
    appendTextElement(hashRow, "span", "", shortHash(file.sha256));
    card.appendChild(hashRow);

    const stateRow = document.createElement("div");
    stateRow.className = "file-row";
    const encoding = currentEncodingDetails();
    appendIconText(stateRow, "encoding-tag", encoding.icon, encoding.text);
    appendTextElement(
      stateRow,
      "span",
      "file-direction",
      state.loaded.source === "paste" ? "verified - ready to download" : "ready to copy",
    );
    card.appendChild(stateRow);

    els.dropZone.replaceChildren(card);
  }

  function setLoaded(loaded, statusMessage) {
    revokeObjectUrl();
    state.loaded = loaded;
    renderFileZone();
    renderControls();
    setStatus(statusMessage, "success");
  }

  function preserveStateError(message) {
    setStatus(message, "error");
    renderControls();
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
      const chunk = bytes.subarray(index, index + BASE64_CHUNK_SIZE);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    if (typeof value !== "string" || value.length % 4 !== 0) {
      throw new FileClipError(messages.malformed);
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
      throw new FileClipError(messages.malformed);
    }
    let binary;
    try {
      binary = atob(value);
    } catch (_error) {
      throw new FileClipError(messages.malformed);
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function utf8ToBase64(value) {
    return bytesToBase64(textEncoder.encode(value));
  }

  function base64ToUtf8(value) {
    try {
      return textDecoder.decode(base64ToBytes(value));
    } catch (error) {
      if (error instanceof FileClipError) {
        throw error;
      }
      throw new FileClipError(messages.malformed);
    }
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function formatBytes(size) {
    if (!Number.isFinite(size) || size < 0) {
      return "-";
    }
    const units = ["B", "KiB", "MiB", "GiB"];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    if (unitIndex === 0) {
      return `${value} ${units[unitIndex]}`;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  function sanitizeFilename(name) {
    let sanitized = String(name || "")
      .replace(/[\\/]/g, "_")
      .replace(/[\x00-\x1f\x7f]/g, "")
      .replace(/[<>:"|?*]/g, "_")
      .trim()
      .replace(/[. ]+$/g, "");
    if (!sanitized) {
      return "download.bin";
    }
    const baseName = sanitized.split(".")[0].toUpperCase();
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(baseName)) {
      sanitized = `file-${sanitized}`;
    }
    return sanitized || "download.bin";
  }

  function assertPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new FileClipError(messages.malformed);
    }
  }

  function assertExactKeys(value, expectedKeys) {
    const actual = Object.keys(value).sort();
    const expected = [...expectedKeys].sort();
    if (actual.length !== expected.length) {
      throw new FileClipError(messages.malformed);
    }
    for (let index = 0; index < expected.length; index += 1) {
      if (actual[index] !== expected[index]) {
        throw new FileClipError(messages.malformed);
      }
    }
  }

  function validateContainer(container) {
    assertPlainObject(container);
    assertExactKeys(container, ["protectedB64", "payloadB64"]);
    if (
      typeof container.protectedB64 !== "string" ||
      typeof container.payloadB64 !== "string"
    ) {
      throw new FileClipError(messages.malformed);
    }
  }

  function validateFileMetadata(file) {
    assertPlainObject(file);
    assertExactKeys(file, ["mime", "name", "sha256", "size"]);
    if (
      typeof file.name !== "string" ||
      typeof file.mime !== "string" ||
      !Number.isSafeInteger(file.size) ||
      file.size < 0 ||
      typeof file.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    ) {
      throw new FileClipError(messages.malformed);
    }
  }

  function validateCryptoParams(cryptoParams) {
    assertPlainObject(cryptoParams);
    assertExactKeys(cryptoParams, ["cipher", "kdf"]);
    assertPlainObject(cryptoParams.kdf);
    assertExactKeys(cryptoParams.kdf, ["hash", "iterations", "name", "saltB64"]);
    assertPlainObject(cryptoParams.cipher);
    assertExactKeys(cryptoParams.cipher, ["ivB64", "length", "name"]);
    if (
      cryptoParams.kdf.name !== "PBKDF2" ||
      cryptoParams.kdf.hash !== "SHA-256" ||
      !Number.isSafeInteger(cryptoParams.kdf.iterations) ||
      cryptoParams.kdf.iterations <= 0 ||
      typeof cryptoParams.kdf.saltB64 !== "string" ||
      cryptoParams.cipher.name !== "AES-GCM" ||
      cryptoParams.cipher.length !== 256 ||
      typeof cryptoParams.cipher.ivB64 !== "string"
    ) {
      throw new FileClipError(messages.malformed);
    }
    if (base64ToBytes(cryptoParams.kdf.saltB64).length < SALT_BYTES) {
      throw new FileClipError(messages.malformed);
    }
    if (base64ToBytes(cryptoParams.cipher.ivB64).length !== IV_BYTES) {
      throw new FileClipError(messages.malformed);
    }
  }

  function validateHeader(header) {
    assertPlainObject(header);
    if (header.schema !== SCHEMA) {
      throw new FileClipError(messages.unsupportedSchema);
    }
    if (header.mode === PLAIN_MODE) {
      assertExactKeys(header, ["createdUtc", "file", "kind", "mode", "schema"]);
    } else if (header.mode === ENCRYPTED_MODE) {
      assertExactKeys(header, ["createdUtc", "crypto", "file", "kind", "mode", "schema"]);
    } else {
      throw new FileClipError(messages.modeMismatch);
    }
    if (
      header.kind !== KIND ||
      typeof header.createdUtc !== "string" ||
      Number.isNaN(Date.parse(header.createdUtc))
    ) {
      throw new FileClipError(messages.malformed);
    }
    validateFileMetadata(header.file);
    if (header.mode === ENCRYPTED_MODE) {
      validateCryptoParams(header.crypto);
    }
    return header;
  }

  function parseEnvelope(text) {
    if (typeof text !== "string" || !text.startsWith(PREFIX)) {
      throw new FileClipError(messages.missingPrefix);
    }
    let container;
    try {
      container = JSON.parse(text.slice(PREFIX.length));
    } catch (_error) {
      throw new FileClipError(messages.malformed);
    }
    validateContainer(container);
    let header;
    try {
      header = JSON.parse(base64ToUtf8(container.protectedB64));
    } catch (error) {
      if (error instanceof FileClipError) {
        throw error;
      }
      throw new FileClipError(messages.malformed);
    }
    validateHeader(header);
    return { container, header };
  }

  function appEnvelopeMode() {
    if (!state.config) {
      return null;
    }
    return state.config.mode === CONFIG_ENCRYPTED_MODE ? ENCRYPTED_MODE : PLAIN_MODE;
  }

  function ensureModeCompatible(header) {
    if (header.mode !== appEnvelopeMode()) {
      throw new FileClipError(messages.modeMismatch);
    }
  }

  function normalizeFileMetadata(file) {
    return {
      name: file.name,
      mime: file.mime || DEFAULT_MIME,
      size: file.size,
      sha256: file.sha256,
    };
  }

  async function verifyPayload(bytes, file) {
    if (bytes.length !== file.size) {
      throw new FileClipError(messages.sizeMismatch);
    }
    const hash = await sha256Hex(bytes);
    if (hash !== file.sha256) {
      throw new FileClipError(messages.hashMismatch);
    }
  }

  function buildProtectedHeader(file, mode, cryptoParams = null) {
    const header = {
      kind: KIND,
      schema: SCHEMA,
      mode,
      createdUtc: new Date().toISOString(),
      file: normalizeFileMetadata(file),
    };
    if (cryptoParams) {
      header.crypto = cryptoParams;
    }
    return header;
  }

  async function deriveAesGcmKey(passphrase, salt, iterations) {
    const passphraseKey = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      passphraseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async function buildPlainEnvelope(bytes, file) {
    const header = buildProtectedHeader(file, PLAIN_MODE);
    const protectedB64 = utf8ToBase64(JSON.stringify(header));
    const payloadB64 = bytesToBase64(bytes);
    return `${PREFIX}${JSON.stringify({ protectedB64, payloadB64 })}`;
  }

  async function buildEncryptedEnvelope(bytes, file) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const cryptoParams = {
      kdf: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: KDF_ITERATIONS,
        saltB64: bytesToBase64(salt),
      },
      cipher: {
        name: "AES-GCM",
        length: 256,
        ivB64: bytesToBase64(iv),
      },
    };
    const header = buildProtectedHeader(file, ENCRYPTED_MODE, cryptoParams);
    const protectedB64 = utf8ToBase64(JSON.stringify(header));
    const key = await deriveAesGcmKey(state.config.passphrase, salt, KDF_ITERATIONS);
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: textEncoder.encode(protectedB64),
      },
      key,
      bytes,
    );
    const payloadB64 = bytesToBase64(new Uint8Array(ciphertext));
    return `${PREFIX}${JSON.stringify({ protectedB64, payloadB64 })}`;
  }

  async function buildEnvelope(bytes, file) {
    if (state.config.mode === CONFIG_ENCRYPTED_MODE) {
      return buildEncryptedEnvelope(bytes, file);
    }
    return buildPlainEnvelope(bytes, file);
  }

  async function hydratePlainEnvelope(container, header) {
    const bytes = base64ToBytes(container.payloadB64);
    await verifyPayload(bytes, header.file);
    return {
      source: "paste",
      bytes,
      file: normalizeFileMetadata(header.file),
      envelope: null,
    };
  }

  async function hydrateEncryptedEnvelope(container, header) {
    let plaintext;
    try {
      const salt = base64ToBytes(header.crypto.kdf.saltB64);
      const iv = base64ToBytes(header.crypto.cipher.ivB64);
      const ciphertext = base64ToBytes(container.payloadB64);
      const key = await deriveAesGcmKey(
        state.config.passphrase,
        salt,
        header.crypto.kdf.iterations,
      );
      plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: textEncoder.encode(container.protectedB64),
        },
        key,
        ciphertext,
      );
    } catch (_error) {
      throw new FileClipError(messages.wrongPassphrase);
    }
    const bytes = new Uint8Array(plaintext);
    await verifyPayload(bytes, header.file);
    return {
      source: "paste",
      bytes,
      file: normalizeFileMetadata(header.file),
      envelope: null,
    };
  }

  async function hydrateEnvelope(text) {
    const { container, header } = parseEnvelope(text);
    ensureModeCompatible(header);
    if (header.mode === ENCRYPTED_MODE) {
      return hydrateEncryptedEnvelope(container, header);
    }
    return hydratePlainEnvelope(container, header);
  }

  async function readFile(file) {
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async function loadDroppedFile(file) {
    setBusy(true);
    try {
      setStatus("Reading file...", "progress");
      await nextFrame();
      const bytes = await readFile(file);
      setStatus("Hashing file...", "progress");
      await nextFrame();
      const sha256 = await sha256Hex(bytes);
      const metadata = {
        name: file.name,
        mime: file.type || DEFAULT_MIME,
        size: bytes.length,
        sha256,
      };
      setStatus(
        state.config.mode === CONFIG_ENCRYPTED_MODE
          ? "Encrypting file..."
          : "Encoding envelope...",
        "progress",
      );
      await nextFrame();
      const envelope = await buildEnvelope(bytes, metadata);
      setLoaded(
        {
          source: "drop",
          bytes,
          file: metadata,
          envelope,
        },
        "Ready to copy.",
      );
    } catch (error) {
      preserveStateError(error instanceof FileClipError ? error.message : messages.largePayload);
    } finally {
      setBusy(false);
    }
  }

  function fileFromDropEvent(event) {
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
    if (files.length !== 1) {
      throw new FileClipError("Drop one file at a time.");
    }
    return files[0];
  }

  async function handleDrop(event) {
    event.preventDefault();
    els.dropZone.classList.remove("drag-over");
    if (!state.supported || state.busy) {
      return;
    }
    try {
      await loadDroppedFile(fileFromDropEvent(event));
    } catch (error) {
      preserveStateError(error instanceof FileClipError ? error.message : String(error));
    }
  }

  async function handleFileInput(event) {
    if (!state.supported || state.busy) {
      return;
    }
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length !== 1) {
      preserveStateError("Choose one file at a time.");
      return;
    }
    await loadDroppedFile(files[0]);
  }

  async function copyCurrentFile() {
    if (!state.loaded || state.busy) {
      return;
    }
    setBusy(true);
    try {
      setStatus(
        state.config.mode === CONFIG_ENCRYPTED_MODE
          ? "Encrypting file..."
          : "Encoding envelope...",
        "progress",
      );
      await nextFrame();
      const envelope = await buildEnvelope(state.loaded.bytes, state.loaded.file);
      setStatus("Writing clipboard...", "progress");
      await nextFrame();
      await navigator.clipboard.writeText(envelope);
      state.loaded.envelope = envelope;
      setStatus("Copied envelope to local clipboard.", "success");
    } catch (_error) {
      preserveStateError(messages.clipboardWrite);
    } finally {
      setBusy(false);
    }
  }

  async function pasteEnvelope() {
    if (state.busy) {
      return;
    }
    setBusy(true);
    try {
      setStatus("Reading clipboard...", "progress");
      await nextFrame();
      const text = await navigator.clipboard.readText();
      setStatus("Validating clipboard payload...", "progress");
      await nextFrame();
      const loaded = await hydrateEnvelope(text);
      setLoaded(loaded, "Ready to download.");
    } catch (error) {
      if (error instanceof FileClipError) {
        preserveStateError(error.message);
      } else {
        preserveStateError(messages.clipboardRead);
      }
    } finally {
      setBusy(false);
    }
  }

  function revokeObjectUrl() {
    if (!state.objectUrl) {
      return;
    }
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  function downloadCurrentFile() {
    if (!state.loaded || state.busy) {
      return;
    }
    try {
      revokeObjectUrl();
      const file = state.loaded.file;
      const blob = new Blob([state.loaded.bytes], { type: file.mime || DEFAULT_MIME });
      state.objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = state.objectUrl;
      anchor.download = sanitizeFilename(file.name);
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(revokeObjectUrl, 1000);
      setStatus("Download prepared.", "success");
    } catch (_error) {
      preserveStateError("Download preparation failed.");
    }
  }

  async function loadConfig() {
    const response = await fetch("/config.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load launch configuration.");
    }
    const config = await response.json();
    if (
      config.app !== "fileclip" ||
      typeof config.version !== "string" ||
      config.schema !== SCHEMA ||
      ![CONFIG_PLAIN_MODE, CONFIG_ENCRYPTED_MODE].includes(config.mode)
    ) {
      throw new Error("Launch configuration is invalid.");
    }
    if (config.mode === CONFIG_ENCRYPTED_MODE && typeof config.passphrase !== "string") {
      throw new Error("Encrypted mode is missing a passphrase.");
    }
    if (config.mode === CONFIG_PLAIN_MODE && "passphrase" in config) {
      throw new Error("Plain mode must not include a passphrase.");
    }
    state.config = config;
    els.appVersion.textContent = `v${config.version}`;
    if (config.mode === CONFIG_ENCRYPTED_MODE) {
      els.modeBadge.className = "mode-badge mode-passphrase";
      els.modeBadge.replaceChildren(
        createIcon("lock"),
        document.createTextNode("Passphrase mode"),
      );
      els.modeSubtitle.textContent =
        "Files are encrypted in your browser before encoding. Envelopes only open with the matching passphrase.";
    } else {
      els.modeBadge.className = "mode-badge mode-plain";
      els.modeBadge.replaceChildren(
        createIcon("lockOpen"),
        document.createTextNode("Plain mode"),
      );
      els.modeSubtitle.textContent =
        "Files are base64-encoded into the envelope. No encryption - anyone with the text can rebuild the file.";
    }
  }

  function wireEvents() {
    els.dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (state.supported && !state.busy) {
        els.dropZone.classList.add("drag-over");
      }
    });
    els.dropZone.addEventListener("dragleave", () => {
      els.dropZone.classList.remove("drag-over");
    });
    els.dropZone.addEventListener("drop", handleDrop);
    els.dropZone.addEventListener("click", () => {
      if (state.supported && !state.busy) {
        els.fileInput.click();
      }
    });
    els.dropZone.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && state.supported && !state.busy) {
        event.preventDefault();
        els.fileInput.click();
      }
    });
    els.fileInput.addEventListener("change", handleFileInput);
    els.copyButton.addEventListener("click", copyCurrentFile);
    els.pasteButton.addEventListener("click", pasteEnvelope);
    els.downloadButton.addEventListener("click", downloadCurrentFile);
  }

  async function init() {
    collectElements();
    hydrateStaticIcons();
    wireEvents();
    if (!hasRequiredApis()) {
      state.supported = false;
      els.modeBadge.className = "mode-badge mode-unsupported";
      els.modeBadge.textContent = "Unsupported";
      els.modeSubtitle.textContent = "This browser is missing an API FileClip needs.";
      renderControls();
      setStatus(messages.unsupportedBrowser, "error");
      return;
    }
    try {
      await loadConfig();
      state.supported = true;
      renderFileZone();
      renderControls();
      setStatus("Ready.", "neutral");
    } catch (error) {
      state.supported = false;
      renderControls();
      setStatus(error.message || "Failed to start FileClip.", "error");
    }
  }

  window.FileClipTest = {
    PREFIX,
    KIND,
    SCHEMA,
    PLAIN_MODE,
    ENCRYPTED_MODE,
    bytesToBase64,
    base64ToBytes,
    utf8ToBase64,
    base64ToUtf8,
    sanitizeFilename,
    formatBytes,
  };

  document.addEventListener("DOMContentLoaded", init);
})();
