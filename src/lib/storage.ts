import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function readStorage<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function usePersistentState<T>(
  key: string,
  fallback: T | (() => T),
  normalize: (value: unknown) => T = (value) => value as T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const initial = typeof fallback === 'function' ? (fallback as () => T)() : fallback;
    return normalize(readStorage<unknown>(key, initial));
  });

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue];
}
