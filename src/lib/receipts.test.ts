import { describe, expect, it } from "vitest";
import { normalizeBody, parseReceiptEmail } from "./receipts";

const mercadona = `
MERCADONA S.A.
C/ EXAMPLE 12, BARCELONA
FACTURA SIMPLIFICADA: 4321-002-123456

08/09/2026 19:42 OP: 1234567

Descripción                P. Unit  Importe
2 LECHE ENTERA 1L             1,20     2,40
1 PAN DE PUEBLO                        0,90
3 YOGUR NATURAL               0,45     1,35
1 ACEITE OLIVA VIRGEN                  8,95
PLATANO
0,596 kg x 2,19 €/kg                   1,31

TOTAL (€)                             14,91
TARJETA BANCARIA                      14,91
IVA        BASE IMPONIBLE   CUOTA
4%                  12,50    0,50
`;

describe("parseReceiptEmail · supermercado", () => {
  const receipt = parseReceiptEmail({
    from: "Mercadona <ticket@mercadona.es>",
    subject: "Tu ticket de compra",
    body: mercadona,
    receivedAt: "2026-09-08T20:00:00.000Z",
  });

  it("reconoce el comercio y su categoría", () => {
    expect(receipt.merchant).toBe("Mercadona");
    expect(receipt.categoryHint).toBe("supermercado");
  });

  it("toma el total del ticket, no el primer importe que aparece", () => {
    expect(receipt.total).toBe(14.91);
    expect(receipt.currency).toBe("EUR");
  });

  it("usa la fecha del ticket y no la de recepción", () => {
    expect(receipt.date.slice(0, 10)).toBe("2026-09-08");
  });

  it("saca la lista de productos con cantidad e importe", () => {
    expect(receipt.lines).toEqual([
      { name: "LECHE ENTERA 1L", quantity: 2, unitPrice: 1.2, amount: 2.4 },
      { name: "PAN DE PUEBLO", quantity: 1, unitPrice: undefined, amount: 0.9 },
      { name: "YOGUR NATURAL", quantity: 3, unitPrice: 0.45, amount: 1.35 },
      {
        name: "ACEITE OLIVA VIRGEN",
        quantity: 1,
        unitPrice: undefined,
        amount: 8.95,
      },
      { name: "PLATANO", quantity: 0.596, unitPrice: 2.19, amount: 1.31 },
    ]);
  });

  it("no confunde impuestos ni formas de pago con productos", () => {
    const names = receipt.lines.map((line) => line.name);
    expect(names).not.toContain("TARJETA BANCARIA");
    expect(names.some((name) => /BASE IMPONIBLE/i.test(name))).toBe(false);
  });

  it("cuadra los productos con el total y no avisa de nada", () => {
    expect(receipt.confidence).toBe("high");
    expect(receipt.warnings).toEqual([]);
  });
});

describe("parseReceiptEmail · suscripciones", () => {
  it("lee una factura de Claude sin lista de productos", () => {
    const receipt = parseReceiptEmail({
      from: "Anthropic <invoice+statements@mail.anthropic.com>",
      subject: "Your receipt from Anthropic",
      body: [
        "Receipt from Anthropic, PBC",
        "Invoice number 4A2B-0001",
        "Date paid 2026-09-01",
        "Claude Pro subscription",
        "Subtotal €18,00",
        "IVA (21%) €3,78",
        "Total charged €21,78",
      ].join("\n"),
      receivedAt: "2026-09-01T09:12:00.000Z",
    });

    expect(receipt.merchant).toBe("Claude");
    expect(receipt.categoryHint).toBe("suscripciones");
    expect(receipt.total).toBe(21.78);
    expect(receipt.date.slice(0, 10)).toBe("2026-09-01");
    expect(receipt.lines).toEqual([]);
    expect(receipt.confidence).toBe("high");
  });

  it("avisa cuando la factura no viene en euros", () => {
    const receipt = parseReceiptEmail({
      from: "Anthropic <invoice@mail.anthropic.com>",
      subject: "Your receipt from Anthropic",
      body: "Claude Pro\nTotal charged $20.00",
      receivedAt: "2026-09-01T09:12:00.000Z",
    });

    expect(receipt.total).toBe(20);
    expect(receipt.currency).toBe("USD");
    expect(receipt.confidence).toBe("low");
    expect(receipt.warnings[0]).toContain("USD");
  });

  it("entiende un recibo de la luz con fecha en castellano", () => {
    const receipt = parseReceiptEmail({
      from: "Endesa Clientes <no-reply@endesaclientes.com>",
      subject: "Tu factura de luz ya está disponible",
      body: [
        "Periodo: 1 de agosto de 2026 al 31 de agosto de 2026",
        "Consumo 245 kWh",
        "Importe total 112,08 €",
      ].join("\n"),
      receivedAt: "2026-09-03T07:00:00.000Z",
    });

    expect(receipt.merchant).toBe("Luz");
    expect(receipt.categoryHint).toBe("hogar");
    expect(receipt.total).toBe(112.08);
    expect(receipt.date.slice(0, 10)).toBe("2026-08-01");
  });
});

describe("parseReceiptEmail · correos difíciles", () => {
  it("lee un correo en HTML", () => {
    const receipt = parseReceiptEmail({
      from: "Lidl <tickets@lidl.es>",
      subject: "Tu ticket",
      body:
        "<table><tr><td>1 CAF&Eacute; MOLIDO</td><td>3,45</td></tr>" +
        "<tr><td>TOTAL</td><td>3,45&euro;</td></tr></table>",
      receivedAt: "2026-09-08T10:00:00.000Z",
    });

    expect(receipt.merchant).toBe("Lidl");
    expect(receipt.total).toBe(3.45);
  });

  it("no toma una fecha posterior al correo", () => {
    const receipt = parseReceiptEmail({
      from: "Naturgy <facturas@naturgy.es>",
      subject: "Tu factura",
      body: "Fecha de emisión 01/09/2026\nVence el 20/10/2026\nImporte total 48,30 €",
      receivedAt: "2026-09-02T08:00:00.000Z",
    });

    expect(receipt.date.slice(0, 10)).toBe("2026-09-01");
  });

  it("avisa en vez de inventar cuando no hay total", () => {
    const receipt = parseReceiptEmail({
      from: "Alguien <hola@ejemplo.com>",
      subject: "Sin importes",
      body: "Hola, esto no es un ticket.",
      receivedAt: "2026-09-08T10:00:00.000Z",
    });

    expect(receipt.total).toBeNull();
    expect(receipt.confidence).toBe("low");
    expect(receipt.merchant).toBe("Alguien");
    expect(receipt.date).toBe("2026-09-08T10:00:00.000Z");
  });

  it("avisa si los productos no suman el total", () => {
    const receipt = parseReceiptEmail({
      from: "Mercadona <ticket@mercadona.es>",
      subject: "Tu ticket",
      body: "1 PAN 0,90\n2 LECHE 1,20 2,40\nTOTAL 99,00",
      receivedAt: "2026-09-08T10:00:00.000Z",
    });

    expect(receipt.total).toBe(99);
    expect(receipt.warnings.join(" ")).toContain("puede faltar alguna línea");
  });
});

describe("normalizeBody", () => {
  it("convierte las filas de una tabla en líneas", () => {
    expect(normalizeBody("<tr><td>A</td><td>1,00</td></tr>")).toBe("A 1,00");
  });
});
