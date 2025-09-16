"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { GastoForm } from "./GastoForm"
import { PDFUpload } from "./PDFUpload"
import { GastosService } from "@/services/gastosService"
import type { Gasto } from "@/types"

export const Dashboard: React.FC = () => {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("pdf")

  const fetchGastos = async () => {
    try {
      const gastosService = GastosService.getInstance()
      const data = await gastosService.getGastos()
      setGastos(data)
    } catch (error) {
      console.error("Error al cargar gastos:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchGastos()
  }, [])

  const handleGastoAdded = () => {
    fetchGastos()
  }

  const totalGastos = gastos.reduce((sum, gasto) => sum + gasto.monto, 0)

  return (
    <div className="container py-4">
      <div className="text-center mb-4">
        <h1 className="display-4 fw-bold">Gestión de Gastos</h1>
        <p className="text-muted">Administra tus gastos de forma sencilla</p>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Resumen</h5>
        </div>
        <div className="card-body">
          <div className="row text-center">
            <div className="col-6">
              <h2 className="text-primary fw-bold">{gastos.length}</h2>
              <p className="text-muted small">Total Gastos</p>
            </div>
            <div className="col-6">
              <h2 className="text-success fw-bold">{totalGastos.toFixed(2)}€</h2>
              <p className="text-muted small">Importe Total</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header p-0">
          <ul className="nav nav-tabs card-header-tabs">
            <li className="nav-item">
              <button className={`nav-link ${activeTab === "pdf" ? "active" : ""}`} onClick={() => setActiveTab("pdf")}>
                <i className="fas fa-file-pdf me-2"></i>
                Importar PDF
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === "manual" ? "active" : ""}`}
                onClick={() => setActiveTab("manual")}
              >
                <i className="fas fa-plus me-2"></i>
                Gasto Manual
              </button>
            </li>
          </ul>
        </div>
        <div className="card-body">
          {activeTab === "pdf" && <PDFUpload onImported={handleGastoAdded} />}
          {activeTab === "manual" && <GastoForm onGastoAdded={handleGastoAdded} />}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ backgroundColor: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
          <h5 className="card-title mb-0" style={{ color: "#212529", fontWeight: "bold" }}>
            Gastos Recientes
          </h5>
        </div>
        <div className="card-body">
          {isLoading ? (
            <div className="text-center text-muted">
              <div className="spinner-border me-2" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              Cargando gastos...
            </div>
          ) : gastos.length === 0 ? (
            <p className="text-center text-muted">No hay gastos registrados</p>
          ) : (
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              {gastos.slice(0, 10).map((gasto) => (
                <div
                  key={gasto.id}
                  className="d-flex justify-content-between align-items-center p-3 mb-2 bg-light rounded"
                >
                  <div>
                    <p className="fw-medium mb-1">{gasto.descripcion}</p>
                    <p className="text-muted small mb-0">Por: {gasto.persona}</p>
                  </div>
                  <h5 className="fw-bold mb-0">{gasto.monto.toFixed(2)}€</h5>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
