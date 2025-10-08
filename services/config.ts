// services/config.ts
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export const USE_MOCK =
  (process.env.NEXT_PUBLIC_USE_MOCK || '1') === '1';

export const SYNC_PULL_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_SYNC_PULL_INTERVAL_MS || 10 * 60 * 1000
);
export const SYNC_PUSH_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_SYNC_PUSH_INTERVAL_MS || 30 * 1000
);
