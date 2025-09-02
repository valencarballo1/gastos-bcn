'use client';

import React, { useState } from 'react';
import { Button, Card, Table, Alert, Row, Col, Spinner } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import { GastosService } from '../services/gastosService';
import { SaldoService } from '@/services/saldoService';

interface ParsedRow {
  fechaOperacion: Date | null;
  concepto: string;
  importe: number; // negativo para cargos
  saldo?: number | null;
}

interface ExcelUploadProps {
  onImported?: () => void;
}

export const ExcelUpload: React.FC<ExcelUploadProps> = ({ onImported }) => {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [finalSaldo, setFinalSaldo] = useState<number | null>(null);
  const [isSavingSaldo, setIsSavingSaldo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatEuro = (n: number) =>
    n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const parseNumberEs = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    const cleaned = value
      .replace(/\s/g, '')
      .replace(/EUR/gi, '')
      .replace(/\./g, '')
      .replace(/,/g, '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parseDate = (value: any): Date | null => {
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (!date) return null;
      return new Date(Date.UTC(date.y, (date.m || 1) - 1, date.d || 1));
    }
    if (typeof value === 'string') {
      const [d, m, y] = value.split(/[\/\-]/).map(x => parseInt(x, 10));
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
    }
    return null;
  };

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      // Mapear columnas esperadas
      const mapped: ParsedRow[] = json
        .map((r: any) => {
          const fechaOperacion = parseDate(
            r['Fecha operación'] ?? r['Fecha operacion'] ?? r['Fecha'] ?? r['FECHA']
          );
          const concepto = r['Concepto'] ?? r['CONCEPTO'] ?? '';
          const importe = parseNumberEs(r['Importe'] ?? r['IMPORTE'] ?? r['Cargo']);
          const saldoCell = r['Saldo'] ?? r['SALDO'];
          const saldo = saldoCell != null ? parseNumberEs(saldoCell) : null;
          if (!fechaOperacion && !concepto && !importe) return null;
          return {
            fechaOperacion,
            concepto: String(concepto || ''),
            importe: Number(importe || 0),
            saldo: saldo,
          } as ParsedRow;
        })
        .filter(Boolean) as ParsedRow[];

      // Filtrar filas que realmente son movimientos (tienen fecha e importe)
      const movimientos = mapped.filter(m => m.fechaOperacion && m.importe !== 0);

      // Ordenar por fecha asc para calcular saldo si no viene
      movimientos.sort((a, b) => {
        const ta = (a.fechaOperacion?.getTime() || 0);
        const tb = (b.fechaOperacion?.getTime() || 0);
        return ta - tb;
      });

      // Determinar saldo final: preferimos la última columna 'Saldo' si existe
      let computedFinalSaldo: number | null = null;
      const lastWithSaldo = [...movimientos].reverse().find(r => r.saldo != null);
      if (lastWithSaldo && lastWithSaldo.saldo != null) {
        computedFinalSaldo = lastWithSaldo.saldo as number;
      }

      setRows(movimientos);
      setFinalSaldo(computedFinalSaldo);
    } catch (e: any) {
      setError('No se pudo leer el archivo. Asegúrate de seleccionar el Excel correcto.');
      console.error(e);
    }
  };

  const handleSaveSaldo = async () => {
    if (finalSaldo == null) {
      setError('No se pudo determinar el saldo final del Excel.');
      return;
    }
    setIsSavingSaldo(true);
    setError(null);
    try {
      const saldoService = SaldoService.getInstance();
      await saldoService.saveSaldo({ valor: finalSaldo, fecha: new Date() });
    } catch (e: any) {
      setError('No se pudo guardar el saldo en la API. Revisa la configuración del endpoint.');
    } finally {
      setIsSavingSaldo(false);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header>
        <div className="d-flex justify-content-between align-items-center">
          <span>Importar movimientos desde Excel</span>
          <div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              style={{ display: 'none' }}
              id="excel-input"
            />
            <label htmlFor="excel-input" className="btn btn-outline-primary mb-0 me-2">
              Seleccionar Excel
            </label>
            <Button
              variant="success"
              disabled={finalSaldo == null || isSavingSaldo}
              onClick={handleSaveSaldo}
            >
              {isSavingSaldo ? (<><Spinner size="sm" animation="border" className="me-2"/>Guardando...</>) : 'Guardar saldo en API'}
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" className="mb-3">{error}</Alert>
        )}
        <Row className="mb-3">
          <Col md={6}>
            <strong>Saldo final detectado:</strong> {finalSaldo != null ? `${finalSaldo.toFixed(2)} €` : '—'}
          </Col>
          <Col md={6} className="text-md-end">
            <small className="text-muted">Columnas esperadas: Fecha operación, Concepto, Importe, Saldo (opcional)</small>
          </Col>
        </Row>
        {rows.length > 0 && (
          <Row className="mb-3">
            <Col md={6} className="mb-2">
              <span className="badge bg-primary me-2">Movimientos: {rows.length}</span>
            </Col>
            <Col md={6} className="text-md-end">
              <span className="badge bg-success">Total importe: {formatEuro(rows.reduce((acc, r) => acc + (r.importe || 0), 0))}</span>
            </Col>
          </Row>
        )}
        {rows.length > 0 && (
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            <Table striped bordered hover size="sm">
              <thead>
                <tr>
                  <th>Fecha operación</th>
                  <th>Concepto</th>
                  <th className="text-end">Importe (€)</th>
                  <th className="text-end">Saldo (€)</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td>{r.fechaOperacion ? r.fechaOperacion.toLocaleDateString('es-ES') : ''}</td>
                    <td>{r.concepto}</td>
                    <td className="text-end">{r.importe.toFixed(2)}</td>
                    <td className="text-end">{r.saldo != null ? r.saldo.toFixed(2) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {rows.length > 50 && (
              <div className="text-muted small">Mostrando 50 de {rows.length} filas…</div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default ExcelUpload;


