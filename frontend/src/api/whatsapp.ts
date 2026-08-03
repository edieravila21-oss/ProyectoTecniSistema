import api from './client';
import type { ApiResponse, ConversacionWhatsApp, MensajeWhatsApp } from '@/types';

export const getConversaciones = () =>
  api.get<ApiResponse<ConversacionWhatsApp[]>>('/whatsapp/conversaciones');

export const getConversacion = (telefono: string) =>
  api.get<ApiResponse<{ conversacion: ConversacionWhatsApp; mensajes: MensajeWhatsApp[] }>>(`/whatsapp/conversacion/${telefono}`);

export const cambiarEstadoConversacion = (telefono: string, estado: string) =>
  api.patch<ApiResponse<ConversacionWhatsApp>>(`/whatsapp/conversacion/${telefono}/estado`, { estado });

export const toggleBotConversacion = (telefono: string) =>
  api.patch<ApiResponse<ConversacionWhatsApp>>(`/whatsapp/conversacion/${telefono}/bot`);

export const agregarNotaConversacion = (telefono: string, notas_admin: string) =>
  api.patch<ApiResponse<ConversacionWhatsApp>>(`/whatsapp/conversacion/${telefono}/notas`, { notas_admin });

export const getEstadoBot = () =>
  api.get<ApiResponse<{ conectado: boolean; numero_conectado: string | null }>>('/whatsapp/estado');

export const conectarBot = () =>
  api.post<ApiResponse<{ message: string }>>('/whatsapp/conectar');

export const desconectarBot = () =>
  api.post<ApiResponse<{ message: string }>>('/whatsapp/desconectar');

export const eliminarConversacion = (telefono: string) =>
  api.delete<ApiResponse<{ message: string }>>(`/whatsapp/conversacion/${telefono}`);

export const enviarEncuesta = (telefono: string) =>
  api.post<ApiResponse<{ message: string }>>('/whatsapp/enviar-encuesta', { telefono });

export const enviarMensajeAdmin = (telefono: string, mensaje: string) =>
  api.post<ApiResponse<unknown>>(`/whatsapp/conversacion/${telefono}/enviar`, { mensaje });
