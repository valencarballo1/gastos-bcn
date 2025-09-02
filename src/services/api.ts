export interface ApiEnvelope<T> {
  error?: boolean;
  Error?: boolean;
  message?: string;
  Message?: string;
  result?: T;
  Result?: T;
}

export function unwrapApiResponse<T>(data: any): T {
  if (data == null) return data as T;
  if (typeof data === 'object') {
    if ('result' in data || 'Result' in data) {
      return (data as ApiEnvelope<T>).result ?? (data as ApiEnvelope<T>).Result as T;
    }
  }
  return data as T;
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    // ignore json parse error; will throw below if not ok
  }

  if (!res.ok) {
    const msg = payload?.message || payload?.Message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return unwrapApiResponse<T>(payload);
}


