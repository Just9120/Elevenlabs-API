import { useEffect, useRef } from "react";

const PREFIX = "studio-form-draft:v1:";
const MAX_LENGTH = 100_000;

export function readFormDraft(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw || raw.length > MAX_LENGTH) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearFormDrafts() {
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
  } catch { /* Storage can be unavailable; forms remain usable. */ }
}

// Only explicit, bounded metadata enters this hook. Never pass File/blob,
// credentials, capabilities, transcript text or transport URLs.
export function useFormDraft(key: string | null, value: unknown, restore: (value: unknown) => void) {
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const readyKey = useRef<string | null>(null);
  const skipInitialWrite = useRef(false);
  useEffect(() => {
    readyKey.current = key;
    skipInitialWrite.current = true;
    if (key) {
      const saved = readFormDraft(key);
      if (saved !== null) restoreRef.current(saved);
    }
  }, [key]);
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!key || readyKey.current !== key) return;
    if (skipInitialWrite.current) { skipInitialWrite.current = false; return; }
    if (serialized.length > MAX_LENGTH) return;
    try { sessionStorage.setItem(PREFIX + key, serialized); } catch { /* Storage quota/private mode. */ }
  }, [key, serialized]);
}
