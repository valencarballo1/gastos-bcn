import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/api";
import { AuthScreen } from "./AuthScreen";

describe("AuthScreen", () => {
  it("muestra el estado de comprobación de sesión", () => {
    render(<AuthScreen loading />);
    expect(screen.getByText("Comprobando tu sesión…")).toBeInTheDocument();
  });

  it("inicia el flujo Google desde un botón de navegación", () => {
    const onGoogleSignIn = vi.fn();
    render(<AuthScreen onGoogleSignIn={onGoogleSignIn} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continuar con Google" }),
    );
    expect(onGoogleSignIn).toHaveBeenCalledOnce();
  });

  it("presenta un error recuperable de sesión", () => {
    const onRetry = vi.fn();
    render(
      <AuthScreen
        error="La API no responde."
        onRetry={onRetry}
        onGoogleSignIn={() => undefined}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "La API no responde.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reintentar conexión" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("valida el registro y devuelve el foco al primer campo inválido", async () => {
    const submit = vi.fn();
    render(<AuthScreen onPasswordAuth={submit} />);
    fireEvent.click(screen.getByRole("tab", { name: "Crear cuenta" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const name = screen.getByRole("textbox", { name: /^Nombre completo/ });
    await waitFor(() => expect(name).toHaveFocus());
    expect(screen.getAllByText(/Ingresá/)).toHaveLength(3);
    expect(submit).not.toHaveBeenCalled();
  });

  it("muestra credenciales inválidas sin revelar si existe el correo", async () => {
    const submit = vi.fn().mockRejectedValue(new ApiError({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "El correo no existe.",
    }));
    render(<AuthScreen onPasswordAuth={submit} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "maria@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "clave-segura-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El correo o la contraseña no son correctos.");
    expect(screen.queryByText("El correo no existe.")).not.toBeInTheDocument();
  });
});
