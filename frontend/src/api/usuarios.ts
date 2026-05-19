import api from './client';
import type { ApiResponse, Usuario } from '@/types';

export const getUsuarios = (params?: Record<string, string>) =>
  api.get<ApiResponse<Usuario[]>>('/usuarios', { params });

export const getUsuario = (id: string) =>
  api.get<ApiResponse<Usuario>>(`/usuarios/${id}`);

export const crearUsuario = (data: Partial<Usuario> & { pin: string }) =>
  api.post<ApiResponse<Usuario>>('/usuarios', data);

export const actualizarUsuario = (id: string, data: Partial<Usuario>) =>
  api.put<ApiResponse<Usuario>>(`/usuarios/${id}`, data);

export const toggleActivo = (id: string) =>
  api.patch<ApiResponse<Usuario>>(`/usuarios/${id}/toggle-activo`);

export const getAgendaTecnico = (id: string, fecha: string) =>
  api.get<ApiResponse<unknown[]>>(`/usuarios/${id}/agenda`, { params: { fecha } });

export const getMetricasTecnico = (id: string, params?: Record<string, string>) =>
  api.get<ApiResponse<{
    total_servicios: number;
    completados: number;
    cancelados: number;
    calificacion_promedio: number;
    ingresos_generados: number;
    valor_promedio: number;
  }>>(`/usuarios/${id}/metricas`, { params });
