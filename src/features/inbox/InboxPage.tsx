"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Inbox,
  Mail,
  ReceiptText,
  ShoppingBasket,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import {
  ExpenseForm,
  type ExpenseDraft,
} from "@/features/expenses/ExpenseForm";
import { suggestCategoryId } from "@/lib/merchants";
import { parseReceiptEmail, type ParsedReceipt } from "@/lib/receipts";
import { errorMessage } from "@/services/api";
import type { Expense, HouseholdData, MailReceipt } from "@/types";
import { formatCurrency, formatLongDate } from "@/utils/format";

interface InboxPageProps {
  data: HouseholdData;
  addExpense: (expense: ExpenseDraft) => Promise<unknown>;
  confirmMailReceipt: (receiptId: string, expenseId?: string) => Promise<unknown>;
  discardMailReceipt: (receiptId: string) => Promise<unknown>;
  onOpenSettings?: () => void;
}

interface ReviewItem {
  receipt: MailReceipt;
  parsed: ParsedReceipt;
}

/**
 * Bandeja de tickets que llegaron por correo.
 *
 * Todo lo que se ve acá está pendiente: se lee el correo, se propone un gasto
 * y no pasa nada hasta que alguien confirma. Por eso cada ficha muestra de
 * dónde salió el importe y qué productos se detectaron.
 */
