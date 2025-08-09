'use client';

import React, { useState } from 'react';
import { Form, Button, Modal } from 'react-bootstrap';
import { CategoriaFormData } from '../types';
import { CategoriasService } from '../services/categoriasService';
import { BEACH_COLORS, getCategoryColors } from '../utils/colors';

interface CategoriaFormProps {
  onCategoriaAdded: () => void;
}

export const CategoriaForm: React.FC<CategoriaFormProps> = ({ onCategoriaAdded }) => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setCategoriaFormData] = useState<CategoriaFormData>({
    nombre: '',
    descripcion: '',
    color: getCategoryColors()[0]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoriasService = CategoriasService.getInstance();
  const availableColors = getCategoryColors();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) {
      alert('Por favor ingresa el nombre de la categoría');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await categoriasService.addCategoria(formData); // ✅ API call
      setCategoriaFormData({
        nombre: '',
        descripcion: '',
        color: getCategoryColors()[0]
      });
      setShowModal(false);
      onCategoriaAdded();
    } catch (error) {
      console.error('Error al agregar categoría:', error);
      alert('Error al agregar la categoría');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CategoriaFormData, value: string) => {
  setCategoriaFormData(prev => ({
    ...prev,
    [field]: value
  }));
};

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        style={{
          background: `linear-gradient(135deg, ${BEACH_COLORS.aqua} 0%, ${BEACH_COLORS.lightBlue} 100%)`,
          border: 'none',
          borderRadius: '10px',
          padding: '10px 20px',
          fontWeight: '600'
        }}
        className="text-white mb-3"
      >
        🏷️ Nueva Categoría
      </Button>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header 
          closeButton 
          style={{ 
            background: `linear-gradient(135deg, ${BEACH_COLORS.aqua} 0%, ${BEACH_COLORS.lightBlue} 100%)`,
            color: 'white'
          }}
        >
          <Modal.Title>🌊 Nueva Categoría</Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label style={{ color: BEACH_COLORS.darkGray, fontWeight: '600' }}>
                📝 Nombre de la Categoría
              </Form.Label>
              <Form.Control
                type="text"
                value={formData.nombre}
                onChange={(e) => handleInputChange('nombre', e.target.value)}
                placeholder="Ej: Viajes, Salud, Educación..."
                style={{ 
                  borderColor: BEACH_COLORS.lightBlue,
                  borderRadius: '10px'
                }}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label style={{ color: BEACH_COLORS.darkGray, fontWeight: '600' }}>
                📖 Descripción (Opcional)
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={formData.descripcion}
                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                placeholder="Describe qué tipo de gastos incluye esta categoría..."
                style={{ 
                  borderColor: BEACH_COLORS.lightBlue,
                  borderRadius: '10px'
                }}
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label style={{ color: BEACH_COLORS.darkGray, fontWeight: '600' }}>
                🎨 Color de la Categoría
              </Form.Label>
              <div className="d-flex flex-wrap gap-2">
                {availableColors.map((color) => (
                  <div
                    key={color}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: color,
                      border: formData.color === color ? `3px solid ${BEACH_COLORS.darkGray}` : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleInputChange('color', color)}
                  />
                ))}
              </div>
            </Form.Group>

            <div className="d-flex gap-2 justify-content-end">
              <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creando...' : '🌊 Crear Categoría'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
};
