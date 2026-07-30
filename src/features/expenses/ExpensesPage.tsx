"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronDown,
  Filter,
  Plus,
  ReceiptText,
  Search,
  Users,
  WalletCards,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import type {
  Expense,
  HouseholdData,
  SplitType,
} from "@/types";
import { formatCurrency, formatLongDate } from "@/utils/format";

interface ExpensesPageProps {
  data: HouseholdData;
  addExpense: (expense: Omit<Expense, "id" | "householdId" | "createdAt">) => void;
}

export function ExpensesPage({ data, addExpense }: ExpensesPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [member, setMember] = useState("all");

  const expenses = useMemo(
    () =>
      data.expenses.filter((expense) => {
        const matchesQuery = expense.description.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = category === "all" || expense.categoryId === category;
        const matchesMember = member === "all" || expense.paidByMemberId === member;
        return matchesQuery && matchesCategory && matchesMember;
      }),
    [category, data.expenses, member, query],
  );
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Dinero compartido"
        title="Gastos del hogar"
        description="Registrá quién pagó, cómo se divide y mantené las cuentas claras."
        action={
          <button className="button button-primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} /> Agregar gasto
          </button>
        }
      />

      <section className="summary-strip">
        <div>
          <span>Mostrando</span>
          <strong>{expenses.length} gastos</strong>
        </div>
        <div>
          <span>Importe total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div>
          <span>Promedio</span>
          <strong>{formatCurrency(expenses.length ? total / expenses.length : 0)}</strong>
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
          <Filter size={17} />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
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
          <select value={member} onChange={(event) => setMember(event.target.value)}>
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

      <section className="data-card expense-table-card">
        <div className="data-table expense-table">
          <div className="data-table-head">
            <span>Gasto</span>
            <span>Pagó</span>
            <span>División</span>
            <span>Fecha</span>
            <span>Importe</span>
          </div>
          {expenses.map((expense) => {
            const payer = data.members.find(
              (item) => item.id === expense.paidByMemberId,
            );
            const expenseCategory = data.categories.find(
              (item) => item.id === expense.categoryId,
            );
            return (
              <article className="data-table-row" key={expense.id}>
                <div className="expense-name-cell">
                  <span
                    className="category-icon"
                    style={{ backgroundColor: `${expenseCategory?.color}1F`, color: expenseCategory?.color }}
                  >
                    <ReceiptText size={18} />
                  </span>
                  <div>
                    <strong>{expense.description}</strong>
                    <span>{expenseCategory?.name}</span>
                  </div>
                </div>
                <div className="member-cell">
                  <Avatar member={payer} size="sm" />
                  <span>{payer?.name}</span>
                </div>
                <div className="split-cell">
                  <span className="avatar-mini-stack">
                    {expense.participants.map((participant) => (
                      <Avatar
                        key={participant.memberId}
                        member={data.members.find((item) => item.id === participant.memberId)}
                        size="sm"
                      />
                    ))}
                  </span>
                  <span>{splitLabel(expense.splitType)}</span>
                </div>
                <div className="date-cell">
                  <CalendarDays size={15} />
                  <span>{formatLongDate(expense.date)}</span>
                </div>
                <strong className="amount-cell">{formatCurrency(expense.amount)}</strong>
              </article>
            );
          })}
          {!expenses.length && (
            <div className="empty-state">
              <ReceiptText size={30} />
              <h3>No encontramos gastos</h3>
              <p>Probá cambiando los filtros o agregá un movimiento nuevo.</p>
            </div>
          )}
        </div>
      </section>

      <ExpenseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
        onSubmit={(expense) => {
          addExpense(expense);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function ExpenseFormModal({
  open,
  onClose,
  data,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  data: HouseholdData;
  onSubmit: (expense: Omit<Expense, "id" | "householdId" | "createdAt">) => void;
}) {
  const activeMembers = data.members.filter((member) => member.active);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("cat-market");
  const [payerId, setPayerId] = useState(activeMembers[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [participantIds, setParticipantIds] = useState(activeMembers.map((item) => item.id));
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!description.trim() || numericAmount <= 0 || !participantIds.length) {
      setError("Completá la descripción, el importe y al menos un participante.");
      return;
    }

    let participants: Expense["participants"] = [];
    if (splitType === "responsible") {
      participants = [{ memberId: payerId, amount: numericAmount }];
    } else if (splitType === "equal") {
      const cents = Math.round(numericAmount * 100);
      const base = Math.floor(cents / participantIds.length);
      let used = 0;
      participants = participantIds.map((memberId, index) => {
        const share = index === participantIds.length - 1 ? cents - used : base;
        used += share;
        return { memberId, amount: share / 100 };
      });
    } else {
      participants = participantIds.map((memberId) => ({
        memberId,
        amount: Number(customAmounts[memberId] ?? 0),
      }));
      const assigned = participants.reduce((sum, item) => sum + item.amount, 0);
      if (Math.abs(assigned - numericAmount) > 0.009) {
        setError(`El reparto suma ${formatCurrency(assigned)} y debe sumar ${formatCurrency(numericAmount)}.`);
        return;
      }
    }

    onSubmit({
      description: description.trim(),
      amount: numericAmount,
      categoryId,
      paidByMemberId: payerId,
      date: new Date(`${date}T12:00:00`).toISOString(),
      currency: "EUR",
      splitType,
      participants,
      status: "paid",
    });
    setDescription("");
    setAmount("");
    setError("");
  };

  const toggleParticipant = (memberId: string) => {
    setParticipantIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo gasto"
      subtitle="Guardaremos el reparto exacto para calcular el balance."
      width="lg"
    >
      <form className="app-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field field-wide">
            <span>Descripción</span>
            <input
              autoFocus
              placeholder="Ej. Compra semanal"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Importe</span>
            <div className="input-prefix">
              <span>€</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
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
            <span>¿Quién pagó?</span>
            <select value={payerId} onChange={(event) => setPayerId(event.target.value)}>
              {activeMembers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>

        <fieldset className="form-section">
          <legend>
            <WalletCards size={17} /> ¿Cómo se divide?
          </legend>
          <div className="segmented-control">
            {[
              ["equal", "Partes iguales"],
              ["fixed", "Importes"],
              ["responsible", "Solo quien pagó"],
            ].map(([value, label]) => (
              <button
                type="button"
                className={splitType === value ? "active" : ""}
                onClick={() => setSplitType(value as SplitType)}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {splitType !== "responsible" && (
          <fieldset className="form-section">
            <legend>
              <Users size={17} /> Participan
            </legend>
            <div className="participant-grid">
              {activeMembers.map((member) => {
                const selected = participantIds.includes(member.id);
                return (
                  <div className={`participant-option ${selected ? "selected" : ""}`} key={member.id}>
                    <button type="button" onClick={() => toggleParticipant(member.id)}>
                      <Avatar member={member} size="sm" />
                      <span>{member.name}</span>
                    </button>
                    {selected && splitType === "fixed" && (
                      <div className="participant-amount">
                        <input
                          aria-label={`Importe de ${member.name}`}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={customAmounts[member.id] ?? ""}
                          onChange={(event) =>
                            setCustomAmounts((current) => ({
                              ...current,
                              [member.id]: event.target.value,
                            }))
                          }
                        />
                        <span>€</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary">
            Guardar gasto
          </button>
        </div>
      </form>
    </Modal>
  );
}

function splitLabel(splitType: SplitType) {
  if (splitType === "equal") return "Partes iguales";
  if (splitType === "fixed") return "Importes";
  return "Personal";
}
