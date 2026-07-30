"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Home, LoaderCircle, LogIn, Plus, RefreshCw } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityPage } from "@/features/activity/ActivityPage";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { BalancesPage } from "@/features/balances/BalancesPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ExpensesPage } from "@/features/expenses/ExpensesPage";
import { MembersPage } from "@/features/members/MembersPage";
import { RecurringPage } from "@/features/recurring/RecurringPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ShoppingPage } from "@/features/shopping/ShoppingPage";
import { TasksPage } from "@/features/tasks/TasksPage";
import { useHousehold } from "@/hooks/useHousehold";
import {
  ApiError,
  clearSessionState,
  errorMessage,
  setUnauthorizedHandler,
} from "@/services/api";
import {
  householdApi,
  type PublicInvitation,
} from "@/services/householdApi";
import type { UserAccount, ViewKey } from "@/types";

type AppRoute = {
  kind: "login" | "invite" | "households" | "household" | "root";
  householdId?: string;
  invitationToken?: string;
  view: ViewKey;
};

const routeSegments: Record<ViewKey, string> = {
  dashboard: "dashboard",
  expenses: "expenses",
  recurring: "recurring-expenses",
  balances: "balances",
  shopping: "shopping",
  tasks: "tasks",
  calendar: "calendar",
  activity: "activity",
  reports: "reports",
  members: "members",
  settings: "settings",
};

const segmentViews = Object.fromEntries(
  Object.entries(routeSegments).map(([view, segment]) => [segment, view]),
) as Record<string, ViewKey>;

