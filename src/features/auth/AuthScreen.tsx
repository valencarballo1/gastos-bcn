"use client";

import {
  CheckSquare2,
  Home,
  ReceiptText,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";

export function AuthScreen({
  loading = false,
  onGoogleSignIn,
  error,
  onRetry,
}: {
  loading?: boolean;
  onGoogleSignIn?: () => void;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <main className="auth-screen">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <span>
            <Sparkles size={20} />
          </span>
          <strong>Casa Clara</strong>
        </div>
        <div className="auth-copy">
          <span className="eyebrow">Tu hogar, en orden</span>
          <h1>La vida en casa se organiza mejor en equipo.</h1>
          <p>
            Gastos, compras y tareas compartidas en un lugar simple para todos.
          </p>
        </div>
        <div className="auth-feature-grid">
          <span>
            <ReceiptText size={18} /> Cuentas claras
          </span>
          <span>
            <ShoppingBasket size={18} /> Lista conjunta
          </span>
          <span>
            <CheckSquare2 size={18} /> Tareas repartidas
          </span>
        </div>
      </section>
      <section className="auth-card-wrap">
        <div className="auth-card">
          <span className="auth-home-icon">
            <Home size={24} />
          </span>
          <span className="eyebrow">Bienvenido</span>
          <h2>Entrá a tu hogar</h2>
          <p>
            Usá tu cuenta de Google para acceder a tus casas e invitaciones.
          </p>
          {loading ? (
            <div className="auth-loading">
              <i />
              <span>Comprobando tu sesión…</span>
            </div>
          ) : (
            <>
              {error && <p className="form-error" role="alert">{error}</p>}
              {error && onRetry ? (
                <button className="google-login-button" onClick={onRetry}>
                  Reintentar conexión
                </button>
              ) : (
                <button
                  className="google-login-button"
                  onClick={onGoogleSignIn}
                  aria-label="Continuar con Google"
                >
                  <span>G</span>
                  Continuar con Google
                </button>
              )}
            </>
          )}
          <small>
            Al continuar aceptás acceder únicamente a los hogares donde sos integrante.
          </small>
        </div>
      </section>
    </main>
  );
}
