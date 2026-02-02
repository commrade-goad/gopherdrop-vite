const isBrowser = typeof window !== 'undefined';

const IS_LOCALHOST: boolean = isBrowser
  ? window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  : false;

// URL Config
const PROD_HOST = 'mulyono.tailf5d620.ts.net';
const LOCAL_HOST = 'localhost:8080';

export const API_BASE_URL: string = IS_LOCALHOST
  ? `http://${LOCAL_HOST}/api/v1`
  : `https://${PROD_HOST}/api/v1`;

// Headers for Ngrok
export const API_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json',
  // 'ngrok-skip-browser-warning': 'true',
};

// Storage Keys
export const STORAGE_KEYS = {
  PRIVATE_KEY:     'gdrop_private_key',
  PUBLIC_KEY:      'gdrop_public_key',
  THEME:           'gdrop-theme',
  TOKEN:           'gdrop_token',
  SELECTED_FILE:   'gdrop_sel_file',
  TRANSACTION_REQ: 'gopherdrop-transaction-request',
  GROUPS:          'gdrop_groups',
} as const;

// Optional helper type if you want strict key usage elsewhere
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
