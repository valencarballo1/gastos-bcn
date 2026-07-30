import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
});
