"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  BarChart3,
  BadgeCheck,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  ChevronsUpDown,
  CircleDollarSign,
  Clock3,
  Home,
  Menu,
  MoreHorizontal,
  ReceiptText,
  Repeat2,
  Settings,
  ShoppingBasket,
  Sparkles,
  Users,
  X,
  Plus,
} from "lucide-react";
import type {
  Household,
  HouseholdMember,
  HouseholdSummary,
  UserAccount,
  ViewKey,
} from "@/types";
import { Avatar } from "@/components/common/Avatar";

interface NavItem {
  id: ViewKey;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

const primaryNav: NavItem[] = [
  { id: "dashboard", label: "Inicio", icon: Home },
  { id: "expenses", label: "Gastos", icon: ReceiptText },
  { id: "recurring", label: "Gastos fijos", icon: Repeat2 },
  { id: "balances", label: "Balances", icon: CircleDollarSign },
  { id: "shopping", label: "Supermercado", icon: ShoppingBasket },
  { id: "tasks", label: "Tareas", icon: CheckSquare2 },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
];

const secondaryNav: NavItem[] = [
  { id: "activity", label: "Historial", icon: Clock3 },
  { id: "reports", label: "Estadísticas", icon: BarChart3 },
  { id: "members", label: "Integrantes", icon: Users },
  { id: "settings", label: "Configuración", icon: Settings },
];

const allNav = [...primaryNav, ...secondaryNav];

interface AppShellProps {
  activeView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  household: Household;
  members: HouseholdMember[];
  households: HouseholdSummary[];
  currentUser: UserAccount;
  onSwitchHousehold: (householdId: string) => void;
  onCreateHousehold: () => void;
  onLogout: () => void;
  syncing?: boolean;
  children: ReactNode;
}

export function AppShell({
  activeView,
  onNavigate,
  household,
  members,
  households,
  currentUser,
  onSwitchHousehold,
  onCreateHousehold,
  onLogout,
  syncing = false,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [householdMenuOpen, setHouseholdMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const current = allNav.find((item) => item.id === activeView) ?? allNav[0];
  const today = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: household.timezone,
  }).format(new Date());

  const navigate = (view: ViewKey) => {
    onNavigate(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => setHouseholdMenuOpen((open) => !open)}
          aria-expanded={householdMenuOpen}
        >
          <span className="brand-mark">
            <Sparkles size={19} />
          </span>
          <span>
            <strong>Casa Clara</strong>
            <small>{household.name}</small>
          </span>
          <ChevronsUpDown className="brand-switch-icon" size={15} />
        </button>
        {householdMenuOpen && (
          <div className="household-switcher">
            <span className="nav-label">Mis hogares</span>
            {households.map((item) => (
              <button
                key={item.id}
                className={item.id === household.id ? "active" : ""}
                onClick={() => {
                  onSwitchHousehold(item.id);
                  setHouseholdMenuOpen(false);
                  navigate("dashboard");
                }}
              >
                <span className="household-option-mark">
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.memberCount} integrantes</small>
                </span>
                {item.id === household.id && <BadgeCheck size={16} />}
              </button>
            ))}
            <button
              className="create-household-button"
              onClick={() => {
                setHouseholdMenuOpen(false);
                onCreateHousehold();
              }}
            >
              <Plus size={16} />
              Crear otro hogar
            </button>
          </div>
        )}

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <span className="nav-label">Tu hogar</span>
          {primaryNav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeView === item.id}
              onClick={() => navigate(item.id)}
            />
          ))}
          <span className="nav-label nav-label-spaced">Organización</span>
          {secondaryNav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeView === item.id}
              onClick={() => navigate(item.id)}
            />
          ))}
        </nav>

        <div className="sidebar-home-card">
          <div className="member-stack">
            {members
              .filter((member) => member.active)
              .slice(0, 4)
              .map((member) => (
                <Avatar key={member.id} member={member} size="sm" />
              ))}
          </div>
          <strong>{members.filter((member) => member.active).length} en casa</strong>
          <span>Todo al día, entre todos.</span>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <button
            className="mobile-brand"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={22} />
            <span>Casa Clara</span>
          </button>
          <div className="topbar-context">
            <span className="topbar-view">{current.label}</span>
            <span className="topbar-date">{today}</span>
          </div>
          <div className="topbar-actions">
            <span className={`sync-status ${syncing ? "is-syncing" : ""}`}>
              <span />
              {syncing ? "Actualizando…" : "Sincronizado"}
            </span>
            <button
              className="account-button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-label="Abrir cuenta"
              aria-expanded={accountMenuOpen}
            >
              <span
                className="avatar avatar-md"
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.initials}
              </span>
            </button>
            {accountMenuOpen && (
              <div className="account-popover">
                <div>
                  <span
                    className="avatar avatar-lg"
                    style={{ backgroundColor: currentUser.color }}
                  >
                    {currentUser.initials}
                  </span>
                  <p>
                    <strong>{currentUser.name}</strong>
                    <span>{currentUser.email}</span>
                  </p>
                </div>
                <span className="google-connected">
                  <BadgeCheck size={15} />
                  Cuenta de Google conectada
                </span>
                <button onClick={() => navigate("settings")}>Gestionar cuenta</button>
                <button onClick={onLogout}>Cerrar sesión</button>
              </div>
            )}
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Navegación móvil">
        {[
          primaryNav[0],
          primaryNav[1],
          primaryNav[4],
          primaryNav[5],
        ].map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={activeView === item.id}
            onClick={() => navigate(item.id)}
          />
        ))}
        <button
          className={mobileMenuOpen ? "active" : ""}
          onClick={() => setMobileMenuOpen(true)}
        >
          <MoreHorizontal size={20} />
          <span>Más</span>
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <section className="mobile-menu" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">Navegación</span>
                <h2>{household.name}</h2>
              </div>
              <button className="icon-button" onClick={() => setMobileMenuOpen(false)}>
                <X size={20} />
              </button>
            </header>
            <div className="mobile-menu-grid">
              {allNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={activeView === item.id ? "active" : ""}
                    onClick={() => navigate(item.id)}
                  >
                    <Icon size={22} />
                    <span>{item.label}</span>
                    <ChevronDown size={14} />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      <Icon size={19} strokeWidth={active ? 2.4 : 2} />
      <span>{item.label}</span>
    </button>
  );
}
