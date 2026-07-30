"use client";

import { BarChart3, CircleDollarSign, TrendingUp, Users } from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { PageHeader } from "@/components/common/PageHeader";
import type { BalanceSummary, HouseholdData } from "@/types";
import { formatCurrency } from "@/utils/format";

export function ReportsPage({
  data,
  balances,
}: {
  data: HouseholdData;
  balances: BalanceSummary[];
}) {
  const categoryTotals = data.categories
    .filter((category) => category.type === "expense")
    .map((category) => ({
      ...category,
      total: data.expenses
        .filter(
          (expense) =>
            expense.categoryId === category.id && expense.status === "paid",
        )
        .reduce((sum, expense) => sum + expense.amount, 0),
    }))
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total);
  const total = categoryTotals.reduce((sum, item) => sum + item.total, 0);
  const max = Math.max(...categoryTotals.map((item) => item.total), 1);
  const completedTasks = data.tasks.filter((task) => task.status === "completed");

  return (
    <div>
      <PageHeader
        eyebrow="Entender sin complicarse"
        title="Estadísticas"
        description="Una lectura simple de los gastos y de cómo se reparte la vida del hogar."
      />

      <section className="report-kpis">
        <article>
          <span className="summary-icon summary-icon-coral">
            <CircleDollarSign size={20} />
          </span>
          <div>
            <span>Gasto registrado</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
        </article>
        <article>
          <span className="summary-icon summary-icon-sage">
            <TrendingUp size={20} />
          </span>
          <div>
            <span>Categoría principal</span>
            <strong>{categoryTotals[0]?.name ?? "—"}</strong>
          </div>
        </article>
        <article>
          <span className="summary-icon summary-icon-blue">
            <Users size={20} />
          </span>
          <div>
            <span>Tareas completadas</span>
            <strong>{completedTasks.length}</strong>
          </div>
        </article>
      </section>

      <section className="reports-grid">
        <article className="report-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Distribución</span>
              <h2>Gastos por categoría</h2>
            </div>
            <BarChart3 size={20} />
          </header>
          <div className="horizontal-chart">
            {categoryTotals.map((category) => (
              <div key={category.id}>
                <span>{category.name}</span>
                <div>
                  <i
                    style={{
                      width: `${(category.total / max) * 100}%`,
                      backgroundColor: category.color,
                    }}
                  />
                </div>
                <strong>{formatCurrency(category.total)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="report-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Aportes</span>
              <h2>Pagado por integrante</h2>
            </div>
          </header>
          <div className="member-report-list">
            {balances.map((balance) => {
              const member = data.members.find((item) => item.id === balance.memberId);
              const share = total ? Math.round((balance.paid / total) * 100) : 0;
              return (
                <article key={balance.memberId}>
                  <Avatar member={member} size="md" />
                  <div>
                    <strong>{member?.name}</strong>
                    <span>{share}% del total pagado</span>
                    <div>
                      <i style={{ width: `${share}%`, backgroundColor: member?.color }} />
                    </div>
                  </div>
                  <b>{formatCurrency(balance.paid)}</b>
                </article>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}
