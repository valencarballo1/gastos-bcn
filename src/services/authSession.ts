import { ApiError } from "./api";
import { householdApi } from "./householdApi";
import type { UserAccount } from "@/types";
import {
  authDebug,
  authErrorSummary,
  authUserSummary,
  safeDiagnosticPath,
} from "./authDebug";

const OAUTH_PENDING_KEY = "casa-clara:oauth-pending";
const SESSION_RETRY_DELAYS = [0, 250, 750, 1500];

export function markOAuthPending() {
  window.sessionStorage.setItem(OAUTH_PENDING_KEY, "1");
}

export function clearOAuthPending() {
  window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
}

/**
 * The OAuth callback can redirect the browser immediately after committing the
 * session. Some distributed backends need a brief moment before /auth/me sees
 * it. Only retry after a login we initiated, never during an ordinary visit.
 */
export async function restoreAuthSession(): Promise<UserAccount> {
  const returningFromOAuth =
    window.sessionStorage.getItem(OAUTH_PENDING_KEY) === "1";
  const delays = returningFromOAuth ? SESSION_RETRY_DELAYS : [0];

  authDebug("session.restore.started", {
    returningFromOAuth,
    route: safeDiagnosticPath(
      `${window.location.pathname}${window.location.search}`,
    ),
    maxAttempts: delays.length,
  });

  for (let index = 0; index < delays.length; index += 1) {
    if (delays[index] > 0) await wait(delays[index]);

    authDebug("session.me.request", {
      attempt: index + 1,
      delayMs: delays[index],
    });

    try {
      const user = await householdApi.auth.me();
      authDebug("session.me.succeeded", {
        attempt: index + 1,
        response: authUserSummary(user),
      });
      clearOAuthPending();
      return user;
    } catch (error) {
      const canRetry =
        error instanceof ApiError &&
        error.status === 401 &&
        index < delays.length - 1;
      authDebug("session.me.failed", {
        attempt: index + 1,
        willRetry: canRetry,
        ...authErrorSummary(error),
      });
      if (!canRetry) {
        clearOAuthPending();
        throw error;
      }
    }
  }

  throw new Error("No se pudo restaurar la sesión.");
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}
