import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const getEvaluaciones = (params?: any) => axios.get(`${API_URL}/evaluaciones`, { params });
export const crearEvaluacion = (data: any) => axios.post(`${API_URL}/evaluaciones`, data);
export const obtenerEvaluacion = (id: string) => axios.get(`${API_URL}/evaluaciones/${id}`);
export const eliminarEvaluacion = (id: string) => axios.delete(`${API_URL}/evaluaciones/${id}`);
