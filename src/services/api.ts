export type ApiFieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly error = true;
  readonly code: string;
  readonly fieldErrors: ApiFieldErrors;
  readonly traceId?: string;
  readonly status: number;

  constructor(input: {
    status: number;
    code?: string;
    message: string;
    fieldErrors?: ApiFieldErrors;
    traceId?: string;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code ?? "HTTP_ERROR";
    this.fieldErrors = input.fieldErrors ?? {};
    this.traceId = input.traceId;
  }
}

type CsrfToken = {
  token: string;
  headerName: string;
};

type ApiEnvelope<T> = {
  result?: T;
  Result?: T;
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const DEFAULT_API_URL = "https://localhost:7021/api";

let csrf: CsrfToken | null = null;
let unauthorizedHandler: (() => void) | null = null;

function getApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;
  return configured.replace(/\/+$/, "");
}

export const API_URL = getApiUrl();

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function clearSessionState() {
  csrf = null;
}

export function unwrapApiResponse<T>(data: unknown): T {
  if (data && typeof data === "object") {
    const envelope = data as ApiEnvelope<T>;
    if ("result" in envelope || "Result" in envelope) {
      return (envelope.result ?? envelope.Result) as T;
    }
  }
  return data as T;
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return undefined;
  return response.json().catch(() => undefined);
}

async function readError(response: Response): Promise<ApiError> {
  const payload = (await readPayload(response)) as
    | {
        code?: string;
        Code?: string;
        message?: string;
        Message?: string;
        fieldErrors?: ApiFieldErrors;
        FieldErrors?: ApiFieldErrors;
        traceId?: string;
        TraceId?: string;
      }
    | undefined;

  return new ApiError({
    status: response.status,
    code: payload?.code ?? payload?.Code,
    message:
      payload?.message ??
      payload?.Message ??
      statusMessage(response.status),
    fieldErrors: payload?.fieldErrors ?? payload?.FieldErrors,
    traceId: payload?.traceId ?? payload?.TraceId,
  });
}

async function getCsrf(): Promise<CsrfToken> {
  if (csrf) return csrf;

  const response = await fetch(`${API_URL}/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok) throw await readError(response);

  csrf = unwrapApiResponse<CsrfToken>(await readPayload(response));
  if (!csrf?.token || !csrf.headerName) {
    csrf = null;
    throw new ApiError({
      status: 500,
      code: "INVALID_CSRF_RESPONSE",
      message: "La API no devolvió un token CSRF válido.",
    });
  }
  return csrf;
}

function isAntiforgeryError(error: ApiError) {
  return (
    error.status === 400 &&
    /csrf|xsrf|antiforgery|anti-forgery/i.test(
      `${error.code} ${error.message}`,
    )
  );
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retryCsrf = true,
  notifyUnauthorized = true,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (WRITE_METHODS.has(method)) {
    const xsrf = await getCsrf();
    headers.set(xsrf.headerName, xsrf.token);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await readError(response);

    if (response.status === 401) {
      clearSessionState();
      if (notifyUnauthorized) unauthorizedHandler?.();
    }

    if (retryCsrf && WRITE_METHODS.has(method) && isAntiforgeryError(error)) {
      clearSessionState();
      return apiRequest<T>(path, init, false, notifyUnauthorized);
    }

    throw error;
  }

  return unwrapApiResponse<T>(await readPayload(response));
}

export function apiPath(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "No tenés permisos para realizar esta acción en este hogar.";
    }
    if (error.status === 404) {
      return "El recurso ya no existe o no pertenece al hogar actual.";
    }
    if (error.status === 409) {
      return `${error.message} Recargá los datos antes de volver a intentarlo.`;
    }
    if (error.status === 422) {
      return error.message || "El estado actual no permite realizar esta acción.";
    }
    if (error.status >= 500) {
      return `${error.message}${error.traceId ? ` · Referencia: ${error.traceId}` : ""}`;
    }
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : "No pudimos completar la operación. Intentá nuevamente.";
}

function statusMessage(status: number) {
  if (status === 400) return "Revisá los datos enviados.";
  if (status === 401) return "Tu sesión terminó. Volvé a iniciar sesión.";
  if (status === 403) return "No tenés permisos en este hogar.";
  if (status === 404) return "No encontramos el recurso solicitado.";
  if (status === 409) return "Los datos cambiaron mientras estabas editando.";
  if (status === 422) return "La acción no está permitida en el estado actual.";
  if (status >= 500) return "La API tuvo un problema temporal.";
  return `Error HTTP ${status}`;
}
