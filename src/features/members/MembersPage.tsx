"use client";

import { useState, type FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Mail,
  MoreHorizontal,
  Plus,
  UserRoundPlus,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import type { HouseholdData, HouseholdMember } from "@/types";
import { formatLongDate } from "@/utils/format";

interface MembersPageProps {
  data: HouseholdData;
  addMember: (
    member: Omit<HouseholdMember, "id" | "householdId" | "joinedAt" | "active">,
  ) => void;
  toggleMemberStatus: (id: string) => void;
}

export function MembersPage({
  data,
  addMember,
  toggleMemberStatus,
}: MembersPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <div>
      <PageHeader
        eyebrow="La casa se hace en equipo"
        title="Integrantes"
        description="Personas que participan en los gastos, tareas y decisiones del hogar."
        action={
          <button className="button button-primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} /> Agregar integrante
          </button>
        }
      />

      <section className="members-grid">
        {data.members.map((member) => (
          <article className={`member-card ${member.active ? "" : "is-inactive"}`} key={member.id}>
            <header>
              <Avatar member={member} size="lg" />
              <button className="icon-button">
                <MoreHorizontal size={19} />
              </button>
            </header>
            <span className={`status-pill ${member.active ? "status-active" : "status-paused"}`}>
              {member.active ? "Activo" : "Inactivo"}
            </span>
            <h2>{member.name}</h2>
            <div className="member-details">
              {member.email && (
                <span>
                  <Mail size={15} />
                  {member.email}
                </span>
              )}
              <span>
                <CalendarDays size={15} />
                Desde {formatLongDate(member.joinedAt)}
              </span>
            </div>
            <footer>
              <span style={{ color: member.color }}>
                <CheckCircle2 size={16} />
                Color identificativo
              </span>
              <button className="text-button" onClick={() => toggleMemberStatus(member.id)}>
                {member.active ? "Desactivar" : "Reactivar"}
              </button>
            </footer>
          </article>
        ))}
        <button className="member-add-card" onClick={() => setModalOpen(true)}>
          <span>
            <UserRoundPlus size={25} />
          </span>
          <strong>Sumar a alguien</strong>
          <small>Podrá participar de gastos y tareas.</small>
        </button>
      </section>

      <MemberForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(member) => {
          addMember(member);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function MemberForm({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    member: Omit<HouseholdMember, "id" | "householdId" | "joinedAt" | "active">,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("#6B7C6C");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const words = name.trim().split(/\s+/);
    const initials = words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("");
    onSubmit({ name: name.trim(), email: email || undefined, color, initials });
    setName("");
    setEmail("");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo integrante"
      subtitle="Después podrá vincularse con una cuenta de usuario del backend."
    >
      <form className="app-form" onSubmit={submit}>
        <label className="field">
          <span>Nombre</span>
          <input
            autoFocus
            placeholder="Nombre y apellido"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Correo electrónico opcional</span>
          <input
            type="email"
            placeholder="persona@correo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field color-field">
          <span>Color identificativo</span>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          <span style={{ backgroundColor: color }}>{color}</span>
        </label>
        <div className="form-actions">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary">
            Agregar integrante
          </button>
        </div>
      </form>
    </Modal>
  );
}
