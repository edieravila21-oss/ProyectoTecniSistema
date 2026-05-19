import api from './client';
import type { ApiResponse, Configuracion } from '@/types';

export const getConfiguracion = () =>
  api.get<ApiResponse<Configuracion>>('/configuracion');

export const actualizarConfiguracion = (data: Partial<Configuracion>) =>
  api.put<ApiResponse<Configuracion>>('/configuracion', data);