export function HomeApp() {
  const [route, setRoute] = useState<AppRoute>({
    kind: "root",
    view: "dashboard",
  });
  const [routeReady, setRouteReady] = useState(false);
  const [createHouseholdOpen, setCreateHouseholdOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<
    "loading" | "authenticated" | "anonymous"
  >("loading");
  const [authenticatedUser, setAuthenticatedUser] =
    useState<UserAccount | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const {
    data,
    households,
    invitations,
    balances,
    suggestedTransfers,
    status,
    loading,
    mutating,
    error,
    actions,
  } = useHousehold(
    authStatus === "authenticated",
    route.kind === "household" ? route.householdId : undefined,
  );

  const applyLocation = useCallback(() => {
    setRoute(parseRoute(window.location.pathname));
    setRouteReady(true);
  }, []);

  useEffect(() => {
    applyLocation();
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
  }, [applyLocation]);

  const navigatePath = useCallback((path: string, replace = false) => {
    window.history[replace ? "replaceState" : "pushState"](null, "", path);
    setRoute(parseRoute(path));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthenticatedUser(null);
      setAuthStatus("anonymous");
      navigatePath(
        `/login?returnUrl=${encodeURIComponent(
          `${window.location.pathname}${window.location.search}`,
        )}`,
        true,
      );
    });
    return () => setUnauthorizedHandler(null);
  }, [navigatePath]);

  useEffect(() => {
    if (!routeReady) return;
    householdApi.auth
      .me()
      .then((user) => {
        setAuthError(null);
        setAuthenticatedUser(normalizeUser(user));
        setAuthStatus("authenticated");
      })
      .catch((reason) => {
        clearSessionState();
        if (reason instanceof ApiError && reason.status === 401) {
          setAuthError(null);
          setAuthStatus("anonymous");
        } else {
          setAuthError(errorMessage(reason));
          setAuthStatus("anonymous");
        }
      });
  }, [routeReady]);

  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      status !== "ready" ||
      route.kind === "invite" ||
      route.kind === "households" ||
      route.kind === "household"
    ) {
      return;
    }

    if (data.household.id) {
      navigatePath(
        householdPath(data.household.id, "dashboard"),
        true,
      );
    } else {
      navigatePath("/households", true);
    }
  }, [
    authStatus,
    data.household.id,
    navigatePath,
    route.kind,
    status,
  ]);

  const navigateView = (view: ViewKey) => {
    if (!data.household.id) return;
    navigatePath(householdPath(data.household.id, view));
  };

  const signIn = () => {
    const preservedReturnUrl =
      window.location.pathname === "/login"
        ? new URLSearchParams(window.location.search).get("returnUrl")
        : null;
    const returnUrl =
      preservedReturnUrl?.startsWith("/") &&
      !preservedReturnUrl.startsWith("//")
        ? preservedReturnUrl
        : `${window.location.pathname}${window.location.search}`;
    window.location.assign(householdApi.auth.googleLoginUrl(returnUrl));
  };

  const logout = async () => {
    try {
      await householdApi.auth.logout();
    } finally {
      clearSessionState();
      setAuthenticatedUser(null);
      setAuthStatus("anonymous");
      navigatePath("/login", true);
    }
  };

  if (!routeReady || authStatus === "loading") {
    return <AuthScreen loading />;
  }

  if (route.kind === "invite") {
    return (
      <InvitationScreen
        token={route.invitationToken ?? ""}
        authenticated={authStatus === "authenticated"}
        onLogin={signIn}
      />
    );
  }

  if (authStatus === "anonymous") {
    return (
      <AuthScreen
        onGoogleSignIn={signIn}
        error={authError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (loading && !data.household.id && route.kind !== "households") {
    return <LoadingHousehold />;
  }

  if (route.kind === "households" || !data.household.id) {
    return (
      <>
        <HouseholdPicker
          households={households}
          user={authenticatedUser}
          loading={loading}
          error={error}
          onRetry={actions.refresh}
          onSelect={(id) =>
            navigatePath(householdPath(id, "dashboard"))
          }
          onCreate={() => setCreateHouseholdOpen(true)}
          onLogout={logout}
        />
        <CreateHouseholdModal
          open={createHouseholdOpen}
          pending={mutating}
          onClose={() => setCreateHouseholdOpen(false)}
          onCreate={async (name) => {
            const created = await actions.createHousehold(name);
            setCreateHouseholdOpen(false);
            navigatePath(householdPath(created.id, "dashboard"));
          }}
        />
      </>
    );
  }

  const currentMember = data.members.find(
    (member) =>
      member.userId === authenticatedUser?.id ||
      member.email?.toLowerCase() ===
        authenticatedUser?.email.toLowerCase(),
  );
  const canManage =
    currentMember?.role === "owner" || currentMember?.role === "admin";

  return (
    <AppShell
      activeView={route.view}
      onNavigate={navigateView}
      household={data.household}
      members={data.members}
      households={households}
      currentUser={authenticatedUser ?? fallbackUser()}
      onSwitchHousehold={(id) =>
        navigatePath(householdPath(id, "dashboard"))
      }
      onCreateHousehold={() => setCreateHouseholdOpen(true)}
      onLogout={() => void logout()}
      syncing={loading || mutating}
    >
      {error && (
        <div className="api-alert" role="alert">
          <span>{error}</span>
          <button onClick={() => void actions.refresh()}>
            <RefreshCw size={15} /> Reintentar
          </button>
          <button
            className="api-alert-dismiss"
            aria-label="Cerrar aviso"
            onClick={actions.clearError}
          >
            ×
          </button>
        </div>
      )}

      {route.view === "dashboard" && (
        <DashboardPage
          data={data}
          suggestedTransfers={suggestedTransfers}
          onNavigate={navigateView}
        />
      )}
      {route.view === "expenses" && (
        <ExpensesPage data={data} addExpense={actions.addExpense} />
      )}
      {route.view === "recurring" && (
        <RecurringPage
          data={data}
          addRecurringExpense={actions.addRecurringExpense}
          toggleRecurringStatus={actions.toggleRecurringStatus}
        />
      )}
      {route.view === "balances" && (
        <BalancesPage
          data={data}
          balances={balances}
          suggestedTransfers={suggestedTransfers}
          addSettlement={actions.addSettlement}
        />
      )}
      {route.view === "shopping" && (
        <ShoppingPage
          data={data}
          addShoppingItem={actions.addShoppingItem}
          toggleShoppingItem={actions.toggleShoppingItem}
          removeShoppingItem={actions.removeShoppingItem}
          finalizeShopping={actions.finalizeShopping}
        />
      )}
      {route.view === "tasks" && (
        <TasksPage
          data={data}
          addTask={actions.addTask}
          setTaskStatus={actions.setTaskStatus}
          toggleChecklist={actions.toggleChecklist}
        />
      )}
      {route.view === "calendar" && <CalendarPage data={data} />}
      {route.view === "activity" && <ActivityPage data={data} />}
      {route.view === "reports" && (
        <ReportsPage data={data} balances={balances} />
      )}
      {route.view === "members" && (
        <MembersPage
          data={data}
          invitations={invitations}
          canManage={canManage}
          createInvitation={actions.createInvitation}
          revokeInvitation={actions.revokeInvitation}
          toggleMemberStatus={actions.toggleMemberStatus}
        />
      )}
      {route.view === "settings" && (
        <SettingsPage
          data={data}
          canManage={canManage}
          updateHousehold={actions.updateHousehold}
          createCategory={actions.createCategory}
          removeCategory={actions.removeCategory}
        />
      )}

      <CreateHouseholdModal
        open={createHouseholdOpen}
        pending={mutating}
        onClose={() => setCreateHouseholdOpen(false)}
        onCreate={async (name) => {
          const created = await actions.createHousehold(name);
          setCreateHouseholdOpen(false);
          navigatePath(householdPath(created.id, "dashboard"));
        }}
      />
    </AppShell>
  );
}

function parseRoute(pathname: string): AppRoute {
  const cleanPath = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  const parts = cleanPath.split("/").filter(Boolean);

  if (parts[0] === "login") {
    return { kind: "login", view: "dashboard" };
  }
  if (parts[0] === "invite" && parts[1]) {
    return {
      kind: "invite",
      invitationToken: decodeURIComponent(parts[1]),
      view: "dashboard",
    };
  }
  if (parts[0] === "households") {
    return { kind: "households", view: "dashboard" };
  }
  if (parts[0] === "h" && parts[1]) {
    const view = segmentViews[parts[2] ?? "dashboard"] ?? "dashboard";
    return {
      kind: "household",
      householdId: decodeURIComponent(parts[1]),
      view,
    };
  }
  return { kind: "root", view: "dashboard" };
}

function householdPath(id: string, view: ViewKey) {
  return `/h/${encodeURIComponent(id)}/${routeSegments[view]}`;
}

function normalizeUser(user: UserAccount): UserAccount {
  const name = user.name || user.email;
  return {
    ...user,
    id: String(user.id),
    name,
    initials:
      user.initials ||
      name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
    color: user.color || "#4F7C65",
    provider: "google",
  };
}

function fallbackUser(): UserAccount {
  return {
    id: "",
    name: "Tu cuenta",
    email: "",
    initials: "CC",
    color: "#4F7C65",
    provider: "google",
  };
}

function LoadingHousehold() {
  return (
    <main className="standalone-state">
      <LoaderCircle className="spin" size={32} />
      <h1>Preparando tu hogar…</h1>
      <p>Estamos trayendo la información más reciente.</p>
    </main>
  );
}

function HouseholdPicker({
  households,
  user,
  loading,
  error,
  onRetry,
  onSelect,
  onCreate,
  onLogout,
}: {
  households: Array<{ id: string; name: string; memberCount: number }>;
  user: UserAccount | null;
  loading: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onLogout: () => Promise<void>;
}) {
  return (
    <main className="household-picker-page">
      <header>
        <span className="brand-mark">
          <Home size={20} />
        </span>
        <div>
          <strong>Casa Clara</strong>
          <span>{user?.email}</span>
        </div>
        <button className="text-button" onClick={() => void onLogout()}>
          Cerrar sesión
        </button>
      </header>
      <section>
        <span className="eyebrow">Tus espacios</span>
        <h1>Elegí un hogar</h1>
        <p>Los datos se actualizan directamente desde Casa Clara.</p>
        {error && (
          <div className="api-alert" role="alert">
            <span>{error}</span>
            <button onClick={() => void onRetry()}>
              <RefreshCw size={15} /> Reintentar
            </button>
          </div>
        )}
        <div className="household-picker-grid">
          {households.map((household) => (
            <button
              key={household.id}
              className="household-picker-card"
              onClick={() => onSelect(household.id)}
            >
              <span>{household.name.slice(0, 1).toUpperCase()}</span>
              <strong>{household.name}</strong>
              <small>{household.memberCount} integrantes</small>
            </button>
          ))}
          <button className="household-picker-card create" onClick={onCreate}>
            <span>
              <Plus size={22} />
            </span>
            <strong>Crear un hogar</strong>
            <small>Moneda EUR · Europe/Madrid</small>
          </button>
        </div>
        {!loading && !households.length && !error && (
          <p className="household-picker-empty">
            Todavía no pertenecés a ningún hogar. Creá el primero para empezar.
          </p>
        )}
      </section>
    </main>
  );
}

function InvitationScreen({
  token,
  authenticated,
  onLogin,
}: {
  token: string;
  authenticated: boolean;
  onLogin: () => void;
}) {
  const [invitation, setInvitation] =
    useState<PublicInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    householdApi.invitations
      .getPublic(token)
      .then(setInvitation)
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    setError("");
    try {
      await householdApi.invitations.accept(token);
      window.location.assign("/");
    } catch (reason) {
      setError(errorMessage(reason));
      setAccepting(false);
    }
  };

  return (
    <main className="standalone-state invite-state">
      <span className="auth-home-icon">
        <Home size={25} />
      </span>
      {loading ? (
        <>
          <LoaderCircle className="spin" size={28} />
          <h1>Comprobando invitación…</h1>
        </>
      ) : invitation ? (
        <>
          <span className="eyebrow">Te invitaron a un hogar</span>
          <h1>{invitation.householdName}</h1>
          <p>
            {invitation.invitedByName} quiere compartir la organización de la
            casa con vos.
          </p>
          {invitation.email && (
            <small>Invitación para {invitation.email}</small>
          )}
          {error && <p className="form-error">{error}</p>}
          {authenticated ? (
            <button
              className="button button-primary"
              onClick={() => void accept()}
              disabled={accepting}
            >
              {accepting ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Home size={17} />
              )}
              Aceptar invitación
            </button>
          ) : (
            <button className="google-login-button" onClick={onLogin}>
              <LogIn size={18} /> Continuar con Google
            </button>
          )}
        </>
      ) : (
        <>
          <h1>No pudimos abrir la invitación</h1>
          <p>{error || "El enlace puede haber caducado o ya fue utilizado."}</p>
        </>
      )}
    </main>
  );
}

function CreateHouseholdModal({
  open,
  pending,
  onClose,
  onCreate,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || pending) return;
    setError("");
    try {
      await onCreate(name.trim());
      setName("");
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear un hogar"
      subtitle="Después podrás invitar personas por correo o compartir un enlace."
    >
      <form className="app-form" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Nombre del hogar</span>
          <input
            autoFocus
            placeholder="Ej. Piso de Barcelona"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="home-create-preview">
          <span>{name.trim().slice(0, 1).toUpperCase() || "H"}</span>
          <p>
            <strong>{name.trim() || "Tu nuevo hogar"}</strong>
            <small>Entrarás como propietario</small>
          </p>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={pending}
          >
            {pending && <LoaderCircle className="spin" size={16} />}
            Crear hogar
          </button>
        </div>
      </form>
    </Modal>
  );
}
