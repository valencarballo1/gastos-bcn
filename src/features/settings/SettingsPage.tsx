"use client";

import {
  Bell,
  Database,
  Euro,
  Globe2,
  Home,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import type { HouseholdData } from "@/types";

export function SettingsPage({
  data,
  resetDemo,
}: {
  data: HouseholdData;
  resetDemo: () => void;
}) {
  return (
    <div>
      <PageHeader
        eyebrow="Preferencias"
        title="Configuración"
        description="Datos básicos y comportamiento general de este hogar."
      />
      <section className="settings-layout">
        <article className="settings-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">General</span>
              <h2>Datos del hogar</h2>
            </div>
            <Home size={20} />
          </header>
          <div className="settings-list">
            <SettingRow icon={<Home size={18} />} label="Nombre" value={data.household.name} />
            <SettingRow icon={<Euro size={18} />} label="Moneda" value="Euro (EUR)" />
            <SettingRow icon={<Globe2 size={18} />} label="Zona horaria" value={data.household.timezone} />
          </div>
        </article>
        <article className="settings-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Avisos</span>
              <h2>Recordatorios</h2>
            </div>
            <Bell size={20} />
          </header>
          <div className="settings-list">
            <SettingRow icon={<Bell size={18} />} label="Vencimientos" value="3 días antes" />
            <SettingRow icon={<ShieldCheck size={18} />} label="Resumen semanal" value="Domingos" />
          </div>
        </article>
        <article className="settings-card settings-data-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Demo local</span>
              <h2>Datos en este dispositivo</h2>
            </div>
            <Database size={20} />
          </header>
          <p>
            Mientras se implementa el backend, los cambios se guardan solo en este navegador.
          </p>
          <button
            className="button button-danger-soft"
            onClick={() => {
              if (window.confirm("¿Restaurar todos los datos de ejemplo?")) resetDemo();
            }}
          >
            <RotateCcw size={17} /> Restaurar datos de ejemplo
          </button>
        </article>
      </section>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <span className="settings-row-icon">{icon}</span>
      <p>
        <span>{label}</span>
        <strong>{value}</strong>
      </p>
    </div>
  );
}
