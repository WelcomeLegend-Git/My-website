import localforage from 'localforage';
import type { StoredKeyPair } from '../types';
import { toBase64, fromBase64, encryptKeyBackup, decryptKeyBackup } from './crypto';

const STORE_KEY = 'vault-keypair';

const store = localforage.createInstance({
  name: 'the-vault',
  storeName: 'keys',
});

/**
 * Save a keypair to IndexedDB.
 */
export async function saveKeyPair(
  publicKey: Uint8Array,
  privateKey: Uint8Array
): Promise<void> {
  const stored: StoredKeyPair = {
    publicKey: toBase64(publicKey),
    privateKey: toBase64(privateKey),
    createdAt: Date.now(),
  };
  await store.setItem(STORE_KEY, stored);
}

/**
 * Load the keypair from IndexedDB.
 * Returns null if no keypair exists.
 */
export async function loadKeyPair(): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
} | null> {
  const stored = await store.getItem<StoredKeyPair>(STORE_KEY);
  if (!stored) return null;
  return {
    publicKey: fromBase64(stored.publicKey),
    privateKey: fromBase64(stored.privateKey),
  };
}

/**
 * Check if a keypair exists in storage.
 */
export async function hasKeyPair(): Promise<boolean> {
  const stored = await store.getItem<StoredKeyPair>(STORE_KEY);
  return stored !== null;
}

/**
 * Delete the keypair from storage.
 */
export async function clearKeyPair(): Promise<void> {
  await store.removeItem(STORE_KEY);
}

/**
 * Export keypair as a downloadable backup file.
 * The backup is encrypted with a user-provided passphrase using Argon2id.
 */
export async function exportKeyBackup(passphrase: string): Promise<void> {
  const kp = await loadKeyPair();
  if (!kp) throw new Error('No keypair to export');

  const backup = encryptKeyBackup(kp.privateKey, kp.publicKey, passphrase);
  
  const payload = JSON.stringify({
    version: 1,
    type: 'vault-key-backup',
    encrypted: backup.encrypted,
    salt: backup.salt,
    createdAt: new Date().toISOString(),
  });

  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vault-key-backup-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Import a keypair from a backup file.
 */
export async function importKeyBackup(
  file: File,
  passphrase: string
): Promise<void> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  
  if (parsed.type !== 'vault-key-backup' || !parsed.encrypted || !parsed.salt) {
    throw new Error('Invalid backup file format');
  }

  const { publicKey, privateKey } = decryptKeyBackup(
    parsed.encrypted,
    parsed.salt,
    passphrase
  );

  await saveKeyPair(publicKey, privateKey);
}
