import { STORAGE_KEYS } from './config';
import { Group } from './def';

// ==========================================
// Encoding and Decoding Functions
// ==========================================

// Convert ArrayBuffer to Base64 string (Encoding)
export function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// Convert Base64 string to Uint8Array (Decoding)
export function base64ToBuffer(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

// ==========================================
// Storage Helpers (Getters)
// ==========================================

export const getPrivateKey = (): string | null =>
  localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);

export const getPublicKey = (): string | null =>
  localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);

// ==========================================
// Cryptographic Functions
// ==========================================

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true, // extractable
    ['sign', 'verify']
  );
}

export async function saveKeys(keyPair: CryptoKeyPair): Promise<void> {
  // Export Private Key
  const privateKeyBuffer = await crypto.subtle.exportKey(
    'pkcs8',
    keyPair.privateKey
  );
  localStorage.setItem(
    STORAGE_KEYS.PRIVATE_KEY,
    bufferToBase64(privateKeyBuffer)
  );

  // Export Public Key
  const publicKeyBuffer = await crypto.subtle.exportKey(
    'raw',
    keyPair.publicKey
  );
  localStorage.setItem(
    STORAGE_KEYS.PUBLIC_KEY,
    bufferToBase64(publicKeyBuffer)
  );
}

export async function importPrivateKey(): Promise<CryptoKey | null> {
  const base64 = getPrivateKey();
  if (!base64) return null;

  const bytes = base64ToBuffer(base64);
  const buf = bytes.buffer as ArrayBuffer;

  return await crypto.subtle.importKey(
    'pkcs8',
    buf,
    { name: 'Ed25519' },
    false,
    ['sign']
  );
}

export async function signData(
  dataBase64: string,
  privateKey: CryptoKey
): Promise<string> {
  const dataBytes = base64ToBuffer(dataBase64);
  const buf = dataBytes.buffer as ArrayBuffer;

  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    buf
  );

  return bufferToBase64(signature);
}

// ==========================================
// Device ID Functions
// ==========================================

export async function initDeviceIdentity(): Promise<void> {
  if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
    localStorage.setItem(STORAGE_KEYS.THEME, 'light');
  }
}

export function setTheme(theme: 'light' | 'dark' | string): void {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

// ==========================================
// Group Management Functions
// ==========================================

export function getGroups(): Group[] {
  const groupsData = localStorage.getItem(STORAGE_KEYS.GROUPS);
  if (!groupsData) return [];
  try {
    return JSON.parse(groupsData);
  } catch (e) {
    console.error('Error parsing groups:', e);
    return [];
  }
}

export function saveGroups(groups: Group[]): void {
  localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
}

export function addGroup(group: Group): void {
  const groups = getGroups();
  groups.push(group);
  saveGroups(groups);
}

export function deleteGroup(groupName: string): void {
  const groups = getGroups();
  const filtered = groups.filter(g => g.name !== groupName);
  saveGroups(filtered);
}

export function updateGroup(oldName: string, newGroup: Group): void {
  const groups = getGroups();
  const index = groups.findIndex(g => g.name === oldName);
  if (index !== -1) {
    groups[index] = newGroup;
    saveGroups(groups);
  }
}
