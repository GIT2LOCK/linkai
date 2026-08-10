import { invoke } from '@tauri-apps/api/core';
import type { CommandResult } from '../types/backend';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export async function callBackend<T>(
  action: string,
  payload: object = {}
): Promise<T> {
  const result = isTauriRuntime()
    ? await invoke<CommandResult<T>>('invoke_backend', { action, payload })
    : await callLocalApi<T>(action, payload);

  if (!result.ok) {
    throw new Error(result.error ?? 'Backend command failed');
  }

  return result.data as T;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
}

async function callLocalApi<T>(
  action: string,
  payload: object
): Promise<CommandResult<T>> {
  const baseUrl = import.meta.env.VITE_LINKAI_API_URL ?? 'http://127.0.0.1:8765';
  const response = await fetch(`${baseUrl}/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    throw new Error(`Local API unavailable: ${response.status}`);
  }

  return (await response.json()) as CommandResult<T>;
}
