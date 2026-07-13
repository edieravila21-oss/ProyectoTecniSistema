export type Rol = 'admin' | 'tecnico';
export type Especialidad = 'aires' | 'neveras' | 'ambos';
export type TipoEquipo = 'aire_acondicionado' | 'nevera' | 'otro';
export type EstadoServicio = 'pendiente' | 'asignado' | 'en_camino' | 'en_servicio' | 'pausado' | 'completado' | 'cancelado';
export type MetodoPago = 'efectivo' | 'transferencia' | 'link_pago';
export type OrigenServicio = 'whatsapp' | 'manual';
export type CategoriaChecklist = 'llegada' | 'diagnostico' | 'reparacion' | 'cierre';
export type TipoFoto = 'antes' | 'durante' | 'despues';
export type TipoEvento = 'creado' | 'asignado' | 'en_camino' | 'llegada' | 'en_servicio' | 'pausado' | 'completado' | 'cancelado' | 'nota' | 'foto_subida' | 'checklist_item';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  telefono?: string;
  foto_url?: string;
  activo: boolean;
  especialidad: Especialidad;
  createdAt: string;
  estadisticas?: {
    total_servicios: number;
    completados: number;
    calificacion_promedio: number;
  };
}

export interface DireccionCliente {
  id: string;
  clienteId: string;
  nombre: string;
  direccion: string;
  principal: boolean;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  email?: string;
  direccion_principal?: string;
  notas?: string;
  total_servicios?: number;
  ultimo_servicio?: string;
  total_gastado?: number;
  equipos?: Equipo[];
  servicios?: Servicio[];
  direcciones?: DireccionCliente[];
  createdAt: string;
}

export interface Equipo {
  id: string;
  clienteId: string;
  tipo: TipoEquipo;
  marca?: string;
  modelo?: string;
  serial?: string;
  notas?: string;
}

export interface Servicio {
  id: string;
  clienteId: string;
  equipoId?: string;
  tecnicoId?: string;
  estado: EstadoServicio;
  tipo_servicio?: 'mantenimiento' | 'reparacion' | 'instalacion' | 'diagnostico';
  descripcion_falla?: string;
  fecha_programada?: string;
  hora_inicio?: string;
  hora_fin?: string;
  fecha_en_camino?: string;
  fecha_inicio_real?: string;
  fecha_fin_real?: string;
  direccion_servicio?: string;
  valor_estimado?: number;
  valor_final?: number;
  metodo_pago?: MetodoPago;
  calificacion_cliente?: number;
  notas_admin?: string;
  notas_tecnico?: string;
  nota_pausa?: string;
  fecha_pausa?: string;
  falla_confirmada?: boolean;
  diagnostico_final?: string;
  repuestos?: { nombre: string; cantidad: number; precio_unitario: number }[];
  factura_url?: string;
  factura_subida_at?: string;
  origen: OrigenServicio;
  createdAt: string;
  sla_ejecucion?: {
    max_min: number;
    real_min: number | null;
    excedido: boolean | null;
  };
  cliente?: Cliente;
  tecnico?: Pick<Usuario, 'id' | 'nombre' | 'foto_url'>;
  equipo?: Equipo;
  checklist?: ChecklistItem[];
  fotos?: FotoServicio[];
  firma?: FirmaCliente;
  eventos?: EventoServicio[];
}

export interface ChecklistItem {
  id: string;
  servicioId: string;
  categoria: CategoriaChecklist;
  descripcion: string;
  completado: boolean;
  completado_at?: string;
  completado_por?: Pick<Usuario, 'id' | 'nombre'>;
  orden: number;
}

export interface FotoServicio {
  id: string;
  servicioId: string;
  url: string;
  tipo: TipoFoto;
  subida_at: string;
}

export interface FirmaCliente {
  id: string;
  servicioId: string;
  url: string;
  firmado_at: string;
}

export interface EventoServicio {
  id: string;
  servicioId: string;
  usuarioId?: string;
  tipo: TipoEvento;
  descripcion: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  usuario?: Pick<Usuario, 'id' | 'nombre' | 'rol'>;
}

export type TipoBloqueo = 'personal' | 'vacaciones' | 'capacitacion' | 'almuerzo' | 'cita_medica' | 'otro';

export interface EventoCalendario {
  id: string;
  tecnicoId: string;
  titulo: string;
  descripcion?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  tipo: TipoBloqueo;
  todo_el_dia: boolean;
  creadoPorId?: string;
  createdAt: string;
  updatedAt: string;
  tecnico?: Pick<Usuario, 'id' | 'nombre' | 'foto_url'>;
  creadoPor?: Pick<Usuario, 'id' | 'nombre'> & { rol?: string };
}

export type EstadoConversacion = 'nuevo' | 'en_conversacion' | 'agendado' | 'escalado' | 'bot_pausado' | 'completado';

export interface ConversacionWhatsApp {
  id: string;
  telefono: string;
  clienteId?: string;
  nombre?: string;
  estado: EstadoConversacion;
  bot_activo: boolean;
  ultimo_mensaje?: string;
  ultimo_mensaje_at?: string;
  servicioId?: string;
  notas_admin?: string;
  createdAt: string;
  updatedAt: string;
  cliente?: Pick<Cliente, 'id' | 'nombre' | 'telefono'>;
  servicio?: { id: string; estado: EstadoServicio; fecha_programada?: string; descripcion_falla?: string; tecnico?: { nombre: string } };
}

export interface MensajeWhatsApp {
  id: string;
  clienteId?: string;
  telefono: string;
  direccion: 'entrante' | 'saliente';
  contenido: string;
  tipo: 'texto' | 'imagen' | 'audio';
  estado: 'procesado' | 'escalado' | 'pendiente';
  sesion_id?: string;
  createdAt: string;
  cliente?: Pick<Cliente, 'id' | 'nombre'>;
}

export interface MetricasHoy {
  servicios_hoy: number;
  completados: number;
  pendientes: number;
  en_curso: number;
  ingresos_hoy: number;
  mensajes_whatsapp: number;
  tecnicos_activos: TecnicoEstado[];
}

export interface TecnicoEstado {
  id: string;
  nombre: string;
  foto_url?: string;
  estado: string;
  servicios_hoy: number;
  servicio_activo?: { id: string; estado: string; direccion_servicio?: string; fecha_inicio_real?: string; cliente?: { nombre: string } };
}

export interface ConfiguracionSLA {
  id: string;
  tipo_servicio: string;
  max_tiempo_camino_min: number;
  max_tiempo_ejecucion_min: number;
  descripcion?: string;
  activo: boolean;
}

export interface Configuracion {
  id: string;
  nombre_negocio: string;
  telefono_negocio?: string;
  direccion_negocio?: string;
  logo_url?: string;
  hora_inicio: string;
  hora_fin: string;
  valor_diagnostico: number;
  mensaje_bienvenida: string;
  meses_recordatorio: number;
  bot_debounce_ms: number;
  bot_max_espera_ms: number;
  bot_typing_espera_ms: number;
  bot_delay_respuesta_ms: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
  code?: string;
}

export interface Notificacion {
  id: string;
  tipo: string;
  mensaje: string;
  datos?: Record<string, unknown>;
  leida: boolean;
  createdAt: string;
}
