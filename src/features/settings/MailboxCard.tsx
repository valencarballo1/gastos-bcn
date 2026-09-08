"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Mail, RefreshCw } from "lucide-react";
import { errorMessage } from "@/services/api";
import { API_URL } from "@/services/api";

interface MailboxCardProps {
  householdId: string;
  canManage: boolean;
  loadToken: () => Promise<{ token?: string; configured: boolean }>;
  rotateToken: () => Promise<{ token: string; configured: boolean }>;
}

/**
 * Conexión con Gmail.
 *
 * No pedimos acceso a tu correo: el script corre en tu propia cuenta de Google
 * y solo manda hacia acá los correos que parecen tickets. Lo único que se
 * comparte es este token, que se puede rotar cuando quieras.
 */
export function MailboxCard({
  householdId,
  canManage,
  loadToken,
  rotateToken,
}: MailboxCardProps) {
  const [token, setToken] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadToken()
      .then((result) => {
        if (cancelled) return;
        setToken(result.token ?? null);
        setConfigured(result.configured);
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManage, loadToken]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("El navegador no dejó copiar. Seleccioná el texto a mano.");
    }
  };

  const rotate = async () => {
    if (
      configured &&
      !window.confirm(
        "Se generará un token nuevo y el script que tengas instalado dejará de funcionar hasta que lo actualices. ¿Seguimos?",
      )
    ) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      const result = await rotateToken();
      setToken(result.token);
      setConfigured(true);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setWorking(false);
    }
  };

  if (!canManage) {
    return (
      <article className="settings-card">
        <header className="section-card-header">
          <span className="eyebrow">Tickets por correo</span>
          <h2>
            <Mail size={18} /> Gmail
          </h2>
        </header>
        <p className="settings-hint">
          Solo quien administra el hogar puede conectar el correo.
        </p>
      </article>
    );
  }

  return (
    <article className="settings-card settings-mailbox-card">
      <header className="section-card-header">
        <span className="eyebrow">Tickets por correo</span>
        <h2>
          <Mail size={18} /> Leer los tickets de Gmail
        </h2>
      </header>

      <p className="settings-hint">
        Un script que corre en tu cuenta de Google busca las facturas y los
        tickets y los deja en la <strong>Bandeja</strong> para que los revises.
        Casa Clara nunca entra a tu correo: solo recibe lo que el script manda,
        y nada se convierte en gasto sin que lo confirmes.
      </p>

      <ol className="settings-steps">
        <li>
          Generá el token de ingesta y copiá los tres datos de abajo.
        </li>
        <li>
          Abrí <code>script.google.com</code>, creá un proyecto y pegá el
          archivo <code>docs/gmail-apps-script.gs</code> del repositorio.
        </li>
        <li>
          Completá <code>CONFIG</code>, ejecutá <code>importarTickets</code> una
          vez para dar permiso y después <code>crearDisparador</code> para que
          se repita cada hora.
        </li>
      </ol>

      <div className="settings-token-grid">
        <TokenField
          label="apiUrl"
          value={API_URL}
          copied={copied === "apiUrl"}
          onCopy={() => void copy("apiUrl", API_URL)}
        />
        <TokenField
          label="householdId"
          value={householdId}
          copied={copied === "householdId"}
          onCopy={() => void copy("householdId", householdId)}
        />
        <TokenField
          label="token"
          value={
            loading
              ? "Cargando…"
              : token ?? "Todavía no generaste el token de ingesta."
          }
          secret
          copied={copied === "token"}
          onCopy={() => token && void copy("token", token)}
        />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="settings-actions">
        <button
          className="button button-primary"
          onClick={() => void rotate()}
          disabled={working || loading}
        >
          {configured ? <RefreshCw size={16} /> : <KeyRound size={16} />}
          {working
            ? "Generando…"
            : configured
              ? "Generar un token nuevo"
              : "Generar token de ingesta"}
        </button>
      </div>

      <p className="settings-hint settings-hint-small">
        Si perdés el acceso o querés cortar la conexión, generá un token nuevo:
        el script viejo deja de entrar al instante.
      </p>
    </article>
  );
}

function TokenField({
  label,
  value,
  secret = false,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  secret?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const hidden = secret && !revealed && value.length > 12;

  return (
    <div className="settings-token">
      <span>{label}</span>
      <code>{hidden ? "•".repeat(24) : value}</code>
      <div>
        {secret && value.length > 12 && (
          <button
            className="text-button"
            onClick={() => setRevealed((current) => !current)}
          >
            {revealed ? "Ocultar" : "Mostrar"}
          </button>
        )}
        <button className="icon-button" onClick={onCopy} aria-label={`Copiar ${label}`}>
          <Copy size={15} />
        </button>
      </div>
      {copied && <em>Copiado</em>}
    </div>
  );
}
