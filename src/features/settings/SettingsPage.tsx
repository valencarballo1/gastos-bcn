"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Bell,
  Euro,
  FolderPlus,
  Globe2,
  Home,
  Save,
  ShieldCheck,
  Tags,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { errorMessage } from "@/services/api";
import type { Category, Household, HouseholdData } from "@/types";

export function SettingsPage({
  data,
  canManage,
  updateHousehold,
  createCategory,
  removeCategory,
}: {
  data: HouseholdData;
  canManage: boolean;
  updateHousehold: (
    payload: Pick<Household, "name" | "currency" | "timezone"> & {
      rowVersion?: string;
    },
  ) => Promise<unknown>;
  createCategory: (
    payload: Omit<Category, "id" | "rowVersion">,
  ) => Promise<unknown>;
  removeCategory: (categoryId: string) => Promise<unknown>;
}) {
  const [name, setName] = useState(data.household.name);
  const [timezone, setTimezone] = useState(data.household.timezone);
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] =
    useState<Category["type"]>("expense");
  const [categoryColor, setCategoryColor] = useState("#4F7C65");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setName(data.household.name);
    setTimezone(data.household.timezone);
  }, [data.household.name, data.household.timezone]);

  const saveHousehold = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !timezone.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateHousehold({
        name: name.trim(),
        currency: "EUR",
        timezone: timezone.trim(),
        rowVersion: data.household.rowVersion,
      });
      setMessage("Datos del hogar actualizados.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await createCategory({
        name: categoryName.trim(),
        type: categoryType,
        color: categoryColor,
      });
      setCategoryName("");
      setMessage("Categoría creada.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Preferencias"
        title="Configuración"
        description="Datos básicos, categorías y comportamiento general de este hogar."
      />

      {!canManage && (
        <section className="member-access-note">
          <span>
            <ShieldCheck size={20} />
          </span>
          <div>
            <strong>Configuración de solo lectura</strong>
            <p>Solo propietarios y administradores pueden hacer cambios.</p>
          </div>
        </section>
      )}

      {(message || error) && (
        <p
          className={error ? "form-error settings-feedback" : "form-success"}
          role="status"
        >
          {error || message}
        </p>
      )}

      <section className="settings-layout">
        <article className="settings-card settings-edit-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">General</span>
              <h2>Datos del hogar</h2>
            </div>
            <Home size={20} />
          </header>
          <form
            className="app-form"
            onSubmit={(event) => void saveHousehold(event)}
          >
            <label className="field">
              <span>Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canManage}
              />
            </label>
            <label className="field">
              <span>Moneda</span>
              <div className="input-prefix">
                <Euro size={16} />
                <input value="EUR" disabled />
              </div>
            </label>
            <label className="field">
              <span>Zona horaria IANA</span>
              <div className="input-prefix">
                <Globe2 size={16} />
                <input
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="Europe/Madrid"
                  disabled={!canManage}
                />
              </div>
            </label>
            {canManage && (
              <button
                className="button button-primary"
                disabled={saving}
                type="submit"
              >
                <Save size={16} /> Guardar cambios
              </button>
            )}
          </form>
        </article>

        <article className="settings-card settings-category-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Organización</span>
              <h2>Categorías</h2>
            </div>
            <Tags size={20} />
          </header>
          <div className="settings-category-list">
            {data.categories.map((category) => (
              <div key={category.id}>
                <i style={{ backgroundColor: category.color }} />
                <span>
                  <strong>{category.name}</strong>
                  <small>{categoryLabel(category.type)}</small>
                </span>
                {canManage && (
                  <button
                    className="icon-button danger-button"
                    aria-label={`Desactivar ${category.name}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Desactivar la categoría ${category.name}?`,
                        )
                      ) {
                        void removeCategory(category.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {canManage && (
            <form
              className="app-form category-create-form"
              onSubmit={(event) => void addCategory(event)}
            >
              <label className="field">
                <span>Nueva categoría</span>
                <input
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="Ej. Mascotas"
                />
              </label>
              <label className="field">
                <span>Tipo</span>
                <select
                  value={categoryType}
                  onChange={(event) =>
                    setCategoryType(event.target.value as Category["type"])
                  }
                >
                  <option value="expense">Gasto</option>
                  <option value="task">Tarea</option>
                  <option value="shopping">Compra</option>
                </select>
              </label>
              <label className="field color-field">
                <span>Color</span>
                <input
                  type="color"
                  value={categoryColor}
                  onChange={(event) => setCategoryColor(event.target.value)}
                />
              </label>
              <button
                className="button button-secondary"
                type="submit"
                disabled={saving || !categoryName.trim()}
              >
                <FolderPlus size={16} /> Agregar
              </button>
            </form>
          )}
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
            <SettingRow
              icon={<Bell size={18} />}
              label="Vencimientos"
              value="Según cada recurrencia"
            />
            <SettingRow
              icon={<ShieldCheck size={18} />}
              label="Persistencia"
              value="Datos protegidos en el servidor"
            />
          </div>
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

function categoryLabel(type: Category["type"]) {
  if (type === "task") return "Tarea";
  if (type === "shopping") return "Compra";
  return "Gasto";
}
