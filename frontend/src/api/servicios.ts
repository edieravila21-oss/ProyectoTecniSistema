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

export const cambiarEstadoServicio = (id: string, estado: string, extra?: { motivo_cancelacion?: string; nota_pausa?: string; fecha_reanudacion?: string; hora_reanudacion?: string }) =>
  api.patch<ApiResponse<Servicio>>(`/servicios/${id}/estado`, { estado, ...extra });

export const asignarTecnico = (id: string, tecnico_id: string) =>
  api.patch<ApiResponse<Servicio>>(`/servicios/${id}/asignar`, { tecnico_id });

export const getChecklist = (servicioId: string) =>
  api.get<ApiResponse<ChecklistItem[]>>(`/servicios/${servicioId}/checklist`);

export const marcarChecklistItem = (servicioId: string, itemId: string) =>
  api.patch<ApiResponse<ChecklistItem>>(`/servicios/${servicioId}/checklist/${itemId}`);

export const subirFoto = (
  servicioId: string,
  formData: FormData,
  onUploadProgress?: (pct: number) => void
) =>
  api.post<ApiResponse<{ url: string }>>(`/servicios/${servicioId}/fotos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...(onUploadProgress && {
      onUploadProgress: (e: { loaded: number; total?: number }) => {
        if (e.total) onUploadProgress(Math.round((e.loaded / e.total) * 100));
      },
    }),
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

export const eliminarFoto = (servicioId: string, fotoId: string) =>
  api.delete<ApiResponse<unknown>>(`/servicios/${servicioId}/fotos/${fotoId}`);

export const corregirEquipo = (servicioId: string, data: { marca?: string; modelo?: string; serial?: string; capacidad?: string }) =>
  api.patch<ApiResponse<unknown>>(`/servicios/${servicioId}/equipo`, data);

export const registrarEquipo = (servicioId: string, data: { tipo: string; marca: string; modelo?: string; serial?: string; capacidad?: string }) =>
  api.post<ApiResponse<unknown>>(`/servicios/${servicioId}/equipo`, data);

export const cerrarServiciosVencidos = () =>
  api.post<ApiResponse<{ cerrados: number }>>('/servicios/cerrar-vencidos');
