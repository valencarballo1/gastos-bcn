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
    const data = await requestJson<any>(`${API_BASE_URL}/get-gastos`, { method: 'GET' });
    return (data?.elementos ?? data ?? []) as Gasto[];
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
