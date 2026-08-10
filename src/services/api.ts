import {
  authDebug,
  authErrorSummary,
  safeDiagnosticPath,
  safeResponseUrl,
} from "./authDebug";

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

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_API_URL = "https://localhost:7021";

let csrf: CsrfToken | null = null;
let unauthorizedHandler: (() => void) | null = null;

function getApiUrl() {
  const configured = process.env.VITE_API_URL ?? DEFAULT_API_URL;
  return configured.replace(/\/+$/, "");
}

export const API_URL = getApiUrl();

function apiEndpoint(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}/api${normalizedPath}`;
}

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

export async function readApiError(response: Response): Promise<ApiError> {
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

export async function fetchCsrfToken(): Promise<string> {
  if (csrf) {
    authDebug("csrf.cache.hit", {
      headerName: csrf.headerName,
      tokenPresent: true,
    });
    return csrf.token;
  }

  authDebug("csrf.request.started", {
    method: "GET",
    path: "/api/auth/csrf",
  });

  const response = await fetch(apiEndpoint("/auth/csrf"), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  authDebug("csrf.response.received", {
    method: "GET",
    path: "/api/auth/csrf",
    status: response.status,
    ok: response.ok,
    redirected: response.redirected,
    responseUrl: safeResponseUrl(response.url),
  });

  if (!response.ok) {
    const error = await readApiError(response);
    authDebug("csrf.response.failed", authErrorSummary(error));
    clearSessionState();
    if (response.status === 401) {
      authDebug("session.unauthorized.handler", {
        source: "/api/auth/csrf",
      });
      unauthorizedHandler?.();
    }
    throw error;
  }

  csrf = unwrapApiResponse<CsrfToken>(await readPayload(response));
  if (!csrf?.token || !csrf.headerName) {
    csrf = null;
    throw new ApiError({
      status: 500,
      code: "INVALID_CSRF_RESPONSE",
      message: "La API no devolvió un token CSRF válido.",
    });
  }

  authDebug("csrf.ready", {
    headerName: csrf.headerName,
    tokenPresent: true,
  });

  return csrf.token;
}

function isCsrfInvalid(error: ApiError) {
  return (
    error.code === "CSRF_INVALID" ||
    (error.status === 400 &&
      /csrf|xsrf|antiforgery|anti-forgery/i.test(
        `${error.code} ${error.message}`,
      ))
  );
}

function isCsrfError(error: ApiError) {
  return isCsrfInvalid(error) || error.code === "CSRF_UNAVAILABLE";
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retryCsrf = true,
  notifyUnauthorized = true,
  requireCsrf = true,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const isMutation = !SAFE_METHODS.has(method);
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (isMutation && requireCsrf) {
    await fetchCsrfToken();
    headers.set(csrf!.headerName, csrf!.token);
  }

  const diagnosticPath = safeDiagnosticPath(path);
  const isAuthRequest = diagnosticPath.startsWith("/auth/");
  if (isAuthRequest) {
    authDebug("api.request.started", {
      method,
      path: `/api${diagnosticPath}`,
      isMutation,
    });
  }

  const response = await fetch(apiEndpoint(path), {
    ...init,
    method,
    headers,
    credentials: "include",
  });

  if (isAuthRequest || response.status === 401) {
    authDebug("api.response.received", {
      method,
      path: `/api${diagnosticPath}`,
      status: response.status,
      ok: response.ok,
      redirected: response.redirected,
      responseUrl: safeResponseUrl(response.url),
    });
  }

  if (!response.ok) {
    const error = await readApiError(response);

    if (isAuthRequest || response.status === 401) {
      authDebug("api.response.failed", {
        method,
        path: `/api${diagnosticPath}`,
        ...authErrorSummary(error),
      });
    }

    if (response.status === 401) {
      clearSessionState();
      if (notifyUnauthorized) {
        authDebug("session.unauthorized.handler", {
          source: `/api${diagnosticPath}`,
        });
        unauthorizedHandler?.();
      }
    }

    if (isCsrfError(error)) clearSessionState();

    if (retryCsrf && isMutation && isCsrfInvalid(error)) {
      return apiRequest<T>(path, init, false, notifyUnauthorized, requireCsrf);
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
    const validationMessages = Object.values(error.fieldErrors).flat();
    if (error.status === 400 && validationMessages.length) {
      return validationMessages.join(" ");
    }
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
