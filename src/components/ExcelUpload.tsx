'use client';

import React, { useMemo, useState } from 'react';
import { Button, Card, Table, Alert, Row, Col, Spinner } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import { SaldoService } from '@/services/saldoService';
import { GastosService } from '@/services/gastosService';
import { GastoFormData } from '@/types';

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
  const [isSavingGastos, setIsSavingGastos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveGastosMessage, setSaveGastosMessage] = useState<string | null>(null);

  const [selectedPersona] = useState<'Ana' | 'Valen'>('Valen');
  const [categoriaId, setCategoriaId] = useState<string>('');

  const formatEuro = (n: number) =>
    n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const parseNumberEs = (value: unknown): number => {
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

  const parseDate = (value: unknown): Date | null => {
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

      // Leemos como matriz (AOA) para detectar la fila de encabezados real
      const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null });

      const normalize = (v: unknown): string => {
        if (typeof v !== 'string') return '';
        return v
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      // Buscar la fila donde aparecen encabezados como "fecha operacion", "concepto", "importe"
      let headerRowIdx = -1;
      let headers: string[] = [];
      for (let i = 0; i < Math.min(aoa.length, 50); i++) {
        const row = aoa[i];
        const norm = row.map(normalize);
        const hasFecha = norm.some(c => c.includes('fecha operacion') || c.includes('fecha valor') || c === 'fecha');
        const hasConcepto = norm.some(c => c.includes('concepto') || c.includes('descripcion') || c.includes('detalle'));
        const hasImporte = norm.some(c => c.includes('importe') || c.includes('cargo'));
        if (hasFecha && hasConcepto && hasImporte) {
          headerRowIdx = i;
          headers = row.map(v => (typeof v === 'string' ? v : '')) as string[];
          break;
        }
      }

      if (headerRowIdx === -1) {
        const detectedKeys = aoa[0] ? aoa[0].map(x => (x ?? '')).join(', ') : '—';
        setRows([]);
        setFinalSaldo(null);
        setError(`No se detectaron encabezados de movimientos. Revisa que existan columnas como Fecha operación, Concepto, Importe, Saldo. Columnas detectadas: ${detectedKeys}`);
        return;
      }

      // Indices de columnas
      const normHeaders = headers.map(normalize);
      const findCol = (...candidates: string[]): number => {
        return normHeaders.findIndex(h => candidates.some(c => h.includes(c)));
      };
      const idxFechaOp = findCol('fecha operacion', 'fecha');
      const idxConcepto = findCol('concepto', 'descripcion', 'detalle');
      const idxImporte = findCol('importe', 'cargo');
      const idxSaldo = findCol('saldo');

      const dataStart = headerRowIdx + 1;
      const mapped: ParsedRow[] = [];
      for (let r = dataStart; r < aoa.length; r++) {
        const row = aoa[r];
        if (!row || row.every(v => v == null || String(v).trim() === '')) continue;
        const fechaOperacion = parseDate(idxFechaOp >= 0 ? (row[idxFechaOp] as unknown) : null);
        const conceptoCell = idxConcepto >= 0 ? (row[idxConcepto] as unknown) : '';
        const importeCell = idxImporte >= 0 ? (row[idxImporte] as unknown) : 0;
        const saldoCell = idxSaldo >= 0 ? (row[idxSaldo] as unknown) : null;
        const importe = parseNumberEs(importeCell);
        const saldo = saldoCell != null ? parseNumberEs(saldoCell) : null;
        // Si no hay concepto ni importe, skip
        if (!conceptoCell && (!importe || importe === 0)) continue;
        mapped.push({
          fechaOperacion,
          concepto: String(conceptoCell || ''),
          importe: Number(importe || 0),
          saldo,
        });
      }

      // Filtrar filas que realmente son movimientos (importe distinto de 0)
      const movimientos = mapped.filter(m => typeof m.importe === 'number' && m.importe !== 0);

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

      if (movimientos.length === 0) {
        const showHeaders = headers.length ? headers.join(', ') : '—';
        setError(`No se detectaron movimientos. Revisa los nombres de columnas (ej.: Fecha operación, Concepto/Descripción, Importe, Saldo). Encabezados detectados: ${showHeaders}`);
      } else {
        setError(null);
      }
    } catch (e) {
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
    } catch (e) {
      setError('No se pudo guardar el saldo en la API. Revisa la configuración del endpoint.');
    } finally {
      setIsSavingSaldo(false);
    }
  };

  const totalsByConcepto = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const r of rows) {
      const key = r.concepto || '';
      const importe = Number(r.importe || 0);
      totals[key] = (totals[key] ?? 0) + importe;
    }
    return totals;
  }, [rows]);

  const totalImporte = useMemo(() => rows.reduce((acc, r) => acc + (r.importe || 0), 0), [rows]);

  const handleSaveGastos = async () => {
    setError(null);
    setSaveGastosMessage(null);
    if (!categoriaId) {
      setError('Debes indicar un categoriaId para los gastos.');
      return;
    }
    const gastosService = GastosService.getInstance();
    setIsSavingGastos(true);
    let created = 0;
    try {
      const toCreate: GastoFormData[] = rows
        .filter(r => typeof r.importe === 'number' && r.importe < 0)
        .map(r => ({
          monto: Math.abs(r.importe),
          descripcion: r.concepto,
          categoriaId,
          persona: selectedPersona,
        }));
      const createdList = await gastosService.addGastosBulk(toCreate);
      created = createdList.length;
      setSaveGastosMessage(`Se guardaron ${created} gastos correctamente.`);
      if (created > 0) {
        onImported?.();
      }
    } catch (e) {
      setError('Ocurrió un error guardando los gastos. Intenta nuevamente.');
    } finally {
      setIsSavingGastos(false);
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
              variant="primary"
              disabled={rows.length === 0 || isSavingGastos}
              onClick={handleSaveGastos}
            >
              {isSavingGastos ? (<><Spinner size="sm" animation="border" className="me-2"/>Guardando...</>) : 'Guardar gastos'}
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" className="mb-3">{error}</Alert>
        )}
        {saveGastosMessage && (
          <Alert variant="success" className="mb-3">{saveGastosMessage}</Alert>
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
          <Row className="mb-3 align-items-end">
            <Col md={6} className="mb-2">
              <label className="form-label mb-1" htmlFor="categoriaId">Categoria ID</label>
              <input id="categoriaId" className="form-control" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} placeholder="p.ej. 123" />
            </Col>
            <Col md={6} className="mb-2 text-md-end">
              <span className="badge bg-success">Total importe (archivo): {formatEuro(totalImporte)}</span>
            </Col>
          </Row>
        )}
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
          <div className="mb-3" style={{ maxHeight: 200, overflow: 'auto' }}>
            <Table bordered size="sm">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th className="text-end">Total Importe (€)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(totalsByConcepto).map(([concepto, total]) => (
                  <tr key={concepto}>
                    <td>{concepto}</td>
                    <td className="text-end">{total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
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


