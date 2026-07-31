import { describe, expect, it } from "vitest";
import { invitationToken, invitationUrl } from "./invitations";
import type { HouseholdInvitation } from "@/types";

describe("enlaces de invitación", () => {
  it("acepta el enlace con query string documentado por la API", () => {
    expect(
      invitationToken(invitation({
        token: "",
        inviteUrl: "https://app.example.com/?invite=token-original",
      })),
    ).toBe("token-original");
  });

  it("acepta enlaces con la ruta /invite", () => {
    expect(
      invitationToken(invitation({
        token: "",
        inviteUrl: "https://app.example.com/invite/token%20original",
      })),
    ).toBe("token original");
  });

  it("construye un enlace web cuando el backend devuelve solo el token", () => {
    expect(invitationUrl(invitation({ token: "a/b" }))).toBe(
      "http://localhost:3000/invite/a%2Fb",
    );
  });
});

function invitation(
  overrides: Partial<HouseholdInvitation>,
): HouseholdInvitation {
  return {
    id: "1",
    householdId: "1",
    role: "member",
    mode: "link",
    token: "token",
    status: "pending",
    createdAt: "2026-07-31T00:00:00Z",
    expiresAt: "2026-08-07T00:00:00Z",
    ...overrides,
  };
}
