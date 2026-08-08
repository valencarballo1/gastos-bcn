import { describe, expect, it } from "vitest";
import {
  authUserSummary,
  safeDiagnosticPath,
  safeResponseUrl,
} from "./authDebug";

describe("authDebug", () => {
  it("describe la respuesta de sesión sin registrar identidad ni URLs privadas", () => {
    const summary = authUserSummary({
      id: "google-sub-sensitive",
      name: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: "https://images.example/private-avatar",
      provider: "google",
      initials: "AL",
      color: "#4F7C65",
    });
    const serialized = JSON.stringify(summary);

    expect(summary).toMatchObject({
      validObject: true,
      hasId: true,
      hasName: true,
      hasEmail: true,
      hasAvatarUrl: true,
      provider: "google",
    });
    expect(serialized).not.toContain("google-sub-sensitive");
    expect(serialized).not.toContain("Ada Lovelace");
    expect(serialized).not.toContain("ada@example.com");
    expect(serialized).not.toContain("private-avatar");
  });

  it("oculta identificadores, invitaciones y parámetros de las rutas", () => {
    expect(safeDiagnosticPath("/invite/secret-token?code=oauth-code")).toBe(
      "/invite/:token",
    );
    expect(safeDiagnosticPath("/h/42/tasks?filter=mine")).toBe(
      "/h/:householdId/tasks",
    );
    expect(
      safeResponseUrl("https://frontend.example/invite/secret-token?code=123"),
    ).toBe("https://frontend.example/invite/:token");
  });
});
