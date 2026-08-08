const AUTH_DEBUG_ENABLED = process.env.VITE_AUTH_DEBUG === "true";

type DebugDetails = Record<string, unknown>;

export function authDebug(event: string, details: DebugDetails = {}) {
  if (!AUTH_DEBUG_ENABLED) return;

  console.log(`[Casa Clara Auth] ${event}`, {
    timestamp: new Date().toISOString(),
    ...details,
  });
}

export function authErrorSummary(error: unknown): DebugDetails {
  if (!(error instanceof Error)) {
    return { errorType: typeof error };
  }

  const apiError = error as Error & {
    status?: number;
    code?: string;
    traceId?: string;
  };

  return {
    errorName: apiError.name,
    message: apiError.message,
    status: apiError.status,
    code: apiError.code,
    traceId: apiError.traceId,
  };
}

export function authUserSummary(user: unknown): DebugDetails {
  if (!user || typeof user !== "object") {
    return { responseType: typeof user, validObject: false };
  }

  const record = user as Record<string, unknown>;
  return {
    validObject: true,
    fields: Object.keys(record).sort(),
    hasId: Boolean(record.id),
    hasName: Boolean(record.name),
    hasEmail: Boolean(record.email),
    hasAvatarUrl: Boolean(record.avatarUrl),
    provider: record.provider,
    initials: record.initials,
    color: record.color,
  };
}

export function safeDiagnosticPath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0] || "/";
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "invite" && segments[1]) return "/invite/:token";
  if (segments[0] === "invitaciones" && segments[1]) {
    return `/invitaciones/:token${segments[2] ? `/${segments[2]}` : ""}`;
  }
  if (segments[0] === "h" && segments[1]) {
    return `/h/:householdId${segments[2] ? `/${segments[2]}` : ""}`;
  }
  if (segments[0] === "hogares" && segments[1]) {
    return `/hogares/:householdId${segments
      .slice(2)
      .map((segment) => (/^\d+$/.test(segment) ? ":id" : segment))
      .map((segment) => `/${segment}`)
      .join("")}`;
  }

  return pathname;
}

export function safeResponseUrl(url: string) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${safeDiagnosticPath(parsed.pathname)}`;
  } catch {
    return undefined;
  }
}
