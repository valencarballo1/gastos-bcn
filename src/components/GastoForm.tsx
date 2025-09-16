"use client"
import type React from "react"
import { useState, useEffect } from "react"
import type { GastoFormData, Categoria } from "../types"
import { GastosService } from "../services/gastosService"
import { CategoriasService } from "../services/categoriasService"

interface GastoFormProps {
  onGastoAdded: () => void
}

export const GastoForm: React.FC<GastoFormProps> = ({ onGastoAdded }) => {
  const [formData, setFormData] = useState<GastoFormData>({
    monto: 0,
    descripcion: "",
    categoriaId: "",
    persona: "Valen",
  })
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const categoriasService = CategoriasService.getInstance()
        const allCategorias = await categoriasService.getCategorias()
        setCategorias(allCategorias)
      } catch (error) {
        console.error("Error al obtener categorías:", error)
      }
    }

    fetchCategorias()
  }, [])

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.monto || formData.monto <= 0) {
      newErrors.monto = "El monto debe ser mayor a 0"
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = "La descripción es obligatoria"
    }

    if (!formData.categoriaId) {
      newErrors.categoriaId = "Debe seleccionar una categoría"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const gastosService = GastosService.getInstance()
      await gastosService.addGasto(formData)

      setFormData({
        monto: 0,
        descripcion: "",
        categoriaId: "",
        persona: "Valen",
      })

      setShowSuccess(true)
      onGastoAdded()

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      console.error("Error al agregar gasto:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof GastoFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const handlePersonaChange = (persona: "Ana" | "Valen") => {
    handleInputChange("persona", persona)
  }

  return (
    <div
      className="card mb-4"
      style={{
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        border: "2px solid #e2e8f0",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
      }}
    >
      <div
        className="card-header text-center py-3"
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
          color: "white",
          borderBottom: "none",
          borderRadius: "14px 14px 0 0",
        }}
      >
        <h4 className="mb-0">
          <i className="fas fa-plus-circle me-2"></i>
          Nuevo Gasto
        </h4>
      </div>

      <div className="card-body p-4">
        {showSuccess && (
          <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
            <i className="fas fa-check-circle me-2"></i>
            ¡Gasto agregado exitosamente!
            <button type="button" className="btn-close" onClick={() => setShowSuccess(false)}></button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Selector de Persona */}
          <div className="row mb-4">
            <div className="col">
              <div className="persona-selector">
                <label className="form-label fw-bold text-muted mb-2">
                  <i className="fas fa-user me-2"></i>
                  ¿Quién realizó el gasto?
                </label>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className={`btn flex-fill persona-btn ${formData.persona === "Ana" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => handlePersonaChange("Ana")}
                    style={{
                      borderRadius: "12px",
                      padding: "12px 24px",
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      border: formData.persona === "Ana" ? "3px solid #1e3a8a" : "2px solid #3b82f6",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <i className="fas fa-female me-2"></i>
                    Ana
                  </button>
                  <button
                    type="button"
                    className={`btn flex-fill persona-btn ${formData.persona === "Valen" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => handlePersonaChange("Valen")}
                    style={{
                      borderRadius: "12px",
                      padding: "12px 24px",
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      border: formData.persona === "Valen" ? "3px solid #1e3a8a" : "2px solid #3b82f6",
                      transition: "all 0.3s ease",
                    }}
                  >
                    <i className="fas fa-male me-2"></i>
                    Valen
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grid de Campos */}
          <div className="excel-grid">
            <div className="row mb-3">
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted">
                    <i className="fas fa-euro-sign me-2"></i>
                    Monto (€)
                  </label>
                  <div className="input-group">
                    <span
                      className="input-group-text"
                      style={{
                        background: "#f8f9fa",
                        border: "2px solid #e2e8f0",
                        borderRight: "none",
                      }}
                    >
                      €
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.monto || ""}
                      onChange={(e) => handleInputChange("monto", Number.parseFloat(e.target.value) || 0)}
                      className={`form-control excel-input ${errors.monto ? "is-invalid" : ""}`}
                      style={{
                        border: "2px solid #e2e8f0",
                        borderRadius: "0 8px 8px 0",
                        fontSize: "1.1rem",
                        padding: "12px 16px",
                      }}
                    />
                    {errors.monto && <div className="invalid-feedback">{errors.monto}</div>}
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted">
                    <i className="fas fa-tag me-2"></i>
                    Categoría
                  </label>
                  <select
                    value={formData.categoriaId}
                    onChange={(e) => handleInputChange("categoriaId", e.target.value)}
                    className={`form-select excel-input ${errors.categoriaId ? "is-invalid" : ""}`}
                    style={{
                      border: "2px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "1.1rem",
                      padding: "12px 16px",
                      background: "white",
                    }}
                  >
                    <option value="">Seleccionar categoría...</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </select>
                  {errors.categoriaId && <div className="invalid-feedback">{errors.categoriaId}</div>}
                </div>
              </div>
            </div>

            <div className="row mb-4">
              <div className="col">
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted">
                    <i className="fas fa-align-left me-2"></i>
                    Descripción del Gasto
                  </label>
                  <textarea
                    rows={3}
                    value={formData.descripcion}
                    onChange={(e) => handleInputChange("descripcion", e.target.value)}
                    className={`form-control excel-input ${errors.descripcion ? "is-invalid" : ""}`}
                    placeholder="Describe brevemente en qué gastaste el dinero..."
                    style={{
                      border: "2px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "1.1rem",
                      padding: "16px",
                      resize: "none",
                      background: "white",
                    }}
                  />
                  {errors.descripcion && <div className="invalid-feedback">{errors.descripcion}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Botón de Envío */}
          <div className="text-center">
            <button
              type="submit"
              className="btn btn-primary btn-lg submit-btn"
              disabled={isSubmitting}
              style={{
                background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                border: "none",
                borderRadius: "12px",
                padding: "14px 32px",
                fontSize: "1.1rem",
                fontWeight: "600",
                boxShadow: "0 4px 16px rgba(30, 58, 138, 0.3)",
                transition: "all 0.3s ease",
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Agregando...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>
                  Agregar Gasto
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
