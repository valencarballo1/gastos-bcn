import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiRequest,
  clearSessionState,
} from "./api";

describe("apiRequest", () => {
  beforeEach(() => {
    clearSessionState();
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
});
