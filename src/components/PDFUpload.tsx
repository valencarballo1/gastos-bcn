"use client"

import type React from "react"
import { useState } from "react"
import { GastosService } from "@/services/gastosService"
import type { GastoFormData, ParsedProduct, MercadonaTicket } from "@/types"

interface PDFUploadProps {
  onImported?: () => void
}

export const PDFUpload: React.FC<PDFUploadProps> = ({ onImported }) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [ticket, setTicket] = useState<MercadonaTicket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [categoriaId, setCategoriaId] = useState<string>("")

  const [selectedPersona] = useState<"Ana" | "Valen">("Valen")

  const parseMercadonaPDF = async (text: string): Promise<MercadonaTicket> => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    // Extract date
    let fecha = new Date()
    const datePattern = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/
    for (const line of lines) {
      const dateMatch = line.match(datePattern)
      if (dateMatch) {
        const [, day, month, year, hour, minute] = dateMatch
        fecha = new Date(
          Number.parseInt(year),
          Number.parseInt(month) - 1,
          Number.parseInt(day),
          Number.parseInt(hour),
          Number.parseInt(minute),
        )
        break
      }
    }

    // Extract products
    const productos: ParsedProduct[] = []
    let total = 0

    // Look for total first
    const totalPattern = /TOTAL\s*$$€$$\s*(\d+[,.]?\d*)/
    for (const line of lines) {
      const totalMatch = line.match(totalPattern)
      if (totalMatch) {
        total = Number.parseFloat(totalMatch[1].replace(",", "."))
        break
      }
    }

    // Parse products - looking for lines with quantity, description and price
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Pattern for simple products: "1PRODUCT NAME3,39"
      const simplePattern = /^(\d+)([A-ZÁÉÍÓÚÑ\s]+?)(\d+[,.]?\d*)$/
      const simpleMatch = line.match(simplePattern)

      if (simpleMatch) {
        const [, cantidadStr, descripcion, precioStr] = simpleMatch
        const cantidad = Number.parseInt(cantidadStr)
        const precio = Number.parseFloat(precioStr.replace(",", "."))

        productos.push({
          descripcion: descripcion.trim(),
          cantidad,
          precioUnitario: precio,
          importe: precio * cantidad,
        })
        continue
      }

      // Pattern for weighted products: "1PRODUCT\n0,498 kg2,90 €/kg1,44"
      const weightPattern = /^(\d+)([A-ZÁÉÍÓÚÑ\s]+)$/
      const weightMatch = line.match(weightPattern)

      if (weightMatch && i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const weightDetailPattern = /(\d+[,.]?\d*)\s*kg\s*(\d+[,.]?\d*)\s*€\/kg\s*(\d+[,.]?\d*)/
        const weightDetailMatch = nextLine.match(weightDetailPattern)

        if (weightDetailMatch) {
          const [, pesoStr, precioKgStr, importeStr] = weightDetailMatch
          const [, cantidadStr, descripcion] = weightMatch

          const cantidad = Number.parseInt(cantidadStr)
          const peso = Number.parseFloat(pesoStr.replace(",", "."))
          const precioKg = Number.parseFloat(precioKgStr.replace(",", "."))
          const importe = Number.parseFloat(importeStr.replace(",", "."))

          productos.push({
            descripcion: `${descripcion.trim()} (${peso}kg)`,
            cantidad,
            precioUnitario: precioKg,
            importe,
          })
          i++ // Skip next line as we've processed it
          continue
        }
      }

      // Pattern for products with quantity and unit price: "2RUCA 50 G0,831,66"
      const quantityPattern = /^(\d+)([A-ZÁÉÍÓÚÑ\s\d]+?)(\d+[,.]?\d*)(\d+[,.]?\d*)$/
      const quantityMatch = line.match(quantityPattern)

      if (quantityMatch) {
        const [, cantidadStr, descripcion, precioUnitStr, importeStr] = quantityMatch
        const cantidad = Number.parseInt(cantidadStr)
        const precioUnit = Number.parseFloat(precioUnitStr.replace(",", "."))
        const importe = Number.parseFloat(importeStr.replace(",", "."))

        productos.push({
          descripcion: descripcion.trim(),
          cantidad,
          precioUnitario: precioUnit,
          importe,
        })
      }
    }

    return {
      fecha,
      productos,
      total,
      tienda: "MERCADONA",
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      setError("Por favor selecciona un archivo PDF válido")
      return
    }

    setIsProcessing(true)
    setError(null)
    setSuccess(null)

    try {
      // For demo purposes, we'll simulate PDF text extraction
      // In a real implementation, you'd use a library like pdf-parse or PDF.js
      const mockPDFText = `MERCADONA, S.A.   A-46103834
C/ SANT JORDI, 6
08028 Barcelona
TELÈFON:936245001
16/09/2025 10:12  OP: 3641231
FACTURA SIMPLIFICADA: 4240-020-059072
DescripcióP. UnitImport
1TALL PIT FI3,39
1BURGER POLLASTRE3,95
1BURGER VACUM5,90
1FILET PIT4,08
1NYOQUIS DE PATATA1,10
1MADUIXA3,33
1PIMIENTO TRICO2,00
1LLACETS VEGETALS1,05
1NABIUS2,15
16 OUS PAGÈS1,90
1FARIGOLA1,05
1ROTLLE LLAR DOBLE2,30
1FORMATGE RATLLAT POL1,35
2RUCA 50 G0,831,66
1CARABASSA PART.1,45
1CARABASSA PART.1,33
1PASTANAGA 500 G0,80
1LLET DESNATADA1,09
1PINYA PELADA NATURAL3,55
1MATÓ1,00
1CIREROL 500 G2,00
1BRÒQUIL
0,498 kg2,90 €/kg1,44
1LLIMONA
0,348 kg3,15 €/kg1,10
1NECTARINA
0,348 kg2,60 €/kg0,90
TOTAL (€)49,87`

      const parsedTicket = await parseMercadonaPDF(mockPDFText)
      setTicket(parsedTicket)
      setSuccess(
        `¡PDF procesado! Se encontraron ${parsedTicket.productos.length} productos por un total de ${parsedTicket.total.toFixed(2)}€`,
      )
    } catch (e) {
      setError("Error al procesar el PDF. Asegúrate de que sea un ticket válido de Mercadona.")
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveGastos = async () => {
    if (!ticket || !categoriaId) {
      setError("Debes seleccionar una categoría antes de guardar")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const gastosService = GastosService.getInstance()

      const gastosToCreate: GastoFormData[] = []

      ticket.productos.forEach((producto) => {
        if (producto.cantidad > 1) {
          // Calculate unit price by dividing total amount by quantity
          const precioUnitario = producto.importe / producto.cantidad

          // Create individual entries for each unit
          for (let i = 0; i < producto.cantidad; i++) {
            gastosToCreate.push({
              monto: precioUnitario,
              descripcion: `${producto.descripcion} (unidad ${i + 1} de ${producto.cantidad})`,
              categoriaId,
              persona: selectedPersona,
            })
          }
        } else {
          // Single product, create one entry
          gastosToCreate.push({
            monto: producto.importe,
            descripcion: producto.descripcion,
            categoriaId,
            persona: selectedPersona,
          })
        }
      })

      await gastosService.addGastosBulk(gastosToCreate)

      setSuccess(`¡Gastos guardados! Se crearon ${gastosToCreate.length} gastos individuales correctamente.`)
      onImported?.()

      // Clear the ticket after successful save
      setTimeout(() => {
        setTicket(null)
        setSuccess(null)
      }, 3000)
    } catch (e) {
      setError("Error al guardar los gastos. Intenta nuevamente.")
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-12">
        <div className="card">
          <div className="card-header" style={{ backgroundColor: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
            <h5 className="card-title mb-0" style={{ color: "#212529", fontWeight: "bold" }}>
              <i className="fas fa-file-pdf me-2"></i>
              Importar Ticket de Mercadona (PDF)
            </h5>
          </div>
          <div className="card-body">
            {/* File Upload */}
            <div className="mb-4">
              <label htmlFor="pdf-upload" className="form-label fw-bold">
                Seleccionar PDF del ticket
              </label>
              <div className="row g-2">
                <div className="col">
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                    }}
                    disabled={isProcessing}
                    className="form-control"
                  />
                </div>
                <div className="col-auto">
                  <button type="button" className="btn btn-outline-primary" disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-upload me-2"></i>
                        Subir PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="alert alert-info">
              <strong>Usuario predeterminado:</strong> {selectedPersona}
            </div>

            {/* Error Alert */}
            {error && (
              <div className="alert alert-danger" role="alert">
                <i className="fas fa-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {/* Success Alert */}
            {success && (
              <div className="alert alert-success" role="alert">
                <i className="fas fa-check-circle me-2"></i>
                {success}
              </div>
            )}

            {/* Ticket Summary */}
            {ticket && (
              <div className="card mt-4">
                <div className="card-header">
                  <h6 className="card-title mb-0">
                    <i className="fas fa-shopping-cart me-2"></i>
                    Resumen del Ticket
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row mb-3">
                    <div className="col-6">
                      <strong>Tienda:</strong> {ticket.tienda}
                    </div>
                    <div className="col-6">
                      <strong>Fecha:</strong> {ticket.fecha.toLocaleDateString("es-ES")}
                    </div>
                    <div className="col-6">
                      <strong>Productos:</strong> {ticket.productos.length}
                    </div>
                    <div className="col-6">
                      <strong>Total:</strong> {ticket.total.toFixed(2)}€
                    </div>
                  </div>

                  {/* Category Selection */}
                  <div className="mb-3">
                    <label htmlFor="categoria" className="form-label fw-bold">
                      Categoría para todos los productos
                    </label>
                    <input
                      id="categoria"
                      type="text"
                      className="form-control"
                      value={categoriaId}
                      onChange={(e) => setCategoriaId(e.target.value)}
                      placeholder="ID de la categoría (ej: 123)"
                    />
                  </div>

                  {/* Products List */}
                  <div className="mb-3">
                    <h6 className="fw-bold">Productos detectados:</h6>
                    <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                      {ticket.productos.map((producto, index) => (
                        <div
                          key={index}
                          className="d-flex justify-content-between align-items-center p-2 mb-1 bg-light rounded"
                        >
                          <div>
                            <span>{producto.descripcion}</span>
                            {producto.cantidad > 1 && (
                              <div className="small text-muted">
                                {producto.cantidad} unidades × {(producto.importe / producto.cantidad).toFixed(2)}€ cada
                                una
                              </div>
                            )}
                          </div>
                          <span className="fw-bold">{producto.importe.toFixed(2)}€</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="alert alert-info mb-3">
                    <strong>Se crearán:</strong> {ticket.productos.reduce((total, p) => total + p.cantidad, 0)} gastos
                    individuales
                  </div>

                  {/* Save Button */}
                  <button
                    type="button"
                    onClick={handleSaveGastos}
                    disabled={isSaving || !categoriaId}
                    className="btn btn-primary w-100"
                  >
                    {isSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Guardando gastos...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-shopping-cart me-2"></i>
                        Guardar {ticket.productos.reduce((total, p) => total + p.cantidad, 0)} gastos individuales
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
