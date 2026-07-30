"use client";

import { useMemo, useState } from "react";
import {
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  List,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import type { HouseholdData } from "@/types";
import { formatCurrency, formatLongDate } from "@/utils/format";

type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  type: "task" | "expense";
};

export function CalendarPage({ data }: { data: HouseholdData }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const activeMonth = new Date();
  activeMonth.setMonth(activeMonth.getMonth() + monthOffset, 1);

  const events = useMemo<CalendarEvent[]>(
    () => [
      ...data.tasks
        .filter((task) => task.dueDate && task.status !== "cancelled")
        .map((task) => ({
          id: task.id,
          date: task.dueDate!,
          title: task.title,
          detail: task.status === "completed" ? "Completada" : "Tarea",
          type: "task" as const,
        })),
      ...data.recurringExpenses
        .filter((item) => item.status === "active")
        .map((item) => ({
          id: item.id,
          date: item.nextDueDate,
          title: item.name,
          detail: item.variableAmount
            ? "Importe variable"
            : formatCurrency(item.estimatedAmount ?? 0),
          type: "expense" as const,
        })),
    ],
    [data.recurringExpenses, data.tasks],
  );

  const firstWeekday = (new Date(activeMonth.getFullYear(), activeMonth.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(
    activeMonth.getFullYear(),
    activeMonth.getMonth() + 1,
    0,
  ).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const monthEvents = events.filter((event) => {
    const date = new Date(event.date);
    return (
      date.getFullYear() === activeMonth.getFullYear() &&
      date.getMonth() === activeMonth.getMonth()
    );
  });

  return (
    <div>
      <PageHeader
        eyebrow="Una vista, todo el hogar"
        title="Calendario"
        description="Tareas y vencimientos reunidos para anticiparse sin esfuerzo."
      />
      <section className="calendar-layout">
        <article className="calendar-card">
          <header className="calendar-toolbar">
            <button className="icon-button" onClick={() => setMonthOffset((value) => value - 1)}>
              <ChevronLeft size={19} />
            </button>
            <h2>
              {new Intl.DateTimeFormat("es-ES", {
                month: "long",
                year: "numeric",
              }).format(activeMonth)}
            </h2>
            <button className="icon-button" onClick={() => setMonthOffset((value) => value + 1)}>
              <ChevronRight size={19} />
            </button>
          </header>
          <div className="calendar-weekdays">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((day, index) => {
              const dayEvents = day
                ? monthEvents.filter((event) => new Date(event.date).getDate() === day)
                : [];
              const isToday =
                day === new Date().getDate() &&
                activeMonth.getMonth() === new Date().getMonth() &&
                activeMonth.getFullYear() === new Date().getFullYear();
              return (
                <div className={`${day ? "" : "empty-day"} ${isToday ? "today" : ""}`} key={index}>
                  {day && <span className="calendar-day-number">{day}</span>}
                  {dayEvents.slice(0, 2).map((event) => (
                    <span className={`calendar-event event-${event.type}`} key={event.id}>
                      {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 && <small>+{dayEvents.length - 2} más</small>}
                </div>
              );
            })}
          </div>
        </article>

        <aside className="agenda-card">
          <header className="section-card-header">
            <div>
              <span className="eyebrow">Agenda</span>
              <h2>Próximos eventos</h2>
            </div>
            <List size={19} />
          </header>
          <div className="agenda-list">
            {[...events]
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .slice(0, 8)
              .map((event) => (
                <article key={`${event.type}-${event.id}`}>
                  <span className={`agenda-icon agenda-${event.type}`}>
                    {event.type === "task" ? (
                      <CheckSquare2 size={17} />
                    ) : (
                      <CircleDollarSign size={17} />
                    )}
                  </span>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{formatLongDate(event.date)}</span>
                  </div>
                  <small>{event.detail}</small>
                </article>
              ))}
          </div>
          <footer className="calendar-legend">
            <span>
              <i className="legend-task" /> Tareas
            </span>
            <span>
              <i className="legend-expense" /> Vencimientos
            </span>
          </footer>
        </aside>
      </section>
    </div>
  );
}
