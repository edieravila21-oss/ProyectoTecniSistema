import api from './client';
import type { ApiResponse, Usuario } from '@/types';

export const loginApi = (email: string, pin: string) =>
  api.post<ApiResponse<{ token: string; usuario: Usuario }>>('/auth/login', { email, pin });

export const getMe = () =>
  api.get<ApiResponse<Usuario>>('/auth/me');

export const refreshToken = () =>
  api.post<ApiResponse<{ token: string }>>('/auth/refresh');

export const forgotPassword = (email: string) =>
  api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email });

export const resetPassword = (token: string, nuevo_pin: string) =>
  api.post<ApiResponse<{ message: string }>>('/auth/reset-password', { token, nuevo_pin });

export const cambiarPin = (pin_actual: string, pin_nuevo: string) =>
  api.put<ApiResponse<{ message: string }>>('/auth/cambiar-pin', { pin_actual, pin_nuevo });
