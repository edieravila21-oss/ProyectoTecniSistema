import api from './client';
import type { ApiResponse } from '@/types';

export interface CatalogoChecklistItem {
  id: string;
  catalogoId: string;
  categoria: 'llegada' | 'diagnostico' | 'reparacion' | 'cierre';
  descripcion: string;
  orden: number;
}

export interface CatalogoServicio {
  id: string;
  nombre: string;
  descripcion?: string;
  clave?: string;
  duracion_min: number;
  activo: boolean;
  items: CatalogoChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export const getCatalogos = () =>
  api.get<ApiResponse<CatalogoServicio[]>>('/catalogo-servicios');

export const getCatalogo = (id: string) =>
  api.get<ApiResponse<CatalogoServicio>>(`/catalogo-servicios/${id}`);

export const crearCatalogo = (data: Partial<CatalogoServicio>) =>
  api.post<ApiResponse<CatalogoServicio>>('/catalogo-servicios', data);

export const actualizarCatalogo = (id: string, data: Partial<CatalogoServicio>) =>
  api.put<ApiResponse<CatalogoServicio>>(`/catalogo-servicios/${id}`, data);

export const eliminarCatalogo = (id: string) =>
  api.delete<ApiResponse<void>>(`/catalogo-servicios/${id}`);

export const reemplazarItemsCatalogo = (id: string, items: Partial<CatalogoChecklistItem>[]) =>
  api.put<ApiResponse<CatalogoServicio>>(`/catalogo-servicios/${id}/items`, { items });
