export interface SaveSaldoDto {
  valor: number;
  fecha?: Date;
}

import { requestJson, unwrapApiResponse } from './api';

const API_BASE_URL = 'https://gastosApiBCN.somee.com/api/Saldo';

export class SaldoService {
  private static instance: SaldoService;

  public static getInstance(): SaldoService {
    if (!SaldoService.instance) {
      SaldoService.instance = new SaldoService();
    }
    return SaldoService.instance;
  }

  async getSaldoActual(): Promise<{ valor: number; fecha?: string } | null> {
    const raw = await requestJson<any>(`${API_BASE_URL}/get`, { method: 'GET', cache: 'no-store' });
    const payload = unwrapApiResponse<any>(raw as any) as any;
    if (payload == null) return null;
    return { valor: Number(payload.valor ?? payload.saldo ?? 0), fecha: payload.fecha };
  }

  async saveSaldo(dto: SaveSaldoDto): Promise<void> {
    await requestJson<void>(`${API_BASE_URL}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: dto.valor, fecha: dto.fecha?.toISOString() })
    });
  }
}


