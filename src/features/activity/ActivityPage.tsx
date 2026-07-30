"use client";

import {
  CheckSquare2,
  CircleDollarSign,
  Clock3,
  ReceiptText,
  Repeat2,
  ShoppingBasket,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { PageHeader } from "@/components/common/PageHeader";
import type { Activity, HouseholdData } from "@/types";
import { formatLongDate } from "@/utils/format";

const icons = {
  expense: ReceiptText,
  settlement: CircleDollarSign,
  task: CheckSquare2,
  shopping: ShoppingBasket,
  recurring: Repeat2,
  member: Users,
};

export function ActivityPage({ data }: { data: HouseholdData }) {
  const groups = data.activities.reduce<Record<string, Activity[]>>((result, activity) => {
    const key = new Date(activity.date).toDateString();
    result[key] = [...(result[key] ?? []), activity];
    return result;
  }, {});

  return (
    <div>
      <PageHeader
        eyebrow="Todo queda registrado"
        title="Historial del hogar"
        description="Una cronología clara de gastos, tareas, compras y liquidaciones."
      />
      <section className="activity-timeline-card">
        {Object.entries(groups).map(([date, activities]) => (
          <div className="activity-day" key={date}>
            <header>
              <CalendarBadge date={activities[0].date} />
              <h2>{formatLongDate(activities[0].date)}</h2>
            </header>
            <div>
              {activities.map((activity) => {
                const Icon = icons[activity.entityType];
                const member = data.members.find((item) => item.id === activity.memberId);
                return (
                  <article key={activity.id}>
                    <span className={`timeline-icon activity-${activity.entityType}`}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <strong>{activity.action}</strong>
                      <p>{activity.description}</p>
                    </div>
                    <Avatar member={member} size="sm" />
                    <time>
                      {new Intl.DateTimeFormat("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(activity.date))}
                    </time>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
        {!data.activities.length && (
          <div className="empty-state">
            <Clock3 size={30} />
            <h3>Todavía no hay actividad</h3>
          </div>
        )}
      </section>
    </div>
  );
}

function CalendarBadge({ date }: { date: string }) {
  return (
    <span className="calendar-badge">
      <strong>{new Date(date).getDate()}</strong>
      <small>
        {new Intl.DateTimeFormat("es-ES", { month: "short" }).format(new Date(date))}
      </small>
    </span>
  );
}
