import api from './client';
import type { ApiResponse, ConfiguracionSLA } from '@/types';

export const getSlaConfigs = () =>
  api.get<ApiResponse<ConfiguracionSLA[]>>('/sla-config');

export const getSlaConfigByTipo = (tipo_servicio: string) =>
  api.get<ApiResponse<ConfiguracionSLA>>(`/sla-config/${tipo_servicio}`);
