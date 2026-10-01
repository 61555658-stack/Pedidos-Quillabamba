import { useCallback, useRef, useState } from 'react';

type BrowserStateUpdater<T> = T | ((current: T) => T);

/**
 * Synchronously persists a panel dataset in this browser's localStorage.
 * A missing key is a normal first-use condition; read/write failures are
 * returned to the caller and are never treated as successful saves.
 */
export function useBrowserState<T>(
  key: string,
  initialValue: T,
): [T, (next: BrowserStateUpdater<T>) => boolean, string | null] {
  const [loaded] = useState(() => {
    try {
      if (typeof window === 'undefined') return { value: initialValue, error: null as string | null };
      const stored = window.localStorage.getItem(key);
      return {
        value: stored === null ? initialValue : JSON.parse(stored) as T,
        error: null as string | null,
      };
    } catch (error) {
      return {
        value: initialValue,
        error: `No se pudieron leer los datos guardados en este navegador: ${error instanceof Error ? error.message : 'error de almacenamiento'}`,
      };
    }
  });
  const [value, setValue] = useState<T>(loaded.value);
  const valueRef = useRef(value);
  const [storageError, setStorageError] = useState<string | null>(loaded.error);

  const save = useCallback((next: BrowserStateUpdater<T>) => {
    const resolved = typeof next === 'function'
      ? (next as (current: T) => T)(valueRef.current)
      : next;
    try {
      if (typeof window === 'undefined') throw new Error('El almacenamiento del navegador no está disponible.');
      window.localStorage.setItem(key, JSON.stringify(resolved));
      valueRef.current = resolved;
      setValue(resolved);
      setStorageError(null);
      return true;
    } catch (error) {
      setStorageError(`No se pudieron guardar los cambios en este navegador: ${error instanceof Error ? error.message : 'error de almacenamiento'}`);
      return false;
    }
  }, [key]);

  return [value, save, storageError];
}