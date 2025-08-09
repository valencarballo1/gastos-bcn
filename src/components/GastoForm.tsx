'use client';
import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Alert, InputGroup } from 'react-bootstrap';
import { GastoFormData, Categoria } from '../types';
import { GastosService } from '../services/gastosService';
import { CategoriasService } from '../services/categoriasService';

import { BEACH_COLORS } from '../utils/colors';

interface GastoFormProps {
  onGastoAdded: () => void;
}

export const GastoForm: React.FC<GastoFormProps> = ({ onGastoAdded }) => {
  const [formData, setFormData] = useState<GastoFormData>({
    monto: 0,
    descripcion: '',
    categoriaId: '',
    persona: 'Ana'
  });
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
  const fetchCategorias = async () => {
    try {
      const categoriasService = CategoriasService.getInstance();
      const allCategorias = await categoriasService.getCategorias();
      setCategorias(allCategorias);
    } catch (error) {
      console.error('Error al obtener categorías:', error);
    }
  };

  fetchCategorias();
}, []);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.monto || formData.monto <= 0) {
      newErrors.monto = 'El monto debe ser mayor a 0';
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es obligatoria';
    }

    if (!formData.categoriaId) {
      newErrors.categoriaId = 'Debe seleccionar una categoría';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const gastosService = GastosService.getInstance();
      await gastosService.addGasto(formData);

      setFormData({
        monto: 0,
        descripcion: '',
        categoriaId: '',
        persona: 'Ana'
      });

      setShowSuccess(true);
      onGastoAdded();

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error al agregar gasto:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof GastoFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePersonaChange = (persona: 'Ana' | 'Valen') => {
    handleInputChange('persona', persona);
  };

  return (
    <Card className="gasto-form-card mb-4" style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      border: '2px solid #e2e8f0',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
    }}>
      <Card.Header className="text-center py-3" style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        color: 'white',
        borderBottom: 'none',
        borderRadius: '14px 14px 0 0'
      }}>
        <h4 className="mb-0">
          <i className="fas fa-plus-circle me-2"></i>
          Nuevo Gasto
        </h4>
      </Card.Header>

      <Card.Body className="p-4">
        {showSuccess && (
          <Alert variant="success" className="mb-3" dismissible onClose={() => setShowSuccess(false)}>
            <i className="fas fa-check-circle me-2"></i>
            ¡Gasto agregado exitosamente!
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          {/* Selector de Persona - Estilo Excel */}
          <Row className="mb-4">
            <Col>
              <div className="persona-selector">
                <label className="form-label fw-bold text-muted mb-2">
                  <i className="fas fa-user me-2"></i>
                  ¿Quién realizó el gasto?
                </label>
                <div className="d-flex gap-2">
                  <Button
                    type="button"
                    variant={formData.persona === 'Ana' ? 'primary' : 'outline-primary'}
                    size="lg"
                    className="flex-fill persona-btn"
                    onClick={() => handlePersonaChange('Ana')}
                    style={{
                      borderRadius: '12px',
                      padding: '12px 24px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      border: formData.persona === 'Ana' ? '3px solid #1e3a8a' : '2px solid #3b82f6',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <i className="fas fa-female me-2"></i>
                    Ana
                  </Button>
                  <Button
                    type="button"
                    variant={formData.persona === 'Valen' ? 'primary' : 'outline-primary'}
                    size="lg"
                    className="flex-fill persona-btn"
                    onClick={() => handlePersonaChange('Valen')}
                    style={{
                      borderRadius: '12px',
                      padding: '12px 24px',
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      border: formData.persona === 'Valen' ? '3px solid #1e3a8a' : '2px solid #3b82f6',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <i className="fas fa-male me-2"></i>
                    Valen
                  </Button>
                </div>
              </div>
            </Col>
          </Row>

          {/* Grid de Campos - Estilo Excel */}
          <div className="excel-grid">
            <Row className="mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold text-muted">
                    <i className="fas fa-euro-sign me-2"></i>
                    Monto (€)
                  </Form.Label>
                  <InputGroup>
                    <InputGroup.Text style={{
                      background: BEACH_COLORS.lightGray,
                      border: '2px solid #e2e8f0',
                      borderRight: 'none'
                    }}>
                      €
                    </InputGroup.Text>
                    <Form.Control
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.monto || ''}
                      onChange={(e) => handleInputChange('monto', parseFloat(e.target.value) || 0)}
                      isInvalid={!!errors.monto}
                      className="excel-input"
                      style={{
                        border: '2px solid #e2e8f0',
                        borderRadius: '0 8px 8px 0',
                        fontSize: '1.1rem',
                        padding: '12px 16px'
                      }}
                    />
                  </InputGroup>
                  {errors.monto && (
                    <Form.Control.Feedback type="invalid">
                      {errors.monto}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="fw-bold text-muted">
                    <i className="fas fa-tag me-2"></i>
                    Categoría
                  </Form.Label>
                  <Form.Select
                    value={formData.categoriaId}
                    onChange={(e) => handleInputChange('categoriaId', e.target.value)}
                    isInvalid={!!errors.categoriaId}
                    className="excel-input"
                    style={{
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      padding: '12px 16px',
                      background: 'white'
                    }}
                  >
                    <option value="">Seleccionar categoría...</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </option>
                    ))}
                  </Form.Select>
                  {errors.categoriaId && (
                    <Form.Control.Feedback type="invalid">
                      {errors.categoriaId}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
            </Row>

            <Row className="mb-4">
              <Col>
                <Form.Group>
                  <Form.Label className="fw-bold text-muted">
                    <i className="fas fa-align-left me-2"></i>
                    Descripción del Gasto
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.descripcion}
                    onChange={(e) => handleInputChange('descripcion', e.target.value)}
                    isInvalid={!!errors.descripcion}
                    placeholder="Describe brevemente en qué gastaste el dinero..."
                    className="excel-input"
                    style={{
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '1.1rem',
                      padding: '16px',
                      resize: 'none',
                      background: 'white'
                    }}
                  />
                  {errors.descripcion && (
                    <Form.Control.Feedback type="invalid">
                      {errors.descripcion}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>
              </Col>
            </Row>
          </div>

          {/* Botón de Envío */}
          <div className="text-center">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting}
              className="submit-btn"
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 32px',
                fontSize: '1.1rem',
                fontWeight: '600',
                boxShadow: '0 4px 16px rgba(30, 58, 138, 0.3)',
                transition: 'all 0.3s ease'
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
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}; 