// src/utils/encryption.js
//
// AES-256-GCM helper used to encrypt/decrypt the MeroShare session token
// before it is persisted to MongoDB (User.meroshareToken).
//
// GCM gives us authenticated encryption — any tampering with the stored
// ciphertext (or a wrong key) causes decryption to fail loudly instead of
// silently returning garbage.
//
// Stored format:  "<ivHex>:<authTagHex>:<ciphertextHex>"
//
// Required env var:
//   MEROSHARE_TOKEN_ENCRYPTION_KEY — 64 hex chars (32 bytes / 256 bits)
//   Generate one with:
//     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
const crypto = require("crypto");
const logger = require("./logger");

const ALGORITHM  = "aes-256-gcm";
const IV_LENGTH  = 12; // 96-bit IV — recommended size for GCM
const KEY_LENGTH = 32; // 256-bit key

let cachedKey = null;

// Reads + validates the encryption key from env. Throws a clear error if
// it's missing or the wrong length — we want this to fail loudly at
// startup, not silently corrupt/lose tokens at runtime.
function getKey() {
  if (cachedKey) return cachedKey;

  const keyHex = process.env.MEROSHARE_TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "MEROSHARE_TOKEN_ENCRYPTION_KEY is not set. Generate one with: " +
      `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" ` +
      "and add it to your .env file."
    );
  }

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `MEROSHARE_TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ` +
      `Got ${key.length} bytes instead.`
    );
  }

  cachedKey = key;
  return cachedKey;
}

// Called once at server startup so a missing/bad key fails the boot
// immediately (same "fail loudly" philosophy used for the DB connection
// in src/index.js), instead of blowing up on the first login attempt.
function validateEncryptionKey() {
  getKey();
}

// Encrypts a plaintext string. Returns null for null/undefined/empty input
// so callers can do `meroshareToken: encrypt(client.token)` without extra
// null-checking — clearing the token still just stores null.
function encrypt(plainText) {
  if (plainText === null || plainText === undefined || plainText === "") {
    return null;
  }

  const key    = getKey();
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

// Decrypts a string previously produced by encrypt(). Returns null if the
// input is empty, malformed, or fails authentication (tampered data, wrong
// key, or — importantly — a legacy plaintext token saved before this
// encryption layer existed). Callers treat a null result the same way they
// already treat a missing token: as an expired MeroShare session, which
// safely forces a fresh login.
function decrypt(payload) {
  if (payload === null || payload === undefined || payload === "") {
    return null;
  }

  const parts = String(payload).split(":");
  if (parts.length !== 3) {
    logger.warn(
      "⚠️  Stored meroshareToken is not in the expected encrypted format " +
      "(likely a legacy plaintext token) — treating session as expired."
    );
    return null;
  }

  try {
    const key = getKey();
    const [ivHex, authTagHex, ciphertextHex] = parts;

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, "hex")),
      decipher.final(),
    ]);

    return plaintext.toString("utf8");
  } catch (e) {
    logger.warn(`⚠️  Failed to decrypt meroshareToken: ${e.message}`);
    return null;
  }
}

module.exports = { encrypt, decrypt, validateEncryptionKey };