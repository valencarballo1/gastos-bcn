"use client";

import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckSquare2,
  CircleDollarSign,
  Plus,
  ReceiptText,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import type {
  HouseholdData,
  SuggestedTransfer,
  ViewKey,
} from "@/types";
import { daysUntil, formatCurrency, formatDate } from "@/utils/format";

interface DashboardPageProps {
  data: HouseholdData;
  suggestedTransfers: SuggestedTransfer[];
  onNavigate: (view: ViewKey) => void;
}

export function DashboardPage({
  data,
  suggestedTransfers,
  onNavigate,
}: DashboardPageProps) {
  const activeTasks = data.tasks.filter(
    (task) => task.status !== "completed" && task.status !== "cancelled",
  );
  const overdueTasks = activeTasks.filter(
    (task) => task.dueDate && new Date(task.dueDate) < new Date(),
  );
  const list = data.shoppingLists[0];
  const pendingItems = list.items.filter((item) => !item.purchased);
  const monthNow = new Date().getMonth();
  const monthlyExpenses = data.expenses.filter(
    (expense) =>
      expense.status === "paid" && new Date(expense.date).getMonth() === monthNow,
  );
  const monthlyTotal = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const transfer = suggestedTransfers[0];
  const from = data.members.find((member) => member.id === transfer?.fromMemberId);
  const to = data.members.find((member) => member.id === transfer?.toMemberId);
  const upcoming = [...data.recurringExpenses]
    .filter((item) => item.status === "active")
    .sort(
      (a, b) =>
        new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime(),
    )
    .slice(0, 3);

  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div>
          <span className="eyebrow">Hola, casa</span>
          <h1>Todo lo importante, en calma.</h1>
          <p>
            Un vistazo rápido a lo que hay que pagar, comprar y hacer esta semana.
          </p>
        </div>
        <button className="button button-secondary" onClick={() => onNavigate("activity")}>
          Ver actividad <ArrowRight size={17} />
        </button>
      </section>

      <section className="dashboard-hero-grid">
        <article className="balance-hero">
          <div className="balance-hero-top">
            <span className="hero-icon">
              <CircleDollarSign size={21} />
            </span>
            <span>Balance del hogar</span>
          </div>
          {transfer ? (
            <>
              <div className="balance-people">
                <Avatar member={from} size="lg" />
                <span className="balance-line">
                  <span />
                  <ArrowRight size={18} />
                </span>
                <Avatar member={to} size="lg" />
              </div>
              <h2>{formatCurrency(transfer.amount)}</h2>
              <p>
                <strong>{from?.name}</strong> le debe a <strong>{to?.name}</strong>
              </p>
            </>
          ) : (
            <div className="all-set">
              <Check size={28} />
              <h2>Todo saldado</h2>
              <p>No hay deudas pendientes entre integrantes.</p>
            </div>
          )}
          <button onClick={() => onNavigate("balances")}>
            Ver detalle del balance <ArrowRight size={16} />
          </button>
        </article>

        <div className="metric-grid">
          <MetricCard
            icon={<ReceiptText size={20} />}
            label="Gastado este mes"
            value={formatCurrency(monthlyTotal)}
            hint={`${monthlyExpenses.length} movimientos`}
            tone="coral"
          />
          <MetricCard
            icon={<CheckSquare2 size={20} />}
            label="Tareas pendientes"
            value={String(activeTasks.length)}
            hint={overdueTasks.length ? `${overdueTasks.length} vencidas` : "Todo a tiempo"}
            tone="sage"
          />
          <MetricCard
            icon={<ShoppingBasket size={20} />}
            label="Faltan comprar"
            value={String(pendingItems.length)}
            hint={`${list.items.length - pendingItems.length} ya están`}
            tone="mustard"
          />
          <MetricCard
            icon={<CalendarClock size={20} />}
            label="Próximo vencimiento"
            value={upcoming[0] ? `${Math.max(daysUntil(upcoming[0].nextDueDate), 0)} días` : "—"}
            hint={upcoming[0]?.name ?? "Sin vencimientos"}
            tone="blue"
          />
        </div>
      </section>

      <section className="quick-actions" aria-label="Acciones rápidas">
        <span>
          <Sparkles size={17} />
          Acciones rápidas
        </span>
        <div>
          <QuickAction
            label="Agregar gasto"
            icon={<ReceiptText size={18} />}
            onClick={() => onNavigate("expenses")}
          />
          <QuickAction
            label="Nueva tarea"
            icon={<CheckSquare2 size={18} />}
            onClick={() => onNavigate("tasks")}
          />
          <QuickAction
            label="Agregar producto"
            icon={<ShoppingBasket size={18} />}
            onClick={() => onNavigate("shopping")}
          />
          <QuickAction
            label="Registrar pago"
            icon={<CircleDollarSign size={18} />}
            onClick={() => onNavigate("balances")}
          />
        </div>
      </section>

      <section className="dashboard-columns">
        <article className="section-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Esta semana</span>
              <h2>Tareas de la casa</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("tasks")}>
              Ver todas
            </button>
          </header>
          <div className="compact-list">
            {activeTasks.slice(0, 4).map((task) => {
              const assignee = data.members.find(
                (member) => member.id === task.assignedToMemberId,
              );
              return (
                <div className="compact-row" key={task.id}>
                  <span className={`priority-dot priority-${task.priority}`} />
                  <div className="compact-main">
                    <strong>{task.title}</strong>
                    <span>
                      {task.dueDate
                        ? formatDate(
                            task.dueDate,
                            undefined,
                            data.household.timezone,
                          )
                        : "Sin fecha"}
                      {task.recurrence ? ` · ${task.recurrence}` : ""}
                    </span>
                  </div>
                  <Avatar member={assignee} size="sm" />
                </div>
              );
            })}
          </div>
        </article>

        <article className="section-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Próximamente</span>
              <h2>Pagos del hogar</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate("recurring")}>
              Gestionar
            </button>
          </header>
          <div className="compact-list">
            {upcoming.map((item) => {
              const payer = data.members.find(
                (member) => member.id === item.paidByMemberId,
              );
              return (
                <div className="compact-row upcoming-row" key={item.id}>
                  <span className="date-cube">
                    <strong>{new Date(item.nextDueDate).getDate()}</strong>
                    <small>
                      {new Intl.DateTimeFormat("es-ES", {
                        month: "short",
                        timeZone: data.household.timezone,
                      }).format(
                        new Date(item.nextDueDate),
                      )}
                    </small>
                  </span>
                  <div className="compact-main">
                    <strong>{item.name}</strong>
                    <span>
                      Paga {payer?.name} · {item.variableAmount ? "Importe variable" : formatCurrency(item.estimatedAmount ?? 0)}
                    </span>
                  </div>
                  <span className="status-pill status-pending">Pendiente</span>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="dashboard-columns dashboard-lower">
        <article className="section-card shopping-preview">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Lista compartida</span>
              <h2>{list.name}</h2>
            </div>
            <button className="button button-small" onClick={() => onNavigate("shopping")}>
              <Plus size={16} /> Agregar
            </button>
          </header>
          <div className="progress-line">
            <span
              style={{
                width: `${
                  list.items.length
                    ? (list.items.filter((item) => item.purchased).length /
                        list.items.length) *
                      100
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="progress-caption">
            {list.items.filter((item) => item.purchased).length} de {list.items.length} productos
          </p>
          <div className="shopping-chips">
            {pendingItems.slice(0, 6).map((item) => (
              <span key={item.id}>
                {item.name}
                {item.priority === "high" && <i>!</i>}
              </span>
            ))}
            {pendingItems.length > 6 && <span>+{pendingItems.length - 6}</span>}
          </div>
        </article>

        <article className="section-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Últimos movimientos</span>
              <h2>Actividad reciente</h2>
            </div>
          </header>
          <div className="activity-mini">
            {data.activities.slice(0, 4).map((activity) => (
              <div key={activity.id}>
                <span className={`activity-dot activity-${activity.entityType}`} />
                <p>
                  <strong>{activity.action}</strong>
                  <span>{activity.description}</span>
                </p>
                <time>
                  {formatDate(
                    activity.date,
                    undefined,
                    data.household.timezone,
                  )}
                </time>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <span className="metric-icon">{icon}</span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}>
      {icon}
      <span>{label}</span>
      <Plus size={15} />
    </button>
  );
}
