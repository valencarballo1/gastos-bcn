"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  Check,
  Equal,
  Sparkles,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { AmountInput } from "@/components/common/AmountInput";
import { errorMessage } from "@/services/api";
import {
  formatAmountInput,
  fromCents,
  parseAmount,
  previewEqualSplit,
  toCents,
} from "@/lib/money";
import { QUICK_MERCHANTS, suggestCategoryId } from "@/lib/merchants";
import type { Expense, HouseholdData, SplitType } from "@/types";
import { formatCurrency } from "@/utils/format";

export type ExpenseDraft = Omit<
  Expense,
  "id" | "householdId" | "createdAt" | "rowVersion"
> & { rowVersion?: string };

interface ExpenseFormProps {
  data: HouseholdData;
  expense?: Expense | null;
  onSubmit: (expense: ExpenseDraft) => Promise<unknown>;
  onCancel: () => void;
  submitLabel?: string;
}

const todayInput = () => new Date().toISOString().slice(0, 10);

function dateInput(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Formulario de gasto, compartido por el alta rápida y la edición.
 *
 * Orden pensado para que se pueda cargar un gasto en pocos segundos:
 * importe → qué fue → quién pagó → cómo se reparte, con el reparto siempre a
 * la vista para no tener que confiar en el cálculo mental.
 */
export function ExpenseForm({
  data,
  expense,
  onSubmit,
  onCancel,
  submitLabel = "Guardar gasto",
}: ExpenseFormProps) {
  const activeMembers = useMemo(
    () => data.members.filter((member) => member.active),
    [data.members],
  );
  const expenseCategories = useMemo(
    () => data.categories.filter((item) => item.type === "expense"),
    [data.categories],
  );

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(
    expense ? formatAmountInput(expense.amount) : "",
  );
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? expenseCategories[0]?.id ?? "",
  );
  const [payerId, setPayerId] = useState(
    expense?.paidByMemberId ?? activeMembers[0]?.id ?? "",
  );
  const [date, setDate] = useState(
    expense ? expense.date.slice(0, 10) : todayInput(),
  );
  const [splitType, setSplitType] = useState<SplitType>(
    expense?.splitType ?? "equal",
  );
  const [participantIds, setParticipantIds] = useState<string[]>(
    expense
      ? expense.participants.map((participant) => participant.memberId)
      : activeMembers.map((member) => member.id),
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    () =>
      expense && expense.splitType === "fixed"
        ? Object.fromEntries(
            expense.participants.map((participant) => [
              participant.memberId,
              formatAmountInput(participant.amount),
            ]),
          )
        : {},
  );
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [showDetails, setShowDetails] = useState(Boolean(expense));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const categoryTouched = useRef(Boolean(expense));

  const numericAmount = parseAmount(amount) ?? 0;
  const amountCents = toCents(amount);

  // Sugerimos la categoría a partir del comercio mientras se escribe, pero solo
  // hasta que la persona elija una: a partir de ahí manda su decisión.
  useEffect(() => {
    if (categoryTouched.current) return;
    const suggested = suggestCategoryId(description, data.categories);
    if (suggested) setCategoryId(suggested);
  }, [data.categories, description]);

  const effectiveParticipants =
    splitType === "responsible" ? [payerId] : participantIds;

  const preview = useMemo(() => {
    if (splitType === "responsible") {
      return [{ memberId: payerId, amount: fromCents(amountCents) }];
    }
    if (splitType === "equal") {
      return previewEqualSplit(amountCents / 100, participantIds);
    }
    return participantIds.map((memberId) => ({
      memberId,
      amount: parseAmount(customAmounts[memberId]) ?? 0,
    }));
  }, [amountCents, customAmounts, participantIds, payerId, splitType]);

  const assignedCents = preview.reduce(
    (sum, item) => sum + toCents(item.amount),
    0,
  );
  const pendingCents = amountCents - assignedCents;

  const splitEvenly = () => {
    const even = previewEqualSplit(amountCents / 100, participantIds);
    setCustomAmounts(
      Object.fromEntries(
        even.map((item) => [item.memberId, formatAmountInput(item.amount)]),
      ),
    );
  };

  const assignRest = (memberId: string) => {
    const others = participantIds
      .filter((id) => id !== memberId)
      .reduce((sum, id) => sum + toCents(customAmounts[id]), 0);
    setCustomAmounts((current) => ({
      ...current,
      [memberId]: formatAmountInput(fromCents(Math.max(0, amountCents - others))),
    }));
  };

  const toggleParticipant = (memberId: string) => {
    setParticipantIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!description.trim()) {
      setError("Poné una descripción para reconocer el gasto más tarde.");
      return;
    }
    if (amountCents <= 0) {
      setError("El importe tiene que ser mayor que 0. Podés usar decimales: 12,50.");
      return;
    }
    if (!effectiveParticipants.length) {
      setError("Elegí al menos una persona que participe del gasto.");
      return;
    }
    if (splitType === "fixed" && pendingCents !== 0) {
      setError(
        pendingCents > 0
          ? `Falta repartir ${formatCurrency(fromCents(pendingCents))}.`
          : `Te pasaste por ${formatCurrency(fromCents(-pendingCents))}.`,
      );
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        description: description.trim(),
        amount: fromCents(amountCents),
        categoryId,
        paidByMemberId: payerId,
        date: new Date(`${date}T12:00:00`).toISOString(),
        currency: "EUR",
        splitType,
        participants: preview,
        status: "paid",
        notes: notes.trim() || undefined,
        rowVersion: expense?.rowVersion,
      });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  };

  const memberName = (memberId: string) =>
    data.members.find((member) => member.id === memberId)?.name ?? "—";

  return (
    <form className="app-form expense-form" onSubmit={(event) => void submit(event)}>
      <div className="amount-focus">
        <span>Importe</span>
        <div className="amount-focus-input">
          <span>€</span>
          <AmountInput
            autoFocus={!expense}
            aria-label="Importe del gasto"
            value={amount}
            onValueChange={setAmount}
            selectOnFocus
          />
        </div>
        <small>Escribí los decimales con coma o con punto: 12,50 o 12.50</small>
      </div>

      <label className="field">
        <span>¿Qué fue?</span>
        <input
          autoFocus={Boolean(expense)}
          placeholder="Ej. Compra en Mercadona"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="chip-row" role="group" aria-label="Sugerencias de gasto">
        {QUICK_MERCHANTS.map((merchant) => (
          <button
            type="button"
            key={merchant}
            className={`chip ${description === merchant ? "active" : ""}`}
            onClick={() => setDescription(merchant)}
          >
            {merchant}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Categoría</span>
          <select
            value={categoryId}
            onChange={(event) => {
              categoryTouched.current = true;
              setCategoryId(event.target.value);
            }}
          >
            {expenseCategories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
      </div>

      <div className="chip-row" role="group" aria-label="Fecha rápida">
        {[
          ["Hoy", dateInput(0)],
          ["Ayer", dateInput(-1)],
          ["Anteayer", dateInput(-2)],
        ].map(([label, value]) => (
          <button
            type="button"
            key={label}
            className={`chip ${date === value ? "active" : ""}`}
            onClick={() => setDate(value)}
          >
            <CalendarDays size={13} /> {label}
          </button>
        ))}
      </div>

      <fieldset className="form-section">
        <legend>
          <User size={16} /> ¿Quién pagó?
        </legend>
        <div className="payer-row">
          {activeMembers.map((member) => (
            <button
              type="button"
              key={member.id}
              className={`payer-option ${payerId === member.id ? "active" : ""}`}
              onClick={() => setPayerId(member.id)}
            >
              <Avatar member={member} size="sm" />
              <span>{member.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>
          <Users size={16} /> ¿Cómo se reparte?
        </legend>
        <div className="segmented-control split-mode">
          {(
            [
              ["equal", "Partes iguales"],
              ["fixed", "Importes"],
              ["responsible", "Solo quien pagó"],
            ] as Array<[SplitType, string]>
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={splitType === value ? "active" : ""}
              onClick={() => {
                setSplitType(value);
                if (value === "fixed" && !Object.keys(customAmounts).length) {
                  splitEvenly();
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {splitType !== "responsible" && (
          <>
            <div className="participant-toolbar">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setParticipantIds(
                    participantIds.length === activeMembers.length
                      ? []
                      : activeMembers.map((member) => member.id),
                  )
                }
              >
                {participantIds.length === activeMembers.length
                  ? "Quitar a todos"
                  : "Seleccionar a todos"}
              </button>
              {splitType === "fixed" && (
                <button type="button" className="text-button" onClick={splitEvenly}>
                  <Equal size={13} /> Repartir en partes iguales
                </button>
              )}
            </div>

            <div className="participant-grid">
              {activeMembers.map((member) => {
                const selected = participantIds.includes(member.id);
                const share = preview.find(
                  (item) => item.memberId === member.id,
                );
                return (
                  <div
                    className={`participant-option ${selected ? "selected" : ""}`}
                    key={member.id}
                  >
                    <button
                      type="button"
                      onClick={() => toggleParticipant(member.id)}
                    >
                      <Avatar member={member} size="sm" />
                      <span>{member.name}</span>
                      {selected && splitType === "equal" && amountCents > 0 && (
                        <em>{formatCurrency(share?.amount ?? 0)}</em>
                      )}
                      {selected && <Check size={14} />}
                    </button>
                    {selected && splitType === "fixed" && (
                      <div className="participant-amount">
                        <span>€</span>
                        <AmountInput
                          aria-label={`Importe de ${member.name}`}
                          value={customAmounts[member.id] ?? ""}
                          onValueChange={(value) =>
                            setCustomAmounts((current) => ({
                              ...current,
                              [member.id]: value,
                            }))
                          }
                        />
                        {pendingCents !== 0 && (
                          <button
                            type="button"
                            className="link-mini"
                            onClick={() => assignRest(member.id)}
                          >
                            resto
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div
          className={`split-summary ${
            splitType === "fixed" && pendingCents !== 0 ? "warn" : ""
          }`}
        >
          <Sparkles size={16} />
          <p>
            {splitType === "responsible" ? (
              <>
                <strong>{formatCurrency(numericAmount)}</strong> quedan a cargo de{" "}
                {memberName(payerId)}.
              </>
            ) : amountCents === 0 ? (
              <>Escribí el importe y verás cuánto le toca a cada uno.</>
            ) : pendingCents === 0 ? (
              <>
                {preview
                  .map(
                    (item) =>
                      `${memberName(item.memberId)} ${formatCurrency(item.amount)}`,
                  )
                  .join(" · ")}
              </>
            ) : pendingCents > 0 ? (
              <>
                Falta repartir <strong>{formatCurrency(fromCents(pendingCents))}</strong>
              </>
            ) : (
              <>
                Te pasaste por{" "}
                <strong>{formatCurrency(fromCents(-pendingCents))}</strong>
              </>
            )}
          </p>
        </div>
      </fieldset>

      {showDetails ? (
        <label className="field">
          <span>Notas (opcional)</span>
          <textarea
            rows={2}
            placeholder="Ej. incluye la compra del cumpleaños"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      ) : (
        <button
          type="button"
          className="text-button"
          onClick={() => setShowDetails(true)}
        >
          <SlidersHorizontal size={14} /> Agregar una nota
        </button>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button button-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="button button-primary" disabled={submitting}>
          {submitting ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
