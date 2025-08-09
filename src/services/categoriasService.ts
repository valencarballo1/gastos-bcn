import { CategoriaFormData, Categoria } from '../types';

const API_BASE_URL = 'https://gastosApiBCN.somee.com/api/Categoria';

export class CategoriasService {
  private static instance: CategoriasService;

  public static getInstance(): CategoriasService {
    if (!CategoriasService.instance) {
      CategoriasService.instance = new CategoriasService();
    }
    return CategoriasService.instance;
  }

  async getCategorias(): Promise<Categoria[]> {
    const res = await fetch(`${API_BASE_URL}/get-categorias`, { method: 'GET' });
    if (!res.ok) throw new Error('Error al obtener categorías');
    const data = await res.json();
    return data.result ?? data; // Ajusta según tu ApiResponse<T>
  }

  async addCategoria(categoria: CategoriaFormData): Promise<Categoria> {
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoria)
    });
    if (!res.ok) throw new Error('Error al crear categoría');
    const data = await res.json();
    return data.result ?? data;
  }
}
