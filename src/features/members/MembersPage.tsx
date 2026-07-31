"use client";

import { useState, type FormEvent } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  Copy,
  Crown,
  Link2,
  Mail,
  MoreHorizontal,
  Plus,
  Send,
  ShieldCheck,
  UserRoundPlus,
  XCircle,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { Modal } from "@/components/common/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { errorMessage } from "@/services/api";
import type {
  HouseholdData,
  HouseholdInvitation,
} from "@/types";
import { formatLongDate } from "@/utils/format";
import { copyText, invitationUrl } from "@/utils/invitations";

interface MembersPageProps {
  data: HouseholdData;
  invitations: HouseholdInvitation[];
  canManage: boolean;
  createInvitation: (input: {
    email?: string;
    mode: HouseholdInvitation["mode"];
    role?: HouseholdInvitation["role"];
  }) => Promise<HouseholdInvitation>;
  revokeInvitation: (id: string) => Promise<unknown>;
  toggleMemberStatus: (id: string) => Promise<unknown>;
}

export function MembersPage({
  data,
  invitations,
  canManage,
  createInvitation,
  revokeInvitation,
  toggleMemberStatus,
}: MembersPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === "pending",
  );

  return (
    <div>
      <PageHeader
        eyebrow="La casa se hace en equipo"
        title="Personas de la casa"
        description="Solo quienes aceptaron la invitación pueden recibir tareas, participar de gastos y usar las listas."
        action={canManage ? (
          <button className="button button-primary" onClick={() => setModalOpen(true)}>
            <UserRoundPlus size={18} /> Invitar persona
          </button>
        ) : undefined}
      />

      <section className="member-access-note">
        <span>
          <ShieldCheck size={20} />
        </span>
        <div>
          <strong>{data.members.filter((member) => member.active).length} integrantes activos</strong>
          <p>
            Las invitaciones pendientes no aparecen todavía en responsables ni repartos.
          </p>
        </div>
      </section>

      <section className="members-grid">
        {data.members.map((member) => (
          <article className={`member-card ${member.active ? "" : "is-inactive"}`} key={member.id}>
            <header>
              <Avatar member={member} size="lg" />
              <button className="icon-button" aria-label={`Opciones de ${member.name}`}>
                <MoreHorizontal size={19} />
              </button>
            </header>
            <div className="member-status-row">
              <span className={`status-pill ${member.active ? "status-active" : "status-paused"}`}>
                {member.active ? "Activo" : "Inactivo"}
              </span>
              <span className={`member-role role-${member.role ?? "member"}`}>
                {member.role === "owner" ? <Crown size={12} /> : <BadgeCheck size={12} />}
                {roleLabel(member.role ?? "member")}
              </span>
            </div>
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
                <BadgeCheck size={16} />
                Puede recibir tareas
              </span>
              {canManage && member.role !== "owner" && (
                <button className="text-button" onClick={() => void toggleMemberStatus(member.id)}>
                  {member.active ? "Desactivar" : "Reactivar"}
                </button>
              )}
            </footer>
          </article>
        ))}
        {canManage && <button className="member-add-card" onClick={() => setModalOpen(true)}>
          <span>
            <UserRoundPlus size={25} />
          </span>
          <strong>Invitar a alguien</strong>
          <small>Por correo electrónico o compartiendo un enlace.</small>
        </button>}
      </section>

      <section className="pending-invitations">
        <header className="section-card-header">
          <div>
            <span className="eyebrow">Acceso al hogar</span>
            <h2>Invitaciones pendientes</h2>
          </div>
          <span className="pending-count">{pendingInvitations.length}</span>
        </header>
        <div>
          {pendingInvitations.map((invitation) => (
            <article key={invitation.id}>
              <span className="invitation-icon">
                {invitation.mode === "email" ? <Mail size={18} /> : <Link2 size={18} />}
              </span>
              <div>
                <strong>
                  {invitation.email ?? "Enlace de invitación"}
                </strong>
                <span>
                  {roleLabel(invitation.role)} · vence {formatLongDate(invitation.expiresAt)}
                </span>
              </div>
              <button
                className="button button-small"
                onClick={() => copyInvitation(invitation)}
              >
                <Copy size={14} /> Copiar
              </button>
              {canManage && <button
                className="icon-button danger-button"
                onClick={() => {
                  if (window.confirm("¿Revocar esta invitación?")) {
                    void revokeInvitation(invitation.id);
                  }
                }}
                aria-label="Revocar invitación"
              >
                <XCircle size={17} />
              </button>}
            </article>
          ))}
          {!pendingInvitations.length && (
            <div className="empty-invitations">
              <Clock3 size={22} />
              <span>No hay invitaciones esperando respuesta.</span>
            </div>
          )}
        </div>
      </section>

      {canManage && <InvitationForm
        key={String(modalOpen)}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        householdName={data.household.name}
        onSubmit={createInvitation}
      />}
    </div>
  );
}