export function InboxPage({
  data,
  addExpense,
  confirmMailReceipt,
  discardMailReceipt,
  onOpenSettings,
}: InboxPageProps) {
  const [reviewing, setReviewing] = useState<ReviewItem | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  const items = useMemo<ReviewItem[]>(
    () =>
      data.mailReceipts
        .filter((receipt) => receipt.status === "pending")
        .map((receipt) => ({
          receipt,
          parsed: parseReceiptEmail({
            from: receipt.from,
            subject: receipt.subject,
            body: receipt.body,
            receivedAt: receipt.receivedAt,
          }),
        }))
        .sort(
          (left, right) =>
            new Date(right.receipt.receivedAt).getTime() -
            new Date(left.receipt.receivedAt).getTime(),
        ),
    [data.mailReceipts],
  );

  const total = items.reduce((sum, item) => sum + (item.parsed.total ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Tickets por correo"
        title="Bandeja de entrada"
        description="Lo que llega de los comercios espera acá. Revisás, confirmás y recién ahí se convierte en gasto."
        action={
          onOpenSettings && (
            <button className="button button-secondary" onClick={onOpenSettings}>
              <Mail size={17} /> Configurar el correo
            </button>
          )
        }
      />

      {items.length > 0 && (
        <section className="summary-strip">
          <div>
            <span>Pendientes</span>
            <strong>{items.length}</strong>
          </div>
          <div>
            <span>Suman</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          <div>
            <span>Con productos</span>
            <strong>
              {items.filter((item) => item.parsed.lines.length).length}
            </strong>
          </div>
        </section>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <section className="inbox-list">
        {items.map(({ receipt, parsed }) => {
          const open = expanded === receipt.id;
          return (
            <article className="inbox-card" key={receipt.id}>
              <header>
                <span className="inbox-icon">
                  {parsed.categoryHint === "supermercado" ? (
                    <ShoppingBasket size={19} />
                  ) : (
                    <ReceiptText size={19} />
                  )}
                </span>
                <div className="inbox-card-main">
                  <strong>{parsed.merchant}</strong>
                  <span>
                    {formatLongDate(parsed.date, data.household.timezone)} ·{" "}
                    {receipt.subject || "Sin asunto"}
                  </span>
                </div>
                <strong className="inbox-amount">
                  {parsed.total === null
                    ? "Sin total"
                    : parsed.currency === "EUR"
                      ? formatCurrency(parsed.total)
                      : `${parsed.total.toFixed(2)} ${parsed.currency}`}
                </strong>
              </header>

              {parsed.warnings.map((warning) => (
                <p className="inbox-warning" key={warning}>
                  <AlertTriangle size={15} />
                  <span>{warning}</span>
                </p>
              ))}

              {parsed.lines.length > 0 && (
                <>
                  <button
                    className="text-button inbox-toggle"
                    onClick={() => setExpanded(open ? null : receipt.id)}
                    aria-expanded={open}
                  >
                    {open ? "Ocultar" : "Ver"} los {parsed.lines.length}{" "}
                    productos
                    <ChevronDown size={14} className={open ? "rotated" : ""} />
                  </button>
                  {open && (
                    <ul className="inbox-lines">
                      {parsed.lines.map((line, index) => (
                        <li key={`${line.name}-${index}`}>
                          <span>
                            {line.quantity !== 1 && (
                              <em>{formatQuantity(line.quantity)} × </em>
                            )}
                            {line.name}
                          </span>
                          <strong>{formatCurrency(line.amount)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              <footer>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setError("");
                    setReviewing({ receipt, parsed });
                  }}
                >
                  <CheckCircle2 size={16} /> Revisar y guardar
                </button>
                <button
                  className="button button-ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Descartar el correo de ${parsed.merchant}? No se creará ningún gasto.`,
                      )
                    ) {
                      void discardMailReceipt(receipt.id);
                    }
                  }}
                >
                  <Trash2 size={16} /> Descartar
                </button>
              </footer>
            </article>
          );
        })}

        {!items.length && (
          <div className="empty-state">
            <Inbox size={30} />
            <h3>No hay tickets esperando</h3>
            <p>
              Cuando el script de Gmail encuentre una factura o un ticket, va a
              aparecer acá para que lo revises antes de guardarlo.
            </p>
            {onOpenSettings && (
              <button className="button button-secondary" onClick={onOpenSettings}>
                <Mail size={17} /> Configurar el correo
              </button>
            )}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title={`Ticket de ${reviewing?.parsed.merchant ?? ""}`}
        subtitle="Revisá lo que leímos del correo y guardá el gasto."
        width="lg"
      >
        {reviewing && (
          <ExpenseForm
            key={reviewing.receipt.id}
            data={data}
            expense={draftFromReceipt(reviewing, data)}
            submitLabel="Guardar gasto"
            onCancel={() => setReviewing(null)}
            onSubmit={async (expense) => {
              try {
                const created = (await addExpense(expense)) as
                  | { id?: string | number }
                  | undefined;
                await confirmMailReceipt(
                  reviewing.receipt.id,
                  created?.id === undefined ? undefined : String(created.id),
                );
                setReviewing(null);
              } catch (reason) {
                setError(errorMessage(reason));
                throw reason;
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function formatQuantity(value: number) {
  return String(Number(value.toFixed(3))).replace(".", ",");
}

/**
 * Convierte lo leído del correo en un gasto pre-cargado para el formulario.
 * Los productos van a las notas: sirven para reconocer la compra sin inventar
 * un modelo de líneas que el resto de la app no usa.
 */
function draftFromReceipt(
  { receipt, parsed }: ReviewItem,
  data: HouseholdData,
): Expense {
  const notes = parsed.lines.length
    ? parsed.lines
        .map(
          (line) =>
            `${line.quantity !== 1 ? `${formatQuantity(line.quantity)} × ` : ""}${line.name} — ${formatCurrency(line.amount)}`,
        )
        .join("\n")
    : "";

  const categoryId =
    suggestCategoryId(`${parsed.merchant} ${receipt.subject}`, data.categories) ??
    data.categories.find((category) => category.type === "expense")?.id ??
    "";
  const activeMembers = data.members.filter((member) => member.active);

  return {
    id: "",
    householdId: data.household.id,
    description: parsed.merchant,
    categoryId,
    amount: parsed.total ?? 0,
    currency: "EUR",
    paidByMemberId: activeMembers[0]?.id ?? "",
    date: parsed.date,
    splitType: "equal",
    participants: activeMembers.map((member) => ({
      memberId: member.id,
      amount: 0,
    })),
    status: "paid",
    notes,
    createdAt: receipt.receivedAt,
  };
}
