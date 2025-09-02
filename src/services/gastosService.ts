import { Gasto, GastoFormData } from '../types';
import { requestJson } from './api';

const API_BASE_URL = 'https://gastosApiBCN.somee.com/api/Gastos';

export class GastosService {
  private static instance: GastosService;

  public static getInstance(): GastosService {
    if (!GastosService.instance) {
      GastosService.instance = new GastosService();
    }
    return GastosService.instance;
  }

  async getGastos(): Promise<Gasto[]> {
    const data = await requestJson<Gasto[] | { elementos: Gasto[] }>(`${API_BASE_URL}/get-gastos`, { method: 'GET' });
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && 'elementos' in data) {
      return (data as { elementos: Gasto[] }).elementos ?? [];
    }
    return [];
  }

  async addGasto(gasto: GastoFormData): Promise<Gasto> {
    const data = await requestJson<Gasto>(`${API_BASE_URL}/create-gasto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gasto)
    });
    return data;
  }

  async deleteGasto(id: number): Promise<void> {
    await requestJson<void>(`${API_BASE_URL}/delete-gastos/${id}`, { method: 'POST' });
  }
}
