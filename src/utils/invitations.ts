import type { HouseholdInvitation } from "@/types";

export function invitationUrl(invitation: HouseholdInvitation): string {
  if (invitation.inviteUrl) return invitation.inviteUrl;
  if (!invitation.token) return "";

  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const site =
    configuredSite ||
    (typeof window === "undefined" ? "" : window.location.origin);
  return `${site}/invite/${encodeURIComponent(invitation.token)}`;
}

export function invitationToken(invitation: HouseholdInvitation): string {
  if (invitation.token) return invitation.token;
  if (!invitation.inviteUrl) return "";

  try {
    const url = new URL(invitation.inviteUrl, "https://casaclara.invalid");
    const pathToken = url.pathname.match(/\/invite\/([^/]+)/)?.[1];
    return decodeURIComponent(pathToken ?? url.searchParams.get("invite") ?? "");
  } catch {
    return "";
  }
}

export async function copyText(value: string): Promise<void> {
  if (!value) throw new Error("La API no devolvió un enlace de invitación.");

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("No se pudo copiar el enlace.");
}
