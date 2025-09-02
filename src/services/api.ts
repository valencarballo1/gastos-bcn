export interface ApiEnvelope<T> {
  error?: boolean;
  Error?: boolean;
  message?: string;
  Message?: string;
  result?: T;
  Result?: T;
}

export function unwrapApiResponse<T>(data: unknown): T {
  if (data == null) return data as T;
  if (typeof data === 'object') {
    const envelope = data as ApiEnvelope<T>;
    if ('result' in (data as Record<string, unknown>) || 'Result' in (data as Record<string, unknown>)) {
      return (envelope.result ?? envelope.Result) as T;
    }
  }
  return data as T;
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // ignore json parse error; will throw below if not ok
  }

  if (!res.ok) {
    const payloadObj = (payload ?? {}) as { message?: string; Message?: string };
    const msg = payloadObj.message || payloadObj.Message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return unwrapApiResponse<T>(payload);
}



