"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Filter,
  ListChecks,
  Plus,
  RotateCw,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { errorMessage } from "@/services/api";
import type { HouseholdData, HouseholdTask, TaskPriority } from "@/types";
import { formatDate } from "@/utils/format";

interface TasksPageProps {
  data: HouseholdData;
  addTask: (
    task: Omit<HouseholdTask, "id" | "householdId" | "createdAt" | "checklist" | "rowVersion">,
  ) => Promise<unknown>;
  setTaskStatus: (id: string, status: HouseholdTask["status"]) => Promise<unknown>;
  toggleChecklist: (taskId: string, checklistId: string) => Promise<unknown>;
}

export function TasksPage({
  data,
  addTask,
  setTaskStatus,
  toggleChecklist,
}: TasksPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | HouseholdTask["status"]>("all");
  const tasks = useMemo(
    () => data.tasks.filter((task) => filter === "all" || task.status === filter),
    [data.tasks, filter],
  );
  const counts = {
    pending: data.tasks.filter((task) => task.status === "pending").length,
    progress: data.tasks.filter((task) => task.status === "in_progress").length,
    completed: data.tasks.filter((task) => task.status === "completed").length,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Entre todos"
        title="Tareas de la casa"
        description="Repartí lo cotidiano, seguí el progreso y mantené la casa en orden."
        action={
          <button className="button button-primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} /> Nueva tarea
          </button>
        }
      />

      <section className="task-summary-grid">
        <TaskSummary icon={<Clock3 size={20} />} label="Pendientes" value={counts.pending} tone="mustard" />
        <TaskSummary icon={<RotateCw size={20} />} label="En progreso" value={counts.progress} tone="blue" />
        <TaskSummary icon={<CheckCircle2 size={20} />} label="Completadas" value={counts.completed} tone="sage" />
      </section>

      <section className="toolbar task-toolbar">
        <span className="toolbar-label">
          <Filter size={16} /> Mostrar
        </span>
        <div className="filter-pills">
          {[
            ["all", "Todas"],
            ["pending", "Pendientes"],
            ["in_progress", "En progreso"],
            ["completed", "Completadas"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value as typeof filter)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="task-list">
        {tasks.map((task) => {
          const assignee = data.members.find(
            (member) => member.id === task.assignedToMemberId,
          );
          const checklistDone = task.checklist.filter((item) => item.completed).length;
          return (
            <article className={`task-card task-${task.status}`} key={task.id}>
              <button
                className="task-complete-button"
                onClick={() =>
                  void setTaskStatus(
                    task.id,
                    task.status === "completed" ? "pending" : "completed",
                  )
                }
                aria-label={
                  task.status === "completed"
                    ? `Reabrir ${task.title}`
                    : `Completar ${task.title}`
                }
              >
                {task.status === "completed" && <Check size={17} />}
              </button>
              <div className="task-main">
                <div className="task-title-row">
                  <h2>{task.title}</h2>
                  <span className={`priority-badge priority-${task.priority}`}>
                    {priorityLabel(task.priority)}
                  </span>
                </div>
                <div className="task-meta-row">
                  <span>
                    <span className="task-category-dot" />
                    {task.category}
                  </span>
                  {task.dueDate && (
                    <span>
                      <CalendarDays size={15} />
                      {formatDate(task.dueDate, undefined, data.household.timezone)}
                    </span>
                  )}
                  {task.recurrence && (
                    <span>
                      <RotateCw size={14} />
                      {task.recurrence}
                    </span>
                  )}
                </div>
                {task.checklist.length > 0 && (
                  <div className="task-checklist">
                    <span>
                      <ListChecks size={15} />
                      {checklistDone}/{task.checklist.length}
                    </span>
                    {task.checklist.map((item) => (
                      <button
                        key={item.id}
                        className={item.completed ? "completed" : ""}
                        onClick={() => void toggleChecklist(task.id, item.id)}
                      >
                        <i>{item.completed && <Check size={11} />}</i>
                        {item.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="task-assignee">
                <Avatar member={assignee} size="md" />
                <span>{assignee?.name ?? "Sin asignar"}</span>
              </div>
              {task.status !== "completed" && (
                <button
                  className="button button-small button-soft"
                  onClick={() =>
                    void setTaskStatus(
                      task.id,
                      task.status === "in_progress" ? "pending" : "in_progress",
                    )
                  }
                >
                  {task.status === "in_progress" ? "Pausar" : "Empezar"}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <TaskForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        data={data}
        onSubmit={async (task) => {
          await addTask(task);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function TaskSummary({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <article>
      <span className={`summary-icon summary-icon-${tone}`}>{icon}</span>
      <p>
        <span>{label}</span>
        <strong>{value}</strong>
      </p>
    </article>
  );
}

function TaskForm({
  open,
  onClose,
  data,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  data: HouseholdData;
  onSubmit: (
    task: Omit<HouseholdTask, "id" | "householdId" | "createdAt" | "checklist" | "rowVersion">,
  ) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const taskCategories = data.categories.filter(
    (category) => category.type === "task",
  );
  const [categoryId, setCategoryId] = useState(
    taskCategories[0]?.id ?? "",
  );
  const [assigneeId, setAssigneeId] = useState(
    data.members.find((member) => member.active)?.id ?? "",
  );
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [recurrence, setRecurrence] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        title: title.trim(),
        categoryId,
        category:
          taskCategories.find((item) => item.id === categoryId)?.name ??
          "Sin categoría",
        assignedToMemberId: assigneeId,
        priority,
        status: "pending",
        dueDate: dueDate ? new Date(`${dueDate}T18:00:00`).toISOString() : undefined,
        recurrence: recurrence || undefined,
      });
      setTitle("");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva tarea" subtitle="Definí lo esencial; el resto puede esperar.">
      <form className="app-form" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>¿Qué hay que hacer?</span>
          <input
            autoFocus
            placeholder="Ej. Cambiar las sábanas"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Categoría</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {taskCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Responsable</span>
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
              {data.members
                .filter((member) => member.active)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Fecha límite</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Prioridad</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Recurrencia opcional</span>
          <select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>
            <option value="">No se repite</option>
            <option value="Diaria">Diaria</option>
            <option value="Semanal">Semanal</option>
            <option value="Cada dos semanas">Cada dos semanas</option>
            <option value="Mensual">Mensual</option>
          </select>
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            {submitting ? "Creando…" : "Crear tarea"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function priorityLabel(priority: TaskPriority) {
  return {
    low: "Baja",
    medium: "Media",
    high: "Alta",
    urgent: "Urgente",
  }[priority];
}
