import api from './client';
import type { ApiResponse, Servicio, ChecklistItem } from '@/types';

export const getServicios = (params?: Record<string, string>) =>
  api.get<ApiResponse<Servicio[]>>('/servicios', { params });

export const getServicio = (id: string) =>
  api.get<ApiResponse<Servicio>>(`/servicios/${id}`);

export const crearServicio = (data: Partial<Servicio>) =>
  api.post<ApiResponse<Servicio>>('/servicios', data);

export const actualizarServicio = (id: string, data: Partial<Servicio>) =>
  api.put<ApiResponse<Servicio>>(`/servicios/${id}`, data);

export const cambiarEstadoServicio = (id: string, estado: string, extra?: { motivo_cancelacion?: string }) =>
  api.patch<ApiResponse<Servicio>>(`/servicios/${id}/estado`, { estado, ...extra });

export const asignarTecnico = (id: string, tecnico_id: string) =>
  api.patch<ApiResponse<Servicio>>(`/servicios/${id}/asignar`, { tecnico_id });

export const getChecklist = (servicioId: string) =>
  api.get<ApiResponse<ChecklistItem[]>>(`/servicios/${servicioId}/checklist`);

export const marcarChecklistItem = (servicioId: string, itemId: string) =>
  api.patch<ApiResponse<ChecklistItem>>(`/servicios/${servicioId}/checklist/${itemId}`);

export const subirFoto = (servicioId: string, formData: FormData) =>
  api.post<ApiResponse<{ url: string }>>(`/servicios/${servicioId}/fotos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const guardarFirma = (servicioId: string, firma_base64: string) =>
  api.post<ApiResponse<{ url: string }>>(`/servicios/${servicioId}/firma`, { firma_base64 });

export const guardarCalificacion = (servicioId: string, calificacion: number) =>
  api.patch<ApiResponse<Servicio>>(`/servicios/${servicioId}/calificacion`, { calificacion });

export const agregarNota = (servicioId: string, contenido: string) =>
  api.post<ApiResponse<unknown>>(`/servicios/${servicioId}/notas`, { contenido });

export const getHistorialEquipo = (equipoId: string, excluirServicio?: string) =>
  api.get<ApiResponse<{ servicios: any[]; total: number }>>(`/servicios/equipo/${equipoId}/historial`, {
    params: excluirServicio ? { excluir_servicio: excluirServicio } : undefined,
  });

export const eliminarServicio = (id: string) =>
  api.delete<ApiResponse<{ message: string }>>(`/servicios/${id}`);

export const corregirEquipo = (servicioId: string, data: { marca?: string; modelo?: string; serial?: string; capacidad?: string }) =>
  api.patch<ApiResponse<unknown>>(`/servicios/${servicioId}/equipo`, data);

export const registrarEquipo = (servicioId: string, data: { tipo: string; marca: string; modelo?: string; serial?: string; capacidad?: string }) =>
  api.post<ApiResponse<unknown>>(`/servicios/${servicioId}/equipo`, data);
