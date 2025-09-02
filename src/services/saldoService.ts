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
    const raw = await requestJson<unknown>(`${API_BASE_URL}/get`, { method: 'GET', cache: 'no-store' });
    const payload = unwrapApiResponse<unknown>(raw as unknown) as unknown as Record<string, unknown> | null;
    if (payload == null) return null;
    const valor = Number((payload as Record<string, unknown>).valor ?? (payload as Record<string, unknown>).saldo ?? 0);
    const fecha = (payload as Record<string, unknown>).fecha as string | undefined;
    return { valor, fecha };
  }

  async saveSaldo(dto: SaveSaldoDto): Promise<void> {
    await requestJson<void>(`${API_BASE_URL}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: dto.valor, fecha: dto.fecha?.toISOString() })
    });
  }
}


