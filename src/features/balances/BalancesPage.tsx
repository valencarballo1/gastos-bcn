"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Equal,
  History,
  Plus,
  ReceiptText,
  Send,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { errorMessage } from "@/services/api";
import type {
  BalanceSummary,
  HouseholdData,
  Settlement,
  SuggestedTransfer,
} from "@/types";
import { formatCurrency, formatLongDate } from "@/utils/format";

interface BalancesPageProps {
  data: HouseholdData;
  balances: BalanceSummary[];
  suggestedTransfers: SuggestedTransfer[];
  addSettlement: (
    settlement: Omit<Settlement, "id" | "householdId" | "status" | "rowVersion">,
  ) => Promise<unknown>;
}

export function BalancesPage({
  data,
  balances,
  suggestedTransfers,
  addSettlement,
}: BalancesPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<SuggestedTransfer | undefined>();

  const openSettlement = (transfer?: SuggestedTransfer) => {
    setPrefill(transfer);
    setModalOpen(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Cuentas claras"
        title="Balances"
        description="Cuánto pagó cada uno, cuánto le correspondía y la forma más simple de saldar."
        action={
          <button className="button button-primary" onClick={() => openSettlement()}>
            <Plus size={18} /> Registrar pago
          </button>
        }
      />

      {suggestedTransfers.length ? (
        <section className="settlement-hero">
          <div className="settlement-hero-icon">
            <CircleDollarSign size={24} />
          </div>
          <div>
            <span className="eyebrow">Para quedar a mano</span>
            <h2>{suggestedTransfers.length === 1 ? "Solo hace falta un movimiento" : `${suggestedTransfers.length} movimientos sugeridos`}</h2>
            <p>Calculamos la menor cantidad de transferencias necesaria.</p>
          </div>
        </section>
      ) : (
        <section className="settlement-hero is-clear">
          <CheckCircle2 size={28} />
          <div>
            <h2>Las cuentas están saldadas</h2>
            <p>No hay transferencias pendientes entre integrantes.</p>
          </div>
        </section>
      )}

      <section className="balance-layout">
        <div className="balance-main">
          <div className="member-balance-grid">
            {balances.map((balance) => {
              const member = data.members.find((item) => item.id === balance.memberId);
              return (
                <article className="member-balance-card" key={balance.memberId}>
                  <header>
                    <Avatar member={member} size="lg" />
                    <div>
                      <h2>{member?.name}</h2>
                      <span className={balance.balance >= 0 ? "positive" : "negative"}>
                        {balance.balance >= 0 ? "Tiene a favor" : "Debe"}{" "}
                        {formatCurrency(Math.abs(balance.balance))}
                      </span>
                    </div>
                  </header>
                  <dl>
                    <div>
                      <dt>Pagó</dt>
                      <dd>{formatCurrency(balance.paid)}</dd>
                    </div>
                    <div>
                      <dt>Le correspondía</dt>
                      <dd>{formatCurrency(balance.owed)}</dd>
                    </div>
                    <div>
                      <dt>Liquidaciones</dt>
                      <dd>{formatCurrency(balance.settlementsSent - balance.settlementsReceived)}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>

          <article className="data-card transfer-card">
            <header className="section-card-header">
              <div>
                <span className="eyebrow">Sugerencia automática</span>
                <h2>Cómo saldar las cuentas</h2>
              </div>
              <Equal size={20} />
            </header>
            <div className="suggested-transfers">
              {suggestedTransfers.map((transfer) => {
                const from = data.members.find((item) => item.id === transfer.fromMemberId);
                const to = data.members.find((item) => item.id === transfer.toMemberId);
                return (
                  <div key={`${transfer.fromMemberId}-${transfer.toMemberId}`}>
                    <div className="transfer-people">
                      <Avatar member={from} size="md" showName />
                      <span>
                        <ArrowRight size={18} />
                      </span>
                      <Avatar member={to} size="md" showName />
                    </div>
                    <strong>{formatCurrency(transfer.amount)}</strong>
                    <button className="button button-small" onClick={() => openSettlement(transfer)}>
                      <Send size={15} /> Registrar
                    </button>
                  </div>
                );
              })}
              {!suggestedTransfers.length && (
                <div className="empty-inline">
                  <CheckCircle2 size={22} />
                  <span>No hay pagos pendientes.</span>
                </div>
              )}
            </div>
          </article>
        </div>

        <aside className="data-card settlement-history">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Movimientos</span>
              <h2>Liquidaciones</h2>
            </div>
            <History size={19} />
          </header>
          {data.settlements.map((settlement) => {
            const from = data.members.find((item) => item.id === settlement.fromMemberId);
            const to = data.members.find((item) => item.id === settlement.toMemberId);
            return (
              <article key={settlement.id}>
                <span className="history-icon">
                  <ReceiptText size={17} />
                </span>
                <div>
                  <strong>
                    {from?.name} → {to?.name}
                  </strong>
                  <span>
                    {settlement.method} · {formatLongDate(settlement.date, data.household.timezone)}
                  </span>
                </div>
                <b>{formatCurrency(settlement.amount)}</b>
              </article>
            );
          })}
          {!data.settlements.length && (
            <div className="empty-state empty-state-small">
              <History size={26} />
              <h3>Aún no hay liquidaciones</h3>
              <p>Los pagos entre integrantes aparecerán acá.</p>
            </div>
          )}
        </aside>
      </section>

      <SettlementForm
        key={`${modalOpen}-${prefill?.amount ?? "new"}`}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
        prefill={prefill}
        onSubmit={async (settlement) => {
          await addSettlement(settlement);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function SettlementForm({
  open,
  onClose,
  data,
  prefill,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  data: HouseholdData;
  prefill?: SuggestedTransfer;
  onSubmit: (settlement: Omit<Settlement, "id" | "householdId" | "status" | "rowVersion">) => Promise<unknown>;
}) {
  const members = data.members.filter((member) => member.active);
  const [fromId, setFromId] = useState(prefill?.fromMemberId ?? members[0]?.id ?? "");
  const [toId, setToId] = useState(prefill?.toMemberId ?? members[1]?.id ?? "");
  const [amount, setAmount] = useState(prefill ? String(prefill.amount) : "");
  const [method, setMethod] = useState<Settlement["method"]>("Bizum");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (fromId === toId || Number(amount) <= 0) {
      setError("Elegí dos integrantes distintos y un importe mayor a cero.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        fromMemberId: fromId,
        toMemberId: toId,
        amount: Number(amount),
        method,
        date: new Date().toISOString(),
        concept: "Liquidación de saldo",
      });
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
      title="Registrar liquidación"
      subtitle="Este pago ajustará el balance, sin modificar los gastos originales."
    >
      <form className="app-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label className="field">
            <span>Quién paga</span>
            <select value={fromId} onChange={(event) => setFromId(event.target.value)}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Quién recibe</span>
            <select value={toId} onChange={(event) => setToId(event.target.value)}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Importe</span>
            <div className="input-prefix">
              <span>€</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          </label>
          <label className="field">
            <span>Método</span>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as Settlement["method"])}
            >
              {["Bizum", "Transferencia", "Efectivo", "PayPal", "Revolut", "Otro"].map(
                (value) => (
                  <option key={value}>{value}</option>
                ),
              )}
            </select>
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            {submitting ? "Registrando…" : "Registrar pago"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
