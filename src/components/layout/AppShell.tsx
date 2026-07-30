"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
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
} from "lucide-react";
import type { Household, HouseholdMember, ViewKey } from "@/types";
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
  children: ReactNode;
}

export function AppShell({
  activeView,
  onNavigate,
  household,
  members,
  children,
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const current = allNav.find((item) => item.id === activeView) ?? allNav[0];
  const today = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const navigate = (view: ViewKey) => {
    onNavigate(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("dashboard")}>
          <span className="brand-mark">
            <Sparkles size={19} />
          </span>
          <span>
            <strong>Casa Clara</strong>
            <small>{household.name}</small>
          </span>
        </button>

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
            <button className="sync-status">
              <span />
              Demo local
            </button>
            <Avatar member={members.find((member) => member.active)} size="md" />
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
