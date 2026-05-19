import api from './client';
import type { ApiResponse, MetricasHoy } from '@/types';

export const getMetricasHoy = () =>
  api.get<ApiResponse<MetricasHoy>>('/metricas/hoy');

export const getResumen = (params?: Record<string, string>) =>
  api.get<ApiResponse<unknown>>('/metricas/resumen', { params });

export const getMetricasTecnicos = (params?: Record<string, string>) =>
  api.get<ApiResponse<unknown[]>>('/metricas/tecnicos', { params });

export const getMetricasEquipos = (params?: Record<string, string>) =>
  api.get<ApiResponse<unknown>>('/metricas/equipos', { params });

export const getMetricasCanales = (params?: Record<string, string>) =>
  api.get<ApiResponse<unknown>>('/metricas/canales', { params });

export const getMetricasSLA = (params?: Record<string, string>) =>
  api.get<ApiResponse<unknown>>('/metricas/sla', { params });
