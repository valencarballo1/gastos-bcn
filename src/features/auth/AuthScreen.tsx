"use client";

import {
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import {
  CheckSquare2,
  Home,
  LoaderCircle,
  ReceiptText,
  ShoppingBasket,
  Sparkles,
} from "lucide-react";
import { ApiError, errorMessage } from "@/services/api";

type AuthMode = "login" | "register";

export type PasswordAuthSubmission = {
  mode: AuthMode;
  fullName: string;
  email: string;
  password: string;
};

type FieldName = "fullName" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

export function AuthScreen({
  loading = false,
  onGoogleSignIn,
  onPasswordAuth,
  error,
  onRetry,
}: {
  loading?: boolean;
  onGoogleSignIn?: () => void;
  onPasswordAuth?: (submission: PasswordAuthSubmission) => Promise<void>;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const fieldRefs = {
    fullName: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  const selectMode = (nextMode: AuthMode) => {
    if (pending) return;
    setMode(nextMode);
    setFieldErrors({});
    setFormError("");
  };

  const focusFirstError = (errors: FieldErrors) => {
    const order: FieldName[] = mode === "register"
      ? ["fullName", "email", "password"]
      : ["email", "password"];
    const first = order.find((field) => errors[field]);
    if (first) window.setTimeout(() => fieldRefs[first].current?.focus(), 0);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || !onPasswordAuth) return;

    const validation = validate(mode, { fullName, email, password });
    setFieldErrors(validation);
    setFormError("");
    if (Object.keys(validation).length) {
      focusFirstError(validation);
      return;
    }

    setPending(true);
    try {
      await onPasswordAuth({
        mode,
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      setPassword("");
    } catch (reason) {
      const mapped = apiFieldErrors(reason, mode);
      setFieldErrors(mapped);
      if (Object.keys(mapped).length) focusFirstError(mapped);
      else setFormError(authErrorMessage(reason, mode));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-brand-panel">
        <div className="auth-brand"><span><Sparkles size={20} /></span><strong>Casa Clara</strong></div>
        <div className="auth-copy">
          <span className="eyebrow">Tu hogar, en orden</span>
          <h1>La vida en casa se organiza mejor en equipo.</h1>
          <p>Gastos, compras y tareas compartidas en un lugar simple para todos.</p>
        </div>
        <div className="auth-feature-grid">
          <span><ReceiptText size={18} /> Cuentas claras</span>
          <span><ShoppingBasket size={18} /> Lista conjunta</span>
          <span><CheckSquare2 size={18} /> Tareas repartidas</span>
        </div>
      </section>
      <section className="auth-card-wrap">
        <div className="auth-card">
          <span className="auth-home-icon"><Home size={24} /></span>
          <span className="eyebrow">Bienvenido</span>
          <h2>{mode === "register" ? "Creá tu cuenta" : "Entrá a tu hogar"}</h2>
          <p>{mode === "register" ? "Empezá a organizar tu casa en equipo." : "Accedé a tus hogares e invitaciones."}</p>
          {loading ? (
            <div className="auth-loading"><i /><span>Comprobando tu sesión…</span></div>
          ) : error ? (
            <>
              <p className="form-error" role="alert">{error}</p>
              {onRetry && <button className="google-login-button" onClick={onRetry}>Reintentar conexión</button>}
            </>
          ) : (
            <>
              <div className="auth-tabs" role="tablist" aria-label="Acceso a Casa Clara">
                <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => selectMode("login")}>Iniciar sesión</button>
                <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => selectMode("register")}>Crear cuenta</button>
              </div>
              <form className="auth-form" noValidate onSubmit={(event) => void submit(event)}>
                {mode === "register" && (
                  <AuthField label="Nombre completo" name="fullName" value={fullName} error={fieldErrors.fullName} inputRef={fieldRefs.fullName} autoComplete="name" onChange={setFullName} />
                )}
                <AuthField label="Correo electrónico" name="email" type="email" value={email} error={fieldErrors.email} inputRef={fieldRefs.email} autoComplete="email" onChange={setEmail} />
                <AuthField label="Contraseña" name="password" type="password" value={password} error={fieldErrors.password} inputRef={fieldRefs.password} autoComplete={mode === "register" ? "new-password" : "current-password"} hint={mode === "register" ? "Entre 8 y 128 caracteres" : undefined} onChange={setPassword} />
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="button button-primary auth-submit" type="submit" disabled={pending}>
                  {pending && <LoaderCircle className="spin" size={17} />}
                  {pending ? "Enviando…" : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
                </button>
              </form>
              <div className="auth-divider"><span>o</span></div>
              <button className="google-login-button" onClick={onGoogleSignIn} aria-label="Continuar con Google"><span>G</span>Continuar con Google</button>
            </>
          )}
          <small>Al continuar aceptás acceder únicamente a los hogares donde sos integrante.</small>
        </div>
      </section>
    </main>
  );
}

function AuthField({ label, name, type = "text", value, error, inputRef, autoComplete, hint, onChange }: {
  label: string; name: FieldName; type?: string; value: string; error?: string;
  inputRef: RefObject<HTMLInputElement | null>; autoComplete: string; hint?: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${name}-error`;
  return (
    <div className="field auth-field">
      <label htmlFor={name}>{label}</label>
      <input id={name} ref={inputRef} name={name} type={type} value={value} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} />
      {hint && !error && <small>{hint}</small>}
      {error && <small id={errorId} className="field-error">{error}</small>}
    </div>
  );
}

function validate(mode: AuthMode, values: Omit<PasswordAuthSubmission, "mode">): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "register" && !values.fullName.trim()) errors.fullName = "Ingresá tu nombre completo.";
  if (!values.email.trim()) errors.email = "Ingresá tu correo electrónico.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Ingresá un correo electrónico válido.";
  if (!values.password) errors.password = "Ingresá tu contraseña.";
  else if (values.password.length < 8 || values.password.length > 128) errors.password = "La contraseña debe tener entre 8 y 128 caracteres.";
  return errors;
}

function apiFieldErrors(reason: unknown, mode: AuthMode): FieldErrors {
  if (!(reason instanceof ApiError)) return {};
  const errors: FieldErrors = {};
  for (const [rawField, messages] of Object.entries(reason.fieldErrors)) {
    const field = rawField[0]?.toLowerCase() + rawField.slice(1) as FieldName;
    if (field in { fullName: 1, email: 1, password: 1 }) errors[field] = messages[0];
  }
  if (reason.code === "EMAIL_INVALID") errors.email = reason.message || "Ingresá un correo electrónico válido.";
  if (reason.code === "PASSWORD_INVALID") errors.password = reason.message || "La contraseña no cumple los requisitos.";
  if (reason.code === "EMAIL_ALREADY_REGISTERED" && mode === "register") errors.email = "Ya hay una cuenta registrada con este correo.";
  return errors;
}

function authErrorMessage(reason: unknown, mode: AuthMode) {
  if (reason instanceof ApiError && (reason.code === "INVALID_CREDENTIALS" || (mode === "login" && reason.status === 401))) {
    return "El correo o la contraseña no son correctos.";
  }
  return errorMessage(reason);
}
