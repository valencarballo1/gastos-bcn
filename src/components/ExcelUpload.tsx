"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { Button, Card, Table, Row, Col, Spinner } from "react-bootstrap"
import * as XLSX from "xlsx"
import Swal from "sweetalert2"
import { SaldoService } from "@/services/saldoService"
import { GastosService } from "@/services/gastosService"
import type { GastoFormData } from "@/types"

interface ParsedRow {
  fechaOperacion: Date | null
  concepto: string
  importe: number // negativo para cargos
}

interface ExcelUploadProps {
  onImported?: () => void
}

export const ExcelUpload: React.FC<ExcelUploadProps> = ({ onImported }) => {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [finalSaldo, setFinalSaldo] = useState<number | null>(null)
  const [isSavingSaldo, setIsSavingSaldo] = useState(false)
  const [isSavingGastos, setIsSavingGastos] = useState(false)
  const [isProcessingFile, setIsProcessingFile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveGastosMessage, setSaveGastosMessage] = useState<string | null>(null)

  const [selectedPersona] = useState<"Ana" | "Valen">("Valen")
  const [categoriaId, setCategoriaId] = useState<string>("")

  const formatEuro = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" })

  const parseNumberEs = (value: unknown): number => {
    if (typeof value === "number") return value < 0 ? value : 0
    if (typeof value !== "string") return 0

    const hasNegativeSign = value.includes("-") || value.includes("−")
    if (!hasNegativeSign) return 0 // ❌ No es negativo → ignoramos

    const cleaned = value
      .replace(/\s/g, "")
      .replace(/EUR/gi, "")
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/−/g, "-") // reemplaza signo menos especial

    const parsed = Number.parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  const parseDate = (value: unknown): Date | null => {
    if (value instanceof Date) return value
    if (typeof value === "number") {
      const date = XLSX.SSF.parse_date_code(value)
      if (!date) return null
      return new Date(Date.UTC(date.y, (date.m || 1) - 1, date.d || 1))
    }
    if (typeof value === "string") {
      const [d, m, y] = value.split(/[/-]/).map((x) => Number.parseInt(x, 10))
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d)
    }
    return null
  }

  const handleFile = async (file: File) => {
    if (!file) {
      await Swal.fire({
        icon: "warning",
        title: "Archivo no válido",
        text: "Por favor selecciona un archivo Excel válido.",
        confirmButtonText: "Entendido",
      })
      return
    }

    setIsProcessingFile(true)
    setError(null)
    try {
      console.log("[v0] Processing file:", file.name, "Size:", file.size)
      const data = await file.arrayBuffer()
      console.log("[v0] File buffer loaded, size:", data.byteLength)

      const workbook = XLSX.read(data)
      const firstSheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[firstSheetName]
      console.log("[v0] Workbook loaded, first sheet:", firstSheetName)

      const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null })
      console.log("[v0] Sheet converted to array, rows:", aoa.length)

      console.log("[v0] First 10 rows of data:")
      for (let i = 0; i < Math.min(10, aoa.length); i++) {
        console.log(`[v0] Row ${i}:`, aoa[i])
      }

      let headerSaldo: number | null = null
      if (aoa.length > 3 && aoa[3] && aoa[3][5]) {
        const saldoCell = aoa[3][5] as unknown
        if (typeof saldoCell === "string" && saldoCell.includes("EUR")) {
          headerSaldo = parseNumberEs(saldoCell)
        }
      }
      console.log("[v0] Header saldo found:", headerSaldo)

      const normalize = (v: unknown): string => {
        if (typeof v !== "string") return ""
        return v
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
      }

      let headerRowIdx = 7
      let headers: string[] = (aoa[headerRowIdx] || []).map((v) => (typeof v === "string" ? v : "")) as string[]
      let idxFechaOp = 0 // Columna A
      let idxConcepto = 2 // Columna C
      let idxImporte = 3 // Columna D

      console.log("[v0] Initial header row index:", headerRowIdx)
      console.log("[v0] Initial headers:", headers)
      console.log(
        "[v0] Initial column indices - FechaOp:",
        idxFechaOp,
        "Concepto:",
        idxConcepto,
        "Importe:",
        idxImporte,
      )

      const autodetectIfNeeded = () => {
        let found = -1
        let hdrs: string[] = []
        for (let i = 0; i < Math.min(aoa.length, 50); i++) {
          const row = aoa[i]
          const norm = row.map(normalize)
          console.log(`[v0] Checking row ${i} for headers:`, norm)
          const hasFecha = norm.some((c) => c.includes("fecha operacion") || c.includes("fecha valor") || c === "fecha")
          const hasConcepto = norm.some(
            (c) => c.includes("concepto") || c.includes("descripcion") || c.includes("detalle"),
          )
          const hasImporte = norm.some((c) => c.includes("importe") || c.includes("cargo"))
          console.log(`[v0] Row ${i} - hasFecha:`, hasFecha, "hasConcepto:", hasConcepto, "hasImporte:", hasImporte)
          if (hasFecha && hasConcepto && hasImporte) {
            found = i
            hdrs = row.map((v) => (typeof v === "string" ? v : "")) as string[]
            console.log(`[v0] Found header row at index ${i}:`, hdrs)
            break
          }
        }
        if (found !== -1) {
          headerRowIdx = found
          headers = hdrs
          const normHeaders = headers.map(normalize)
          console.log("[v0] Normalized headers:", normHeaders)
          const findCol = (...candidates: string[]): number =>
            normHeaders.findIndex((h) => candidates.some((c) => h.includes(c)))
          idxFechaOp = findCol("fecha operacion", "fecha")
          idxConcepto = findCol("concepto", "descripcion", "detalle")
          idxImporte = findCol("importe", "cargo")
          console.log(
            "[v0] Updated column indices - FechaOp:",
            idxFechaOp,
            "Concepto:",
            idxConcepto,
            "Importe:",
            idxImporte,
          )
        }
      }

      autodetectIfNeeded()

      const dataStart = headerRowIdx + 1
      console.log("[v0] Data starts at row:", dataStart)
      const mapped: ParsedRow[] = []
      for (let r = dataStart; r < aoa.length; r++) {
        const row = aoa[r]
        if (!row || row.every((v) => v == null || String(v).trim() === "")) continue

        const fechaOperacion = parseDate(idxFechaOp >= 0 ? (row[idxFechaOp] as unknown) : null)
        const conceptoCell = idxConcepto >= 0 ? (row[idxConcepto] as unknown) : ""
        const importeCell = idxImporte >= 0 ? (row[idxImporte] as unknown) : 0
        const importe = parseNumberEs(importeCell)

        console.log(`[v0] Processing row ${r}:`, {
          fechaOperacion,
          concepto: String(conceptoCell || ""),
          importe: Number(importe || 0),
          rawImporte: importeCell,
        })

        if (!conceptoCell && (!importe || importe === 0)) {
          console.log(`[v0] Skipping row ${r} - no concept and no amount`)
          continue
        }

        const importePositivo = Math.abs(Number(importe || 0))

        mapped.push({
          fechaOperacion,
          concepto: String(conceptoCell || ""),
          importe: importePositivo,
        })
      }

      console.log("[v0] Mapped movements before filtering:", mapped.length)
      console.log("[v0] All mapped movements:", mapped)

      const movimientos = mapped
      console.log("[v0] Final movements count:", movimientos.length)

      setRows(movimientos)
      setFinalSaldo(headerSaldo)

      if (movimientos.length === 0) {
        const showHeaders = headers.length ? headers.join(", ") : "—"
        const errorMsg = `No se detectaron movimientos. Revisa los nombres de columnas (ej.: Fecha operación, Concepto/Descripción, Importe). Encabezados detectados: ${showHeaders}`
        await Swal.fire({
          icon: "warning",
          title: "Sin movimientos detectados",
          text: errorMsg,
          confirmButtonText: "Entendido",
        })
      } else {
        setError(null)
        await Swal.fire({
          icon: "success",
          title: "¡Archivo procesado!",
          text: `Se encontraron ${movimientos.length} movimientos`,
          timer: 2000,
          showConfirmButton: false,
        })
      }
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Error al procesar archivo",
        text: "No se pudo leer el archivo. Asegúrate de seleccionar el Excel correcto.",
        confirmButtonText: "Entendido",
      })
      console.error(e)
    } finally {
      setIsProcessingFile(false)
    }
  }

  const handleSaveSaldo = async () => {
    if (finalSaldo == null) {
      await Swal.fire({
        icon: "warning",
        title: "Saldo no disponible",
        text: "No se pudo determinar el saldo final del Excel.",
        confirmButtonText: "Entendido",
      })
      return
    }
    setIsSavingSaldo(true)
    setError(null)
    try {
      const saldoService = SaldoService.getInstance()
      await saldoService.saveSaldo({ valor: finalSaldo, fecha: new Date() })
      await Swal.fire({
        icon: "success",
        title: "¡Saldo guardado!",
        text: "El saldo se guardó correctamente.",
        timer: 2000,
        showConfirmButton: false,
      })
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Error al guardar saldo",
        text: "No se pudo guardar el saldo en la API. Revisa la configuración del endpoint.",
        confirmButtonText: "Entendido",
      })
    } finally {
      setIsSavingSaldo(false)
    }
  }

  const totalsByConcepto = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const r of rows) {
      const key = r.concepto || ""
      const importe = Number(r.importe || 0)
      totals[key] = (totals[key] ?? 0) + importe
    }
    return totals
  }, [rows])

  const totalImporte = useMemo(() => rows.reduce((acc, r) => acc + (r.importe || 0), 0), [rows])

  const handleSaveGastos = async () => {
    setError(null)
    setSaveGastosMessage(null)
    if (!categoriaId) {
      await Swal.fire({
        icon: "warning",
        title: "Categoría requerida",
        text: "Debes indicar un categoriaId para los gastos.",
        confirmButtonText: "Entendido",
      })
      return
    }
    const gastosService = GastosService.getInstance()
    setIsSavingGastos(true)
    let created = 0
    try {
      const toCreate: GastoFormData[] = rows
        .filter((r) => typeof r.importe === "number" && r.importe < 0)
        .map((r) => ({
          monto: Math.abs(r.importe),
          descripcion: r.concepto,
          categoriaId,
          persona: selectedPersona,
        }))
      const createdList = await gastosService.addGastosBulk(toCreate)
      created = createdList.length

      await Swal.fire({
        icon: "success",
        title: "¡Gastos guardados!",
        text: `Se guardaron ${created} gastos correctamente.`,
        confirmButtonText: "Perfecto",
      })

      if (created > 0) {
        onImported?.()
      }
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Error al guardar gastos",
        text: "Ocurrió un error guardando los gastos. Intenta nuevamente.",
        confirmButtonText: "Entendido",
      })
    } finally {
      setIsSavingGastos(false)
    }
  }

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <span>Importar movimientos desde Excel</span>
          <div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  console.log("[v0] File selected:", file.name)
                  handleFile(file)
                } else {
                  console.log("[v0] No file selected")
                }
              }}
              style={{ display: "none" }}
              id="excel-input"
              disabled={isProcessingFile}
            />
            <label
              htmlFor="excel-input"
              className={`btn btn-outline-primary mb-0 me-2 ${isProcessingFile ? "disabled" : ""}`}
            >
              {isProcessingFile ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Procesando...
                </>
              ) : (
                "Seleccionar Excel"
              )}
            </label>
            <Button
              variant="primary"
              disabled={rows.length === 0 || isSavingGastos || isProcessingFile}
              onClick={handleSaveGastos}
            >
              {isSavingGastos ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Guardando...
                </>
              ) : (
                "Guardar gastos"
              )}
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        <Row className="mb-3">
          <Col md={6}>
            <strong>Saldo final detectado:</strong> {finalSaldo != null ? `${finalSaldo.toFixed(2)} €` : "—"}
          </Col>
          <Col md={6} className="text-md-end">
            <small className="text-muted">Columnas esperadas: Fecha operación, Concepto, Importe</small>
          </Col>
        </Row>

        {isProcessingFile && (
          <div className="text-center py-4">
            <Spinner animation="border" role="status" className="me-2" />
            <span>Procesando archivo Excel...</span>
          </div>
        )}

        {rows.length > 0 && (
          <Card className="mb-3 bg-light">
            <Card.Body>
              <Row className="text-center">
                <Col md={4}>
                  <h5 className="text-primary mb-1">{rows.length}</h5>
                  <small className="text-muted">Total de Movimientos</small>
                </Col>
                <Col md={4}>
                  <h5 className={`mb-1 ${totalImporte >= 0 ? "text-success" : "text-danger"}`}>
                    {formatEuro(totalImporte)}
                  </h5>
                  <small className="text-muted">Importe Total</small>
                </Col>
                <Col md={4}>
                  <h5 className="text-info mb-1">{finalSaldo != null ? formatEuro(finalSaldo) : "—"}</h5>
                  <small className="text-muted">Saldo Actual</small>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        {rows.length > 0 && (
          <Row className="mb-3 align-items-end">
            <Col md={6} className="mb-2">
              <label className="form-label mb-1" htmlFor="categoriaId">
                Categoria ID
              </label>
              <input
                id="categoriaId"
                className="form-control"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                placeholder="p.ej. 123"
              />
            </Col>
          </Row>
        )}

        {rows.length > 0 && (
          <div className="mb-3" style={{ maxHeight: 400, overflow: "auto" }}>
            <h6>Detalle de movimientos:</h6>
            <Table bordered size="sm" striped>
              <thead>
                <tr>
                  <th>Fecha Operación</th>
                  <th>Concepto</th>
                  <th className="text-end">Importe (€)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>{row.fechaOperacion?.toLocaleDateString("es-ES") || "—"}</td>
                    <td>{row.concepto}</td>
                    <td className="text-end" style={{ color: row.importe < 0 ? "red" : "green" }}>
                      {row.importe.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

export default ExcelUpload
