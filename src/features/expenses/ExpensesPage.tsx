"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Filter,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import {
  ExpenseForm,
  type ExpenseDraft,
} from "@/features/expenses/ExpenseForm";
import type { Expense, HouseholdData, SplitType } from "@/types";
import { formatCurrency, formatDate } from "@/utils/format";

interface ExpensesPageProps {
  data: HouseholdData;
  addExpense: (expense: ExpenseDraft) => Promise<unknown>;
  updateExpense?: (id: string, expense: ExpenseDraft) => Promise<unknown>;
  removeExpense?: (id: string) => Promise<unknown>;
}

type Period = "current" | "previous" | "all";

export function ExpensesPage({
  data,
  addExpense,
  updateExpense,
  removeExpense,
}: ExpensesPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [member, setMember] = useState("all");
  const [period, setPeriod] = useState<Period>("current");

  const expenses = useMemo(() => {
    const range = periodRange(period);
    return data.expenses
      // Un gasto cancelado deja de contar en los balances del backend, así que
      // tampoco debe sumar aquí ni ensuciar la lista.
      .filter((expense) => expense.status !== "cancelled")
      .filter((expense) => {
        const text = `${expense.description} ${expense.notes ?? ""}`.toLowerCase();
        const matchesQuery = text.includes(query.trim().toLowerCase());
        const matchesCategory =
          category === "all" || expense.categoryId === category;
        const matchesMember =
          member === "all" || expense.paidByMemberId === member;
        const time = new Date(expense.date).getTime();
        const matchesPeriod =
          !range || (time >= range.from.getTime() && time <= range.to.getTime());
        return matchesQuery && matchesCategory && matchesMember && matchesPeriod;
      })
      .sort(
        (left, right) =>
          new Date(right.date).getTime() - new Date(left.date).getTime(),
      );
  }, [category, data.expenses, member, period, query]);

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const groups = useMemo(() => groupByDay(expenses), [expenses]);

  const closeForm = () => {
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <div className="expenses-view">
      <PageHeader
        eyebrow="Dinero compartido"
        title="Gastos del hogar"
        description="Cargá un gasto en segundos: importe, qué fue y quién pagó. El reparto se calcula solo."
        action={
          <button className="button button-primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} /> Agregar gasto
          </button>
        }
      />

      <section className="summary-strip">
        <div>
          <span>{periodLabel(period)}</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div>
          <span>Movimientos</span>
          <strong>{expenses.length}</strong>
        </div>
        <div>
          <span>Promedio</span>
          <strong>
            {formatCurrency(expenses.length ? total / expenses.length : 0)}
          </strong>
        </div>
      </section>

      <section className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Buscar gastos"
            placeholder="Buscar por descripción..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="select-field">
          <CalendarDays size={17} />
          <select
            aria-label="Periodo"
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
          >
            <option value="current">Este mes</option>
            <option value="previous">Mes pasado</option>
            <option value="all">Todo el historial</option>
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="select-field">
          <Filter size={17} />
          <select
            aria-label="Categoría"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">Todas las categorías</option>
            {data.categories
              .filter((item) => item.type === "expense")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
          <ChevronDown size={15} />
        </label>
        <label className="select-field">
          <Users size={17} />
          <select
            aria-label="Pagado por"
            value={member}
            onChange={(event) => setMember(event.target.value)}
          >
            <option value="all">Todos los integrantes</option>
            {data.members.map((item) => (
              <option key={item.id} value={item.id}>
                Pagó {item.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
      </section>

      <section className="expense-groups">
        {groups.map((group) => (
          <article className="expense-group" key={group.key}>
            <header>
              <strong>{group.label}</strong>
              <span>{formatCurrency(group.total)}</span>
            </header>
            <div className="expense-list">
              {group.items.map((expense) => {
                const payer = data.members.find(
                  (item) => item.id === expense.paidByMemberId,
                );
                const expenseCategory = data.categories.find(
                  (item) => item.id === expense.categoryId,
                );
                return (
                  <div className="expense-row" key={expense.id}>
                    <span
                      className="category-icon"
                      style={{
                        backgroundColor: `${expenseCategory?.color ?? "#526a5a"}1F`,
                        color: expenseCategory?.color ?? "#526a5a",
                      }}
                    >
                      <ReceiptText size={18} />
                    </span>
                    <div className="expense-row-main">
                      <strong>{expense.description}</strong>
                      <span>
                        {expenseCategory?.name ?? "Sin categoría"} ·{" "}
                        {splitLabel(expense.splitType)}
                      </span>
                    </div>
                    <div className="expense-row-people">
                      <Avatar member={payer} size="sm" />
                      <span>Pagó {payer?.name ?? "—"}</span>
                    </div>
                    <strong className="expense-row-amount">
                      {formatCurrency(expense.amount)}
                    </strong>
                    <div className="expense-row-actions">
                      {updateExpense && (
                        <button
                          className="icon-button"
                          aria-label={`Editar ${expense.description}`}
                          onClick={() => setEditing(expense)}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {removeExpense && (
                        <button
                          className="icon-button danger-button"
                          aria-label={`Eliminar ${expense.description}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Eliminar "${expense.description}" de ${formatCurrency(expense.amount)}?`,
                              )
                            ) {
                              void removeExpense(expense.id);
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}

        {!expenses.length && (
          <div className="empty-state">
            <ReceiptText size={30} />
            <h3>Todavía no hay gastos acá</h3>
            <p>
              Probá cambiando los filtros o cargá el primer movimiento del mes.
            </p>
            <button className="button button-primary" onClick={() => setModalOpen(true)}>
              <Plus size={17} /> Agregar gasto
            </button>
          </div>
        )}
      </section>

      <button
        className="fab"
        onClick={() => setModalOpen(true)}
        aria-label="Agregar gasto"
      >
        <Plus size={24} />
      </button>

      <Modal
        open={modalOpen || Boolean(editing)}
        onClose={closeForm}
        title={editing ? "Editar gasto" : "Nuevo gasto"}
        subtitle={
          editing
            ? "Se recalcula el reparto y el balance del hogar."
            : "Importe primero: el resto ya viene con valores por defecto."
        }
        width="lg"
      >
        <ExpenseForm
          key={editing?.id ?? "new"}
          data={data}
          expense={editing}
          submitLabel={editing ? "Guardar cambios" : "Guardar gasto"}
          onCancel={closeForm}
          onSubmit={async (expense) => {
            if (editing && updateExpense) {
              await updateExpense(editing.id, expense);
            } else {
              await addExpense(expense);
            }
            closeForm();
          }}
        />
      </Modal>
    </div>
  );
}

function periodRange(period: Period) {
  if (period === "all") return null;
  const now = new Date();
  const offset = period === "previous" ? -1 : 0;
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(
    now.getFullYear(),
    now.getMonth() + offset + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { from, to };
}

function periodLabel(period: Period) {
  if (period === "current") return "Total de este mes";
  if (period === "previous") return "Total del mes pasado";
  return "Total del historial";
}

function groupByDay(expenses: Expense[]) {
  const groups = new Map<
    string,
    { key: string; label: string; total: number; items: Expense[] }
  >();

  for (const expense of expenses) {
    const key = expense.date.slice(0, 10);
    const group = groups.get(key) ?? {
      key,
      label: dayLabel(expense.date),
      total: 0,
      items: [],
    };
    group.total += expense.amount;
    group.items.push(expense);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (left: Date, right: Date) =>
    left.toDateString() === right.toDateString();

  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  const label = formatDate(value, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function splitLabel(splitType: SplitType) {
  if (splitType === "equal") return "Partes iguales";
  if (splitType === "fixed") return "Importes personalizados";
  return "Solo quien pagó";
}
