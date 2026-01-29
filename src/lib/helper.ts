import { STORAGE_KEYS } from './config';

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

export const getDeviceName = (): string | null =>
  localStorage.getItem(STORAGE_KEYS.DEVICE_NAME);

export const getDeviceId = (): string | null =>
  localStorage.getItem(STORAGE_KEYS.DEVICE_ID);

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
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  }

  if (!localStorage.getItem(STORAGE_KEYS.DEVICE_NAME)) {
    localStorage.setItem(STORAGE_KEYS.DEVICE_NAME, deviceId);
  }

  if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
    localStorage.setItem(STORAGE_KEYS.THEME, 'light');
  }
}

// ==========================================
// UI Helpers
// ==========================================

export async function loadComponent(
  elementId: string,
  componentPath: string
): Promise<void> {
  const container = document.getElementById(elementId);
  if (!container) return;

  try {
    const prefix = window.location.pathname.includes('/pages/')
      ? '../'
      : '';

    const response = await fetch(prefix + componentPath);
    if (!response.ok) {
      throw new Error(`Failed to load ${componentPath}`);
    }

    container.innerHTML = await response.text();
  } catch (error) {
    console.error('Component Load Error:', error);
  }
}

export function updateProfileUI(): void {
  const nameElements =
    document.querySelectorAll<HTMLElement>(
      '#user-name-display, .profile-name'
    );

  const name = getDeviceName() ?? '';
  nameElements.forEach(el => {
    el.textContent = name;
  });
}

export function setTheme(theme: 'light' | 'dark' | string): void {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  document.documentElement.setAttribute('data-theme', theme);
}
