import api from './client';
import type { ApiResponse, EventoCalendario } from '@/types';

export const getEventosCalendario = (params?: Record<string, string>) =>
  api.get<ApiResponse<EventoCalendario[]>>('/calendario', { params });

export const crearEventoCalendario = (data: Partial<EventoCalendario>) =>
  api.post<ApiResponse<EventoCalendario>>('/calendario', data);

export const actualizarEventoCalendario = (id: string, data: Partial<EventoCalendario>) =>
  api.put<ApiResponse<EventoCalendario>>(`/calendario/${id}`, data);

export const eliminarEventoCalendario = (id: string) =>
  api.delete<ApiResponse<{ id: string }>>(`/calendario/${id}`);

export const crearEventosCalendarioBulk = (eventos: Partial<EventoCalendario>[]) =>
  api.post<ApiResponse<{ count: number }>>('/calendario/bulk', { eventos });
