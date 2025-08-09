import { Gasto, GastoFormData } from '../types';

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
    const res = await fetch(`${API_BASE_URL}/get-gastos`, { method: 'GET' });
    if (!res.ok) throw new Error('Error al obtener gastos');
    const data = await res.json();
    return data.result?.elementos ?? [];
  }

  async addGasto(gasto: GastoFormData): Promise<Gasto> {
    const res = await fetch(`${API_BASE_URL}/create-gasto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gasto)
    });
    if (!res.ok) throw new Error('Error al crear gasto');
    const data = await res.json();
    return data.result ?? data;
  }

  async deleteGasto(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/delete-gastos/${id}`, { method: 'POST' });
    if (!res.ok) throw new Error('Error al eliminar gasto');
  }
}
