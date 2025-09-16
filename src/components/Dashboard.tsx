"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { GastoForm } from "./GastoForm"
import { PDFUpload } from "./PDFUpload"
import { GastosService } from "../services/gastosService"
import { CategoriasService } from "../services/categoriasService"
import type { Gasto, Categoria, GastosPorCategoria } from "../types"



export const Dashboard: React.FC = () => {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("pdf")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const fetchData = async () => {
    try {
      const gastosService = GastosService.getInstance()
      const categoriasService = CategoriasService.getInstance()

      const [gastosData, categoriasData] = await Promise.all([
        gastosService.getGastos(),
        categoriasService.getCategorias(),
      ])

      setGastos(gastosData)
      setCategorias(categoriasData)
    } catch (error) {
      console.error("Error al cargar datos:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleGastoAdded = () => {
    fetchData()
  }

  const toggleCategory = (categoriaId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoriaId)) {
      newExpanded.delete(categoriaId)
    } else {
      newExpanded.add(categoriaId)
    }
    setExpandedCategories(newExpanded)
  }

  const gastosPorCategoria: GastosPorCategoria = gastos.reduce((acc, gasto) => {
    const categoriaId = gasto.categoria.id
    if (!acc[categoriaId]) {
      acc[categoriaId] = {
        categoria: gasto.categoria,
        gastos: [],
        total: 0,
      }
    }
    acc[categoriaId].gastos.push(gasto)
    acc[categoriaId].total += gasto.monto
    return acc
  }, {} as GastosPorCategoria)

  const totalGastos = gastos.reduce((sum, gasto) => sum + gasto.monto, 0)
  const categoryColors = ["#ffb74d", "#ff7043", "#64b5f6", "#81c784", "#ba68c8"]

  return (
    <div
      className="container py-4"
      style={{ background: "linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)", minHeight: "100vh" }}
    >
      <div className="text-center mb-5">
        <h1
          className="display-3 fw-bold mb-3"
          style={{
            background: "linear-gradient(90deg, #ea580c, #f97316)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          <i className="fas fa-chart-line me-3"></i>
          Gestión de Gastos
        </h1>
        <p className="lead text-muted">Dashboard inteligente para el control de tus finanzas</p>
      </div>

      <div className="row mb-5">
        <div className="col-md-4 mb-3">
          <div className="stats-card p-4 text-center">
            <i className="fas fa-receipt fa-2x mb-3"></i>
            <h2 className="fw-bold">{gastos.length}</h2>
            <p className="mb-0">Total Gastos</p>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="stats-card p-4 text-center">
            <i className="fas fa-euro-sign fa-2x mb-3"></i>
            <h2 className="fw-bold">{totalGastos.toFixed(2)}€</h2>
            <p className="mb-0">Importe Total</p>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="stats-card p-4 text-center">
            <i className="fas fa-tags fa-2x mb-3"></i>
            <h2 className="fw-bold">{Object.keys(gastosPorCategoria).length}</h2>
            <p className="mb-0">Categorías</p>
          </div>
        </div>
      </div>

      <div className="futuristic-card mb-5">
        <div className="card-header p-0" style={{ background: "transparent", border: "none" }}>
          <ul className="nav nav-tabs" style={{ borderBottom: "2px solid #f97316" }}>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === "pdf" ? "active" : ""}`}
                onClick={() => setActiveTab("pdf")}
                style={{
                  color: activeTab === "pdf" ? "#ea580c" : "#6b7280",
                  borderColor: activeTab === "pdf" ? "#f97316" : "transparent",
                  fontWeight: "bold",
                }}
              >
                <i className="fas fa-file-pdf me-2"></i>
                Importar PDF
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === "manual" ? "active" : ""}`}
                onClick={() => setActiveTab("manual")}
                style={{
                  color: activeTab === "manual" ? "#ea580c" : "#6b7280",
                  borderColor: activeTab === "manual" ? "#f97316" : "transparent",
                  fontWeight: "bold",
                }}
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

      <div className="row">
        <div className="col-12">
          <h2 className="category-header mb-4">
            <i className="fas fa-layer-group me-2"></i>
            Gastos por Categorías
          </h2>

          {isLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-warning me-3" role="status" style={{ width: "3rem", height: "3rem" }}>
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="text-muted mt-3">Analizando tus gastos...</p>
            </div>
          ) : Object.keys(gastosPorCategoria).length === 0 ? (
            <div className="futuristic-card p-5 text-center">
              <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
              <p className="text-muted">No hay gastos registrados</p>
            </div>
          ) : (
            <div className="row">
              {Object.entries(gastosPorCategoria).map(([categoriaId, data], index) => (
                <div key={categoriaId} className="col-lg-6 mb-4">
                  <div className="futuristic-card">
                    <div
                      className="card-header d-flex justify-content-between align-items-center"
                      style={{
                        background: `linear-gradient(135deg, ${categoryColors[index % categoryColors.length]}20, ${categoryColors[index % categoryColors.length]}10)`,
                        border: "none",
                        cursor: "pointer",
                      }}
                      onClick={() => toggleCategory(categoriaId)}
                    >
                      <div className="d-flex align-items-center">
                        <div
                          className="rounded-circle me-3"
                          style={{
                            width: "12px",
                            height: "12px",
                            backgroundColor: categoryColors[index % categoryColors.length],
                            boxShadow: `0 0 10px ${categoryColors[index % categoryColors.length]}50`,
                          }}
                        ></div>
                        <h5 className="mb-0 fw-bold" style={{ color: "#ea580c" }}>
                          {data.categoria.nombre}
                        </h5>
                      </div>
                      <div className="d-flex align-items-center">
                        <span className="badge me-2" style={{ backgroundColor: "#f97316", color: "white" }}>
                          {data.gastos.length} gastos
                        </span>
                        <h5 className="mb-0 fw-bold text-success">{data.total.toFixed(2)}€</h5>
                        <i className={`fas fa-chevron-${expandedCategories.has(categoriaId) ? "up" : "down"} ms-2`}></i>
                      </div>
                    </div>

                    {expandedCategories.has(categoriaId) && (
                      <div className="card-body" style={{ maxHeight: "300px", overflowY: "auto" }}>
                        {data.gastos.map((gasto, gastoIndex) => (
                          <div
                            key={gasto.id}
                            className="expense-item d-flex justify-content-between align-items-center p-3 mb-2 rounded"
                            style={{
                              backgroundColor: gastoIndex % 2 === 0 ? "#fffbeb" : "#ffffff",
                              animationDelay: `${gastoIndex * 0.1}s`,
                            }}
                          >
                            <div>
                              <p className="fw-medium mb-1" style={{ color: "#374151" }}>
                                {gasto.descripcion}
                              </p>
                              <div className="d-flex align-items-center">
                                <span className="text-muted small me-3">
                                  <i className="fas fa-user me-1"></i>
                                  {gasto.persona}
                                </span>
                                {gasto.fecha && (
                                  <span className="text-muted small">
                                    <i className="fas fa-calendar me-1"></i>
                                    {new Date(gasto.fecha).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <h6 className="fw-bold mb-0" style={{ color: "#ea580c" }}>
                              {gasto.monto.toFixed(2)}€
                            </h6>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
