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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const fetchGastos = async () => {
    try {
      const expensesService = GastosService.getInstance()
      const data = await expensesService.getGastos()
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

  const gastosPorCategoria = gastos.reduce(
    (acc, gasto) => {
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
    },
    {} as Record<string, { categoria: any; gastos: Gasto[]; total: number }>,
  )

  const toggleCategory = (categoriaId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoriaId)) {
      newExpanded.delete(categoriaId)
    } else {
      newExpanded.add(categoriaId)
    }
    setExpandedCategories(newExpanded)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="futuristic-title">Gestión de Gastos</h1>
        <p className="futuristic-subtitle">Administra tus gastos de forma sencilla</p>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <div className="futuristic-card pulse-animation">
            <div className="card-body text-center">
              <div className="futuristic-stat-number">{gastos.length}</div>
              <div className="futuristic-stat-label">Total Gastos</div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="futuristic-card pulse-animation">
            <div className="card-body text-center">
              <div className="futuristic-stat-number">{totalGastos.toFixed(2)}€</div>
              <div className="futuristic-stat-label">Importe Total</div>
            </div>
          </div>
        </div>
      </div>

      <div className="futuristic-tabs">
        <ul className="nav nav-tabs futuristic-nav-tabs" id="mainTabs" role="tablist">
          <li className="nav-item" role="presentation">
            <button
              className="nav-link active futuristic-tab"
              id="pdf-tab"
              data-bs-toggle="tab"
              data-bs-target="#pdf"
              type="button"
              role="tab"
            >
              <i className="fas fa-file-pdf me-2"></i>Importar PDF
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className="nav-link futuristic-tab"
              id="manual-tab"
              data-bs-toggle="tab"
              data-bs-target="#manual"
              type="button"
              role="tab"
            >
              <i className="fas fa-plus me-2"></i>Gasto Manual
            </button>
          </li>
        </ul>
        <div className="tab-content futuristic-tab-content" id="mainTabsContent">
          <div className="tab-pane fade show active" id="pdf" role="tabpanel">
            <PDFUpload onImported={handleGastoAdded} />
          </div>
          <div className="tab-pane fade" id="manual" role="tabpanel">
            <GastoForm onGastoAdded={handleGastoAdded} />
          </div>
        </div>
      </div>

      <div className="futuristic-card slide-in-animation">
        <div className="card-header" style={{ background: "#f8f9fa", color: "#212529", fontWeight: "bold" }}>
          <h5 className="mb-0">
            <i className="fas fa-chart-pie me-2"></i>Gastos por Categoría
          </h5>
        </div>
        <div className="card-body">
          {isLoading ? (
            <div className="text-center">
              <div className="futuristic-loading">
                <i className="fas fa-spinner fa-spin me-2"></i>Cargando gastos...
              </div>
            </div>
          ) : Object.keys(gastosPorCategoria).length === 0 ? (
            <div className="text-center futuristic-empty-state">
              <i className="fas fa-inbox fa-3x mb-3"></i>
              <p>No hay gastos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(gastosPorCategoria).map(([categoriaId, data]) => (
                <div key={categoriaId} className="futuristic-category-card">
                  <div
                    className="futuristic-category-header"
                    onClick={() => toggleCategory(categoriaId)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center">
                        <div
                          className="futuristic-category-color me-3"
                          style={{ backgroundColor: data.categoria.color }}
                        ></div>
                        <div>
                          <h6 className="mb-0 futuristic-category-name">{data.categoria.nombre}</h6>
                          <small className="futuristic-category-count">{data.gastos.length} gastos</small>
                        </div>
                      </div>
                      <div className="d-flex align-items-center">
                        <span className="futuristic-category-total me-3">{data.total.toFixed(2)}€</span>
                        <i
                          className={`fas fa-chevron-${expandedCategories.has(categoriaId) ? "up" : "down"} futuristic-chevron`}
                        ></i>
                      </div>
                    </div>
                  </div>

                  {expandedCategories.has(categoriaId) && (
                    <div className="futuristic-category-content">
                      {data.gastos.slice(0, 10).map((gasto) => (
                        <div key={gasto.id} className="futuristic-expense-item">
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <div className="futuristic-expense-description">{gasto.descripcion}</div>
                              <div className="futuristic-expense-person">Por: {gasto.persona}</div>
                            </div>
                            <div className="futuristic-expense-amount">{gasto.monto.toFixed(2)}€</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
