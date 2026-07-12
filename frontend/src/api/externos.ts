import api from './client';

export interface ProductoPuntoVenta {
  id: number;
  codigo: string;
  nombre: string;
  precio: number;
  categoria: string;
}

export const buscarProductos = (q: string) =>
  api.get<{ success: boolean; data: ProductoPuntoVenta[] }>('/externos/productos', { params: { q } });
