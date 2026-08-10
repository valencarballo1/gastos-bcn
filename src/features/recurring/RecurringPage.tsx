"use client";

import { useState, type FormEvent } from "react";
import {
  CalendarClock,
  Check,
  MoreVertical,
  Pause,
  Plus,
  Repeat2,
  RotateCcw,
  Variable,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { errorMessage } from "@/services/api";
import type { HouseholdData, RecurringExpense } from "@/types";
import { daysUntil, formatCurrency, formatLongDate } from "@/utils/format";

interface RecurringPageProps {
  data: HouseholdData;
  addRecurringExpense: (
    expense: Omit<RecurringExpense, "id" | "householdId" | "rowVersion">,
  ) => Promise<unknown>;
  toggleRecurringStatus: (id: string) => Promise<unknown>;
}

export function RecurringPage({
  data,
  addRecurringExpense,
  toggleRecurringStatus,
}: RecurringPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const monthlyEstimate = data.recurringExpenses
    .filter((item) => item.status === "active")
    .reduce((sum, item) => sum + (item.estimatedAmount ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Pagos previsibles"
        title="Gastos fijos"
        description="Organizá vencimientos y dejá preparado el reparto de cada factura."
        action={
          <button className="button button-primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} /> Crear gasto fijo
          </button>
        }
      />

      <section className="recurring-summary">
        <div>
          <span className="summary-icon summary-icon-sage">
            <Repeat2 size={20} />
          </span>
          <p>
            <span>Activos</span>
            <strong>
              {data.recurringExpenses.filter((item) => item.status === "active").length}
            </strong>
          </p>
        </div>
        <div>
          <span className="summary-icon summary-icon-coral">
            <CalendarClock size={20} />
          </span>
          <p>
            <span>Estimado mensual</span>
            <strong>{formatCurrency(monthlyEstimate)}</strong>
          </p>
        </div>
        <div>
          <span className="summary-icon summary-icon-blue">
            <Variable size={20} />
          </span>
          <p>
            <span>Importe variable</span>
            <strong>
              {data.recurringExpenses.filter((item) => item.variableAmount).length}
            </strong>
          </p>
        </div>
      </section>

      <section className="recurring-grid">
        {data.recurringExpenses.map((item) => {
          const payer = data.members.find(
            (member) => member.id === item.paidByMemberId,
          );
          const category = data.categories.find(
            (categoryItem) => categoryItem.id === item.categoryId,
          );
          const dueIn = daysUntil(item.nextDueDate);
          return (
            <article className={`recurring-card ${item.status === "paused" ? "is-paused" : ""}`} key={item.id}>
              <header>
                <span
                  className="category-icon category-icon-lg"
                  style={{ backgroundColor: `${category?.color}1F`, color: category?.color }}
                >
                  <Repeat2 size={21} />
                </span>
                <button className="icon-button" aria-label="Más opciones">
                  <MoreVertical size={19} />
                </button>
              </header>
              <span className={`status-pill ${item.status === "active" ? "status-active" : "status-paused"}`}>
                {item.status === "active" ? "Activo" : "Pausado"}
              </span>
              <h2>{item.name}</h2>
              <p className="recurring-amount">
                {item.variableAmount ? (
                  <>
                    <strong>Variable</strong>
                    <span>Estimado {formatCurrency(item.estimatedAmount ?? 0)}</span>
                  </>
                ) : (
                  <>
                    <strong>{formatCurrency(item.estimatedAmount ?? 0)}</strong>
                    <span>al mes</span>
                  </>
                )}
              </p>
              <div className="recurring-meta">
                <span>
                  <CalendarClock size={16} />
                  {formatLongDate(item.nextDueDate, data.household.timezone)}
                </span>
                <span>
                  <Avatar member={payer} size="sm" />
                  Paga {payer?.name}
                </span>
                <span>
                  <span className="avatar-mini-stack">
                    {item.participantIds.map((participantId) => (
                      <Avatar
                        key={participantId}
                        member={data.members.find((member) => member.id === participantId)}
                        size="sm"
                      />
                    ))}
                  </span>
                  {item.splitType === "equal" ? "Partes iguales" : "Reparto definido"}
                </span>
              </div>
              <footer>
                <span>
                  {dueIn >= 0 ? `Vence en ${dueIn} días` : `Vencido hace ${Math.abs(dueIn)} días`}
                </span>
                <button className="text-button" onClick={() => void toggleRecurringStatus(item.id)}>
                  {item.status === "active" ? <Pause size={15} /> : <RotateCcw size={15} />}
                  {item.status === "active" ? "Pausar" : "Reactivar"}
                </button>
              </footer>
            </article>
          );
        })}
      </section>

      <RecurringForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
        onSubmit={async (item) => {
          await addRecurringExpense(item);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function RecurringForm({
  open,
  onClose,
  data,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  data: HouseholdData;
  onSubmit: (item: Omit<RecurringExpense, "id" | "householdId" | "rowVersion">) => Promise<unknown>;
}) {
  const activeMembers = data.members.filter((member) => member.active);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(
    data.categories.find((item) => item.type === "expense")?.id ?? "",
  );
  const [payerId, setPayerId] = useState(activeMembers[0]?.id ?? "");
  const [dueDay, setDueDay] = useState("1");
  const [variable, setVariable] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || (!variable && Number(amount) <= 0)) {
      setError("Completá el nombre y un importe estimado.");
      return;
    }
    const nextDue = new Date();
    nextDue.setMonth(nextDue.getMonth() + 1, Number(dueDay));
    nextDue.setHours(12, 0, 0, 0);
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        name: name.trim(),
        categoryId,
        estimatedAmount: amount ? Number(amount) : null,
        variableAmount: variable,
        frequency: "monthly",
        dueDay: Number(dueDay),
        paidByMemberId: payerId,
        participantIds: activeMembers.map((member) => member.id),
        splitType: "equal",
        status: "active",
        nextDueDate: nextDue.toISOString(),
        reminderDays: 3,
      });
      setName("");
      setAmount("");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo gasto fijo"
      subtitle="La configuración se aplicará solo a próximas ocurrencias."
    >
      <form className="app-form" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Nombre</span>
          <input
            autoFocus
            placeholder="Ej. Seguro del hogar"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Importe estimado</span>
            <div className="input-prefix">
              <span>€</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </label>
          <label className="field">
            <span>Día de vencimiento</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="28"
              value={dueDay}
              onChange={(event) => setDueDay(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Categoría</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {data.categories
                .filter((item) => item.type === "expense")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>¿Quién suele pagar?</span>
            <select value={payerId} onChange={(event) => setPayerId(event.target.value)}>
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="switch-row">
          <span className={`switch ${variable ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={variable}
              onChange={(event) => setVariable(event.target.checked)}
            />
            <i />
          </span>
          <span>
            <strong>El importe puede variar</strong>
            <small>Podrás completar el valor real cuando llegue la factura.</small>
          </span>
          {variable && <Check size={18} />}
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? "Creando…" : "Crear gasto fijo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