function InvitationForm({
  open,
  onClose,
  householdName,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  householdName: string;
  onSubmit: MembersPageProps["createInvitation"];
}) {
  const [mode, setMode] = useState<HouseholdInvitation["mode"]>("email");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<HouseholdInvitation["role"]>("member");
  const [created, setCreated] = useState<HouseholdInvitation | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "email" && !email.includes("@")) {
      setError("Ingresá un correo electrónico válido.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      setCreated(
        await onSubmit({
          email: mode === "email" ? email : undefined,
          mode,
          role,
        }),
      );
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  };

  const createdInvitationUrl = created ? invitationUrl(created) : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={created ? "Invitación preparada" : "Invitar al hogar"}
      subtitle={
        created
          ? `La persona entrará a ${householdName} cuando acepte.`
          : "Podrá acceder después de iniciar sesión con Google."
      }
    >
      {created ? (
        <div className="invitation-success">
          <span className="invitation-success-icon">
            <Send size={25} />
          </span>
          <div>
            <span className="eyebrow">
              {created.mode === "email" ? "Invitación por correo" : "Enlace privado"}
            </span>
            <h3>{created.email ?? "Compartí este enlace"}</h3>
            <p>Caduca en 7 días y solo puede aceptarse una vez.</p>
          </div>
          <label className="copy-link-field">
            <input value={createdInvitationUrl} readOnly aria-label="Enlace de invitación" />
            <button
              type="button"
              onClick={() => {
                void copyText(createdInvitationUrl)
                  .then(() => setCopied(true))
                  .catch((reason) => setError(errorMessage(reason)));
              }}
            >
              <Copy size={16} /> {copied ? "Copiado" : "Copiar"}
            </button>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary" onClick={onClose}>
            Listo
          </button>
        </div>
      ) : (
        <form className="app-form" onSubmit={(event) => void submit(event)}>
          <div className="segmented-control invitation-mode">
            <button
              type="button"
              className={mode === "email" ? "active" : ""}
              onClick={() => setMode("email")}
            >
              <Mail size={16} /> Por correo
            </button>
            <button
              type="button"
              className={mode === "link" ? "active" : ""}
              onClick={() => setMode("link")}
            >
              <Link2 size={16} /> Crear enlace
            </button>
          </div>
          {mode === "email" && (
            <label className="field">
              <span>Correo electrónico</span>
              <input
                autoFocus
                type="email"
                placeholder="persona@gmail.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          <label className="field">
            <span>Permisos</span>
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as HouseholdInvitation["role"])
              }
            >
              <option value="member">Integrante · tareas, compras y gastos</option>
              <option value="admin">Administrador · también puede invitar</option>
            </select>
          </label>
          <div className="invitation-explainer">
            <ShieldCheck size={20} />
            <p>
              <strong>La invitación no crea un integrante todavía.</strong>
              <span>
                Se vinculará con su cuenta Google cuando la acepte.
              </span>
            </p>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button button-primary" disabled={submitting}>
              <Plus size={16} /> Crear invitación
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function copyInvitation(invitation: HouseholdInvitation) {
  void copyText(invitationUrl(invitation));
}

function roleLabel(role: HouseholdMemberRole) {
  if (role === "owner") return "Propietario";
  if (role === "admin") return "Administrador";
  return "Integrante";
}

type HouseholdMemberRole = "owner" | "admin" | "member";
