export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;
}

export interface Gasto {
  id: string;
  monto: number;
  descripcion: string;
  categoria: Categoria;
  persona: 'Ana' | 'Valen';
  fecha: Date;
}

export interface GastosPorPersona {
  ana: Gasto[];
  valen: Gasto[];
  total: Gasto[];
}

export interface CategoriaFormData {
  nombre: string;
  descripcion: string;
  color: string;
}

export interface GastoFormData {
  monto: number;
  descripcion: string;
  categoriaId: string;
  persona: 'Ana' | 'Valen';
} 

export interface GastosListProps {
  titulo: string;
  color: string;
  maxItems?: number;
  gastos: Gasto[];  // <-- agregar esta prop para recibir gastos
}

export interface GastoFormData {
  monto: number
  descripcion: string
  categoriaId: string
  persona: "Ana" | "Valen"
}

export interface Categoria {
  id: string
  nombre: string
}

export interface ParsedProduct {
  descripcion: string
  cantidad: number
  precioUnitario: number
  importe: number
}

export interface MercadonaTicket {
  fecha: Date
  productos: ParsedProduct[]
  total: number
  tienda: string
}

export interface GastosPorCategoria {
  [categoriaId: string]: {
    categoria: Categoria
    gastos: Gasto[]
    total: number
  }
}