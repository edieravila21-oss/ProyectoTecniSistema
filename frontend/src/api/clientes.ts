import api from './client';
import type { ApiResponse, Cliente, Equipo, DireccionCliente } from '@/types';

export const getClientes = (params?: Record<string, string>) =>
  api.get<ApiResponse<Cliente[]>>('/clientes', { params });

export const getCliente = (id: string) =>
  api.get<ApiResponse<Cliente>>(`/clientes/${id}`);

export const crearCliente = (data: Partial<Cliente>) =>
  api.post<ApiResponse<Cliente>>('/clientes', data);

export const actualizarCliente = (id: string, data: Partial<Cliente>) =>
  api.put<ApiResponse<Cliente>>(`/clientes/${id}`, data);

export const getEquipos = (clienteId: string) =>
  api.get<ApiResponse<Equipo[]>>(`/clientes/${clienteId}/equipos`);

export const crearEquipo = (clienteId: string, data: Partial<Equipo>) =>
  api.post<ApiResponse<Equipo>>(`/clientes/${clienteId}/equipos`, data);

export const getHistorialCliente = (clienteId: string) =>
  api.get<ApiResponse<any>>(`/clientes/${clienteId}/historial`);

export const getDirecciones = (clienteId: string) =>
  api.get<ApiResponse<DireccionCliente[]>>(`/clientes/${clienteId}/direcciones`);

export const agregarDireccion = (clienteId: string, data: Partial<DireccionCliente>) =>
  api.post<ApiResponse<DireccionCliente>>(`/clientes/${clienteId}/direcciones`, data);

export const actualizarDireccion = (clienteId: string, dirId: string, data: Partial<DireccionCliente>) =>
  api.put<ApiResponse<DireccionCliente>>(`/clientes/${clienteId}/direcciones/${dirId}`, data);

export const eliminarDireccion = (clienteId: string, dirId: string) =>
  api.delete<ApiResponse<void>>(`/clientes/${clienteId}/direcciones/${dirId}`);
