import { CategoriaFormData, Categoria } from '../types';
import { requestJson } from './api';

const API_BASE_URL = 'https://gastosApiBCN.somee.com/api/Categorias';

export class CategoriasService {
  private static instance: CategoriasService;

  public static getInstance(): CategoriasService {
    if (!CategoriasService.instance) {
      CategoriasService.instance = new CategoriasService();
    }
    return CategoriasService.instance;
  }

  async getCategorias(): Promise<Categoria[]> {
    const data = await requestJson<Categoria[] | { elementos: Categoria[] }>(`${API_BASE_URL}/get-categorias`, { method: 'GET' });
    // tolera respuesta directa o con contenedor de elementos
    return (data as any)?.elementos ?? (data as any) ?? [];
  }

  async addCategoria(categoria: CategoriaFormData): Promise<Categoria> {
    const data = await requestJson<Categoria>(`${API_BASE_URL}/nueva-categoria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoria)
    });
    return data;
  }
}
