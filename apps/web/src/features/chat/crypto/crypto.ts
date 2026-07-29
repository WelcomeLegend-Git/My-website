import sodium from 'libsodium-wrappers';

let ready = false;

/**
 * Initialize the libsodium WASM module. Must be called once before any crypto ops.
 */
export async function initCrypto(): Promise<void> {
  if (ready) return;
  await sodium.ready;
  ready = true;
}

function ensureReady() {
  if (!ready) throw new Error('Crypto not initialized. Call initCrypto() first.');
}

// ─── Key Generation ───

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

/**
 * Generate a new Curve25519 keypair for authenticated encryption.
 * Uses crypto_box_keypair (X25519 + XSalsa20-Poly1305).
 */
export function generateKeyPair(): KeyPair {
  ensureReady();
  const kp = sodium.crypto_box_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

// ─── Serialization ───

export function toBase64(bytes: Uint8Array): string {
  ensureReady();
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL);
}

export function fromBase64(b64: string): Uint8Array {
  ensureReady();
  return sodium.from_base64(b64, sodium.base64_variants.ORIGINAL);
}

// ─── Fingerprint / Invite Code ───

/**
 * Derive a 6-character invite code from a public key.
 * Uses BLAKE2b hash, then Base32-encodes the first 4 bytes.
 */
export function getFingerprint(publicKey: Uint8Array): string {
  ensureReady();
  const hash = sodium.crypto_generichash(16, publicKey);
  // Base32 encode first 4 bytes → 6-7 chars, take first 6
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 4 && code.length < 6; i++) {
    code += chars[hash[i] % chars.length];
    code += chars[(hash[i] >> 4) % chars.length];
  }
  return code.slice(0, 6);
}

// ─── Authenticated Public-Key Encryption (Messages) ───

export interface EncryptedMessage {
  ciphertext: string; // Base64
  nonce: string; // Base64
}

/**
 * Encrypt a message using crypto_box_easy.
 * Provides both confidentiality AND sender authentication.
 * Only the recipient can decrypt, and they can verify it came from the sender.
 */
export function encryptMessage(
  plaintext: string,
  recipientPublicKey: Uint8Array,
  senderPrivateKey: Uint8Array
): EncryptedMessage {
  ensureReady();
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const message = sodium.from_string(plaintext);
  const ciphertext = sodium.crypto_box_easy(message, nonce, recipientPublicKey, senderPrivateKey);
  return {
    ciphertext: toBase64(ciphertext),
    nonce: toBase64(nonce),
  };
}

/**
 * Decrypt a message using crypto_box_open_easy.
 * Verifies the message came from the claimed sender.
 */
export function decryptMessage(
  ciphertextB64: string,
  nonceB64: string,
  senderPublicKey: Uint8Array,
  recipientPrivateKey: Uint8Array
): string {
  ensureReady();
  const ciphertext = fromBase64(ciphertextB64);
  const nonce = fromBase64(nonceB64);
  const decrypted = sodium.crypto_box_open_easy(ciphertext, nonce, senderPublicKey, recipientPrivateKey);
  return sodium.to_string(decrypted);
}

// ─── Symmetric Encryption (Media Files) ───

export interface EncryptedMedia {
  encryptedBytes: Uint8Array;
  key: string; // Base64
  nonce: string; // Base64
}

/**
 * Encrypt binary data using crypto_secretbox_easy with a random key.
 * Used for encrypting photo files before uploading to Supabase Storage.
 */
export function encryptMedia(data: Uint8Array): EncryptedMedia {
  ensureReady();
  const key = sodium.crypto_secretbox_keygen();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const encrypted = sodium.crypto_secretbox_easy(data, nonce, key);
  return {
    encryptedBytes: encrypted,
    key: toBase64(key),
    nonce: toBase64(nonce),
  };
}

/**
 * Decrypt binary data using crypto_secretbox_open_easy.
 * Used for decrypting downloaded photo blobs.
 */
export function decryptMedia(
  encryptedBytes: Uint8Array,
  keyB64: string,
  nonceB64: string
): Uint8Array {
  ensureReady();
  const key = fromBase64(keyB64);
  const nonce = fromBase64(nonceB64);
  return sodium.crypto_secretbox_open_easy(encryptedBytes, nonce, key);
}

// ─── Key Backup Encryption ───

/**
 * Encrypt a keypair backup with a user-chosen passphrase.
 * Uses Argon2id key derivation + crypto_secretbox.
 */
export function encryptKeyBackup(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
  passphrase: string
): { encrypted: string; salt: string } {
  ensureReady();
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const derivedKey = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    passphrase,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  
  // Combine pubkey + privkey into one payload
  const payload = new Uint8Array(publicKey.length + privateKey.length);
  payload.set(publicKey, 0);
  payload.set(privateKey, publicKey.length);
  
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(payload, nonce, derivedKey);
  
  // Pack nonce + ciphertext
  const packed = new Uint8Array(nonce.length + ciphertext.length);
  packed.set(nonce, 0);
  packed.set(ciphertext, nonce.length);
  
  return {
    encrypted: toBase64(packed),
    salt: toBase64(salt),
  };
}

/**
 * Decrypt a keypair backup using the passphrase.
 */
export function decryptKeyBackup(
  encryptedB64: string,
  saltB64: string,
  passphrase: string
): { publicKey: Uint8Array; privateKey: Uint8Array } {
  ensureReady();
  const salt = fromBase64(saltB64);
  const derivedKey = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    passphrase,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT
  );
  
  const packed = fromBase64(encryptedB64);
  const nonce = packed.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = packed.slice(sodium.crypto_secretbox_NONCEBYTES);
  
  const payload = sodium.crypto_secretbox_open_easy(ciphertext, nonce, derivedKey);
  
  const pubKeyLen = sodium.crypto_box_PUBLICKEYBYTES;
  return {
    publicKey: payload.slice(0, pubKeyLen),
    privateKey: payload.slice(pubKeyLen),
  };
}
