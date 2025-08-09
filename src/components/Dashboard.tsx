'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { GastosList } from './GastosList';
import { GastoForm } from './GastoForm';
import { CategoriaForm } from './CategoriaForm';
import { GastosService } from '../services/gastosService';
import { Gasto } from '../types';
import { BEACH_COLORS } from '../utils/colors';

export const Dashboard: React.FC = () => {
  const [gastos, setGastos] = useState<{ ana: Gasto[], valen: Gasto[], total: Gasto[] }>({
    ana: [],
    valen: [],
    total: []
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const gastosService = GastosService.getInstance();

  const loadGastos = useCallback(async () => {
    try {
      const allGastos = await gastosService.getGastos();
      const ana = allGastos.filter(g => g.persona === 'Ana');
      const valen = allGastos.filter(g => g.persona === 'Valen');

      setGastos({
        ana: ana.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
        valen: valen.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
        total: allGastos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      });
    } catch (error) {
      console.error('Error cargando gastos desde API:', error);
    }
  }, [gastosService]);

  useEffect(() => {
    loadGastos();
  }, [loadGastos, refreshKey]);

  const handleGastoAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCategoriaAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const totalGeneral = gastos.total.reduce((sum, gasto) => sum + gasto.monto, 0);
  const totalAna = gastos.ana.reduce((sum, gasto) => sum + gasto.monto, 0);
  const totalValen = gastos.valen.reduce((sum, gasto) => sum + gasto.monto, 0);

  return (
    <Container fluid className="py-4">
      {/* Header con estadísticas generales */}
      <Row className="mb-4">
        <Col>
          <Card style={{
            background: `linear-gradient(135deg, ${BEACH_COLORS.oceanBlue} 0%, ${BEACH_COLORS.seaBlue} 100%)`,
            border: 'none',
            borderRadius: '20px',
            boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
          }}>
            <Card.Body className="text-center text-white py-4">
              <h1 className="display-4 mb-3">🌊 Gastos BCN</h1>
              <p className="lead mb-4">
                Controla tus gastos compartidos con estilo playero
              </p>

              <Row className="justify-content-center">
                <Col md={3} className="mb-3">
                  <div className="text-center">
                    <h3 className="mb-1">€{totalGeneral.toFixed(2)}</h3>
                    <small>Total General</small>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="text-center">
                    <h3 className="mb-1">€{totalAna.toFixed(2)}</h3>
                    <small>Total Ana</small>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="text-center">
                    <h3 className="mb-1">€{totalValen.toFixed(2)}</h3>
                    <small>Total Valen</small>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="text-center">
                    <h3 className="mb-1">{gastos.total.length}</h3>
                    <small>Gastos Registrados</small>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Formularios */}
      <Row className="mb-4">
        <Col lg={8}>
          <GastoForm onGastoAdded={handleGastoAdded} />
        </Col>
        <Col lg={4} className="d-flex align-items-start justify-content-center">
          <CategoriaForm onCategoriaAdded={handleCategoriaAdded} />
        </Col>
      </Row>

      {/* Listas de gastos */}
      <Row>
        <Col lg={4} className="mb-4">
          <GastosList
            titulo="👩 Gastos de Ana"
            color={BEACH_COLORS.coral}
            maxItems={5}
            gastos={gastos.ana}
          />
        </Col>

        <Col lg={4} className="mb-4">
          <GastosList
            titulo="👨 Gastos de Valen"
            color={BEACH_COLORS.aqua}
            maxItems={5}
            gastos={gastos.valen}
          />
        </Col>

        <Col lg={4} className="mb-4">
          <GastosList
            titulo="🌊 Gastos Totales"
            color={BEACH_COLORS.sand}
            maxItems={5}
            gastos={gastos.total}
          />
        </Col>
      </Row>

      {/* Footer */}
      <Row className="mt-5">
        <Col>
          <Card style={{
            background: `linear-gradient(135deg, ${BEACH_COLORS.lightGray} 0%, ${BEACH_COLORS.white} 100%)`,
            border: `1px solid ${BEACH_COLORS.lightBlue}`,
            borderRadius: '15px'
          }}>
            <Card.Body className="text-center py-3">
              <p className="mb-0 text-muted">
                💡 Tip: Haz clic en cualquier gasto para ver más detalles
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};
