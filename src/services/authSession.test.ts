import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { householdApi } from "./householdApi";
import {
  markOAuthPending,
  restoreAuthSession,
} from "./authSession";

describe("restoreAuthSession", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("reintenta un 401 al regresar del flujo OAuth", async () => {
    vi.useFakeTimers();
    const user = {
      id: "1",
      name: "Ada",
      email: "ada@example.com",
      initials: "A",
      color: "#fff",
      provider: "google" as const,
    };
    vi.spyOn(householdApi.auth, "me")
      .mockRejectedValueOnce(unauthorized())
      .mockResolvedValue(user);

    markOAuthPending();
    const restored = restoreAuthSession();
    await vi.runAllTimersAsync();

    await expect(restored).resolves.toEqual(user);
    expect(householdApi.auth.me).toHaveBeenCalledTimes(2);
    await expect(restoreAuthSession()).resolves.toEqual(user);
    expect(householdApi.auth.me).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("no reintenta un visitante que no inició OAuth", async () => {
    vi.spyOn(householdApi.auth, "me").mockRejectedValue(unauthorized());

    await expect(restoreAuthSession()).rejects.toMatchObject({ status: 401 });
    expect(householdApi.auth.me).toHaveBeenCalledOnce();
  });
});

function unauthorized() {
  return new ApiError({ status: 401, message: "Sin sesión" });
}
