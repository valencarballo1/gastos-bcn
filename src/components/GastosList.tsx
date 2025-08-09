'use client';

import { Gasto, GastosListProps } from '@/types';
import React, { useState } from 'react';
import { Card, Button, Badge, Row, Col, Modal } from 'react-bootstrap';

export const GastosList: React.FC<GastosListProps> = ({ titulo, color, maxItems = 5, gastos }) => {
  const [showAll, setShowAll] = useState(false);
  const [selectedGasto, setSelectedGasto] = useState<Gasto | null>(null);

  // Convertir fecha string a Date si es necesario
  const parsedGastos = gastos.map(gasto => ({
    ...gasto,
    fecha: gasto.fecha instanceof Date ? gasto.fecha : new Date(gasto.fecha),
  }));

  const gastosToShow = showAll ? parsedGastos : parsedGastos.slice(0, maxItems);
  const totalGastos = parsedGastos.reduce((sum, gasto) => sum + gasto.monto, 0);

  const formatDate = (date: Date) =>
    date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <>
      <Card className="mb-4 h-100" style={{ border: `2px solid ${color}` }}>
        <Card.Header style={{ background: color, color: 'white' }}>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{titulo}</h5>
            <Badge bg="light" text="dark">
              Total: {totalGastos.toFixed(2)}€
            </Badge>
          </div>
        </Card.Header>

        <Card.Body>
          {gastosToShow.length === 0 ? (
            <div className="text-center text-muted py-4">
              <p>No hay gastos registrados</p>
            </div>
          ) : (
            <>
              {gastosToShow.map((gasto) => (
                <div
                  key={gasto.id}
                  className="p-3 mb-2"
                  style={{ background: `${gasto.categoria.color}15`, cursor: 'pointer' }}
                  onClick={() => setSelectedGasto(gasto)}
                >
                  <Row>
                    <Col xs={8}>
                      <Badge style={{ background: gasto.categoria.color }}>{gasto.categoria.nombre}</Badge>
                      <span className="ms-2">{gasto.persona}</span>
                      <p className="mb-1">{gasto.descripcion}</p>
                      <small>{formatDate(gasto.fecha as Date)}</small>
                    </Col>
                    <Col xs={4} className="text-end">
                      <strong>{gasto.monto.toFixed(2)}€</strong>
                    </Col>
                  </Row>
                </div>
              ))}
              {gastos.length > maxItems && (
                <Button variant="outline-primary" onClick={() => setShowAll(!showAll)} className="w-100 mt-2">
                  {showAll ? 'Ver menos' : `Ver todos (${gastos.length})`}
                </Button>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Modal detalle gasto */}
      <Modal show={!!selectedGasto} onHide={() => setSelectedGasto(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Detalles del Gasto</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedGasto && (
            <>
              <p><strong>Monto:</strong> {selectedGasto.monto.toFixed(2)}€</p>
              <p><strong>Persona:</strong> {selectedGasto.persona}</p>
              <p><strong>Categoría:</strong> {selectedGasto.categoria.nombre}</p>
              <p><strong>Fecha:</strong> {formatDate(selectedGasto.fecha as Date)}</p>
              <p><strong>Descripción:</strong> {selectedGasto.descripcion}</p>
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  );
};
