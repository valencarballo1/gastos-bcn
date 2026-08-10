import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiRequest,
  clearSessionState,
  setUnauthorizedHandler,
} from "./api";
import { householdApi } from "./householdApi";

describe("apiRequest", () => {
  beforeEach(() => {
    clearSessionState();
    setUnauthorizedHandler(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("envía la cookie de sesión en todas las peticiones", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await apiRequest("/hogares");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/hogares$/),
      expect.objectContaining({ credentials: "include", method: "GET" }),
    );
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("obtiene CSRF antes de escribir y envía la cabecera indicada", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "csrf-token",
            headerName: "X-CSRF-TOKEN",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1 }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );

    await apiRequest("/hogares", {
      method: "POST",
      body: JSON.stringify({ name: "Casa" }),
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/auth\/csrf$/),
      expect.objectContaining({ credentials: "include" }),
    );
    const writeInit = vi.mocked(fetch).mock.calls[1][1] as RequestInit;
    expect(new Headers(writeInit.headers).get("X-CSRF-TOKEN")).toBe(
      "csrf-token",
    );
    expect(writeInit.credentials).toBe("include");
  });

  it("renueva CSRF y reintenta una sola vez cuando el token es inválido", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        token: "csrf-expired",
        headerName: "X-CSRF-TOKEN",
      }))
      .mockResolvedValueOnce(jsonResponse({
        error: true,
        code: "CSRF_INVALID",
        message: "Token inválido.",
      }, 400))
      .mockResolvedValueOnce(jsonResponse({
        token: "csrf-renewed",
        headerName: "X-CSRF-TOKEN",
      }))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }, 201));

    await apiRequest("/hogares", {
      method: "POST",
      body: JSON.stringify({ name: "Casa" }),
    });

    expect(fetch).toHaveBeenCalledTimes(4);
    const retriedWrite = vi.mocked(fetch).mock.calls[3][1] as RequestInit;
    expect(new Headers(retriedWrite.headers).get("X-CSRF-TOKEN")).toBe(
      "csrf-renewed",
    );
  });

  it("bloquea la mutación si el servidor no puede entregar CSRF", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      error: true,
      code: "CSRF_UNAVAILABLE",
      message: "No se pudo preparar CSRF.",
      traceId: "trace-csrf",
    }, 503));

    await expect(
      apiRequest("/hogares", {
        method: "POST",
        body: JSON.stringify({ name: "Casa" }),
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: "CSRF_UNAVAILABLE",
      traceId: "trace-csrf",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("notifica y limpia la sesión cuando la API responde 401", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      error: true,
      code: "AUTH_REQUIRED",
      message: "Sin sesión.",
    }, 401));

    await expect(apiRequest("/hogares")).rejects.toMatchObject({
      status: 401,
      code: "AUTH_REQUIRED",
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("acepta respuestas 204 sin intentar parsear JSON", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "csrf-token",
            headerName: "X-CSRF-TOKEN",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(
      apiRequest<void>("/auth/logout", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  it("conserva fieldErrors y traceId de la API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "VALIDATION_ERROR",
          message: "Revisá los campos.",
          fieldErrors: { participants: ["El reparto no coincide."] },
          traceId: "trace-123",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const promise = apiRequest("/hogares");
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        participants: ["El reparto no coincide."],
      },
      traceId: "trace-123",
    });
  });

  it("completa registro, sesión CSRF y creación de hogar", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({
        id: "7", name: "María Prueba", email: "maria@example.com",
        initials: "MP", color: "#4F7C65", provider: "password",
      }, 201))
      .mockResolvedValueOnce(jsonResponse({
        token: "csrf-after-register", headerName: "X-CSRF-TOKEN",
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: "12", name: "Casa Prueba", currency: "EUR", timezone: "Europe/Madrid",
      }, 201));

    await householdApi.auth.register({
      fullName: "María Prueba",
      email: "maria@example.com",
      password: "clave-segura-123",
    });
    await householdApi.households.create({
      name: "Casa Prueba", currency: "EUR", timezone: "Europe/Madrid",
    });

    expect(fetch).toHaveBeenCalledTimes(3);
    const register = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(register.credentials).toBe("include");
    expect(new Headers(register.headers).has("X-CSRF-TOKEN")).toBe(false);
    expect(JSON.parse(String(register.body))).toEqual({
      fullName: "María Prueba", email: "maria@example.com", password: "clave-segura-123",
    });
    const create = vi.mocked(fetch).mock.calls[2][1] as RequestInit;
    expect(new Headers(create.headers).get("X-CSRF-TOKEN")).toBe("csrf-after-register");
    expect(JSON.parse(String(create.body))).toEqual({
      name: "Casa Prueba", currency: "EUR", timezone: "Europe/Madrid",
    });
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
