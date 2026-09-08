"use client";

import {
  forwardRef,
  type ClipboardEvent,
  type FocusEvent,
  type InputHTMLAttributes,
} from "react";
import {
  formatAmountInput,
  parseAmount,
  sanitizeAmountInput,
} from "@/lib/money";

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
>;

interface AmountInputProps extends NativeProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Decimales admitidos. 2 para euros, 3 para cantidades tipo "0,5 kg". */
  decimals?: number;
  /** Al salir del campo deja el importe con los decimales completos. */
  formatOnBlur?: boolean;
  /** Selecciona el contenido al enfocar: cómodo cuando viene pre-cargado. */
  selectOnFocus?: boolean;
}

/**
 * Campo de importe pensado para escribir con el teclado del móvil.
 *
 * Usa `type="text"` + `inputMode="decimal"`: así el teclado numérico aparece
 * igual, pero —a diferencia de `type="number"`— la coma decimal española se
 * conserva en lugar de vaciar el campo. Lo que sale de aquí siempre se puede
 * leer con `parseAmount`.
 */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput(
    {
      value,
      onValueChange,
      decimals = 2,
      formatOnBlur = true,
      selectOnFocus = false,
      placeholder = "0,00",
      onBlur,
      onFocus,
      onPaste,
      ...rest
    },
    ref,
  ) {
    const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
      const pasted = event.clipboardData.getData("text");
      const parsed = parseAmount(pasted);
      if (parsed !== null) {
        event.preventDefault();
        onValueChange(formatAmountInput(Math.abs(parsed), decimals));
      }
      onPaste?.(event);
    };

    const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
      if (formatOnBlur) {
        const parsed = parseAmount(value);
        onValueChange(
          parsed === null ? "" : formatAmountInput(parsed, decimals),
        );
      }
      onBlur?.(event);
    };

    const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
      if (selectOnFocus) event.target.select();
      onFocus?.(event);
    };

    return (
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        placeholder={placeholder}
        value={value}
        onChange={(event) =>
          onValueChange(sanitizeAmountInput(event.target.value, decimals))
        }
        onPaste={handlePaste}
        onBlur={handleBlur}
        onFocus={handleFocus}
      />
    );
  },
);
