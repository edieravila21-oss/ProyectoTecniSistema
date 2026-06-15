import { useEffect, useState } from 'react';
import { getServicios, crearServicio } from '@/api/servicios';
import { getUsuarios } from '@/api/usuarios';
import { getClientes, getEquipos } from '@/api/clientes';
import { getEventosCalendario, crearEventoCalendario, eliminarEventoCalendario } from '@/api/calendario';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { LoadingSkeleton } from '@/components/shared/LoadingSpinner';
import { toast } from '@/components/shared/Toast';
import { tipoEquipoLabel } from '@/utils/helpers';
import type { Servicio, Usuario, EventoCalendario, Cliente, Equipo } from '@/types';
import {
  ChevronLeft, ChevronRight, X, Users, Calendar, MapPin,
  Phone, Wrench, Sun, Moon, Clock, AlertTriangle, Plus,
  Ban, Coffee, GraduationCap, Stethoscope, Palmtree, CalendarOff, Trash2,
  CheckCircle2, CalendarPlus, Plus as PlusIcon,
} from 'lucide-react';
import {
  format, addDays, isSameDay, isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';

const estadoColor: Record<string, string> = {
  pendiente: 'bg-slate-100 border-slate-300 text-slate-600',
  asignado: 'bg-blue-50 border-blue-300 text-blue-700',
  en_camino: 'bg-amber-50 border-amber-300 text-amber-700',
  en_servicio: 'bg-orange-50 border-orange-300 text-orange-700',
  completado: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  cancelado: 'bg-red-50 border-red-300 text-red-600',
};

const especialidadBadge: Record<string, { label: string; cls: string }> = {
  aires: { label: 'Aires', cls: 'bg-cyan-100 text-cyan-700' },
  neveras: { label: 'Neveras', cls: 'bg-violet-100 text-violet-700' },
  ambos: { label: 'Ambos', cls: 'bg-blue-100 text-blue-700' },
};

const tipoBloqueoConfig: Record<string, { label: string; icon: typeof Ban; color: string; bg: string; border: string }> = {
  personal: { label: 'Personal', icon: Ban, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-300' },
  vacaciones: { label: 'Vacaciones', icon: Palmtree, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-300' },
  capacitacion: { label: 'Capacitación', icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-300' },
  almuerzo: { label: 'Almuerzo', icon: Coffee, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-300' },
  cita_medica: { label: 'Cita médica', icon: Stethoscope, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300' },
  otro: { label: 'Otro', icon: CalendarOff, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-300' },
};

type ModalMode = 'bloqueo' | 'cita';

export const CalendarioTecnicos = () => {
  const [fecha, setFecha] = useState(new Date());
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);
  const [selectedTecnico, setSelectedTecnico] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('bloqueo');
  const [saving, setSaving] = useState(false);

  // Cita form state
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [citaForm, setCitaForm] = useState({
    clienteId: '', equipoId: '', tecnicoId: '',
    tipo_servicio: '', descripcion_falla: '',
    fecha_programada: '', hora_inicio: '08:00', hora_fin: '10:00',
    direccion_servicio: '', valor_estimado: '40000',
  });

  const HORAS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const HORA_INICIO = 7;
  const PX_POR_HORA = 90;

  const parseHora = (hora: string | undefined, fallback = 8) => {
    if (!hora) return fallback;
    const [h, m] = hora.split(':').map(Number);
    return h + (m || 0) / 60;
  };

  const [form, setForm] = useState({
    tecnicoId: '',
    titulo: '',
    descripcion: '',
    fecha: '',
    hora_inicio: '08:00',
    hora_fin: '09:00',
    tipo: 'personal',
    todo_el_dia: false,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const diaStr = format(fecha, 'yyyy-MM-dd');
      const [servRes, tecRes, evtRes] = await Promise.all([
        getServicios({ desde: diaStr, hasta: diaStr, limit: '200' }),
        getUsuarios({ rol: 'tecnico', activo: 'true' }),
        getEventosCalendario({ desde: diaStr, hasta: diaStr }),
      ]);
      setServicios(servRes.data.data);
      setTecnicos(tecRes.data.data);
      setEventos(evtRes.data.data);
    } catch { toast.error('Error cargando calendario'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [fecha]);

  const sinAsignar = servicios.filter(s => !s.tecnicoId);

  const getServiciosDia = (tecnicoId: string) =>
    servicios.filter(s => s.tecnicoId === tecnicoId && s.fecha_programada && isSameDay(new Date(s.fecha_programada), fecha));

  const getEventosDia = (tecnicoId: string) =>
    eventos.filter(e => e.tecnicoId === tecnicoId && isSameDay(new Date(e.fecha), fecha));

  const filteredTecnicos = selectedTecnico
    ? tecnicos.filter(t => t.id === selectedTecnico)
    : tecnicos;

  // Disponibilidad: para el día y horario seleccionados, calcula carga de cada técnico
  const getDisponibilidadTecnicos = () => {
    if (!citaForm.fecha_programada) return [];
    const diaSeleccionado = new Date(citaForm.fecha_programada + 'T00:00:00');
    return tecnicos.map(t => {
      const servsDia = servicios.filter(s =>
        s.tecnicoId === t.id &&
        s.fecha_programada &&
        isSameDay(new Date(s.fecha_programada), diaSeleccionado)
      );
      const bloquesDia = eventos.filter(e =>
        e.tecnicoId === t.id &&
        isSameDay(new Date(e.fecha), diaSeleccionado)
      );
      // Detectar conflicto de horario si hay hora seleccionada
      const horaInicio = parseInt(citaForm.hora_inicio.split(':')[0]) * 60 + parseInt(citaForm.hora_inicio.split(':')[1]);
      const horaFin = parseInt(citaForm.hora_fin.split(':')[0]) * 60 + parseInt(citaForm.hora_fin.split(':')[1]);
      const conflicto = servsDia.some(s => {
        if (!s.hora_inicio || !s.hora_fin) return false;
        const sInicio = parseInt(s.hora_inicio.split(':')[0]) * 60 + parseInt(s.hora_inicio.split(':')[1]);
        const sFin = parseInt(s.hora_fin.split(':')[0]) * 60 + parseInt(s.hora_fin.split(':')[1]);
        return horaInicio < sFin && horaFin > sInicio;
      });
      const bloqueado = bloquesDia.some(e => e.todo_el_dia || (() => {
        if (!e.hora_inicio || !e.hora_fin) return false;
        const eInicio = parseInt(e.hora_inicio.split(':')[0]) * 60 + parseInt(e.hora_inicio.split(':')[1]);
        const eFin = parseInt(e.hora_fin.split(':')[0]) * 60 + parseInt(e.hora_fin.split(':')[1]);
        return horaInicio < eFin && horaFin > eInicio;
      })());
      return { tecnico: t, servsDia: servsDia.length, bloquesDia: bloquesDia.length, conflicto, bloqueado, libre: !conflicto && !bloqueado };
    }).sort((a, b) => (a.libre ? -1 : 1) - (b.libre ? -1 : 1) || a.servsDia - b.servsDia);
  };

  const esFinDeSemana = (fechaStr: string) => {
    if (!fechaStr) return false;
    const d = new Date(fechaStr + 'T00:00:00').getDay();
    return d === 0 || d === 6;
  };

  const openCreateModal = (tecnicoId?: string, dia?: Date, mode: ModalMode = 'bloqueo') => {
    const fechaStr = dia ? format(dia, 'yyyy-MM-dd') : format(fecha, 'yyyy-MM-dd');
    setModalMode(mode);
    setForm({
      tecnicoId: tecnicoId || (tecnicos.length > 0 ? tecnicos[0].id : ''),
      titulo: '',
      descripcion: '',
      fecha: fechaStr,
      hora_inicio: '08:00',
      hora_fin: '09:00',
      tipo: 'personal',
      todo_el_dia: false,
    });
    setCitaForm(f => ({ ...f, tecnicoId: tecnicoId || '', fecha_programada: fechaStr }));
    if (mode === 'cita') {
      getClientes({}).then(r => setClientes(r.data.data)).catch(() => {});
    }
    setShowModal(true);
  };

  const handleClienteCitaChange = async (clienteId: string) => {
    setCitaForm(f => ({ ...f, clienteId, equipoId: '' }));
    if (clienteId) {
      try {
        const { data: res } = await getEquipos(clienteId);
        setEquipos(res.data);
        // Pre-fill address from client
        const cliente = clientes.find(c => c.id === clienteId);
        if (cliente?.direccion_principal) setCitaForm(f => ({ ...f, clienteId, direccion_servicio: cliente.direccion_principal || '' }));
      } catch { setEquipos([]); }
    }
  };

  const handleCrearCita = async () => {
    if (!citaForm.clienteId) { toast.error('Selecciona un cliente'); return; }
    if (!citaForm.fecha_programada) { toast.error('Selecciona una fecha'); return; }
    if (esFinDeSemana(citaForm.fecha_programada)) { toast.error('Solo se pueden agendar citas de lunes a viernes'); return; }
    if (!citaForm.hora_inicio) { toast.error('Selecciona la hora'); return; }
    setSaving(true);
    try {
      await crearServicio({
        ...citaForm,
        valor_estimado: parseFloat(citaForm.valor_estimado) || undefined,
        equipoId: citaForm.equipoId || undefined,
        tecnicoId: citaForm.tecnicoId || undefined,
        origen: 'manual',
      } as any);
      toast.success('Cita agendada correctamente');
      setShowModal(false);
      fetchData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error creando cita'); }
    finally { setSaving(false); }
  };

  const handleCrear = async () => {
    if (!form.titulo.trim()) { toast.error('Escribe un título'); return; }
    if (!form.tecnicoId) { toast.error('Selecciona un técnico'); return; }
    setSaving(true);
    try {
      await crearEventoCalendario({
        tecnicoId: form.tecnicoId,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || undefined,
        fecha: form.fecha,
        hora_inicio: form.todo_el_dia ? '00:00' : form.hora_inicio,
        hora_fin: form.todo_el_dia ? '23:59' : form.hora_fin,
        tipo: form.tipo as any,
        todo_el_dia: form.todo_el_dia,
      });
      toast.success('Evento creado');
      setShowModal(false);
      fetchData();
    } catch { toast.error('Error creando evento'); }
    finally { setSaving(false); }
  };

  const handleEliminarEvento = async (id: string) => {
    try {
      await eliminarEventoCalendario(id);
      toast.success('Evento eliminado');
      fetchData();
    } catch { toast.error('Error eliminando evento'); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" /> Calendario de Técnicos
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Vista semanal de disponibilidad — {tecnicos.length} técnicos activos
          </p>
        </div>
        <Button
          onClick={() => openCreateModal(undefined, undefined, 'cita')}
          className="rounded-xl gap-1.5"
        >
          <CalendarPlus className="h-4 w-4" />
          Nueva cita / bloqueo
        </Button>
      </div>

      {/* Controls */}
      <Card className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFecha(d => addDays(d, -1))} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <div className="px-4 py-2 text-sm font-semibold text-slate-700 min-w-[260px] text-center capitalize">
              {format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es })}
            </div>
            <button onClick={() => setFecha(d => addDays(d, 1))} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
          <Button variant="outline" size="sm" className={`rounded-xl ${isToday(fecha) ? 'border-blue-400 text-blue-600' : ''}`} onClick={() => setFecha(new Date())}>
            Hoy
          </Button>

          {/* Technician filter */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setSelectedTecnico(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${!selectedTecnico ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
            >
              Todos
            </button>
            {tecnicos.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTecnico(selectedTecnico === t.id ? null : t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  selectedTecnico === t.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${selectedTecnico === t.id ? 'bg-white' : 'bg-blue-400'}`} />
                {t.nombre.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Unassigned alert */}
      {sinAsignar.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 p-4">
          <h3 className="font-semibold text-amber-700 mb-2 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" /> {sinAsignar.length} servicios sin técnico asignado
          </h3>
          <div className="flex flex-wrap gap-2">
            {sinAsignar.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedServicio(s)}
                className="bg-white px-3 py-2 rounded-xl border border-amber-200 text-xs hover:shadow-md transition-all text-left"
              >
                <span className="font-semibold text-slate-700">{s.cliente?.nombre}</span>
                <span className="text-slate-400 ml-1.5">{s.hora_inicio || '--:--'}</span>
                {s.fecha_programada && (
                  <span className="text-amber-600 ml-1.5">{format(new Date(s.fecha_programada), 'd MMM', { locale: es })}</span>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {loading ? <LoadingSkeleton rows={6} /> : (
        <>
          {/* Timeline diaria */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ minWidth: 160 + HORAS.length * PX_POR_HORA }}>

                {/* Cabecera de horas */}
                <div className="flex border-b border-slate-200 bg-slate-50/80">
                  <div className="shrink-0 border-r border-slate-200 p-3" style={{ width: 160 }}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Técnico</span>
                  </div>
                  <div className="flex flex-1">
                    {HORAS.map(h => (
                      <div key={h} style={{ width: PX_POR_HORA }} className="text-center py-2 border-l border-slate-100 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400">{String(h).padStart(2, '0')}:00</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filas de técnicos */}
                {filteredTecnicos.map((tec, idx) => {
                  const servsDia = getServiciosDia(tec.id);
                  const evtsDia = getEventosDia(tec.id);
                  const esp = especialidadBadge[tec.especialidad] || especialidadBadge.ambos;
                  const esHoy = isToday(fecha);
                  const nowH = new Date().getHours() + new Date().getMinutes() / 60;
                  const totalWidth = HORAS.length * PX_POR_HORA;

                  return (
                    <div key={tec.id} className={`flex border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      {/* Info técnico */}
                      <div
                        className={`shrink-0 p-3 border-r border-slate-200 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}`}
                        style={{ width: 160 }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {tec.nombre.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-800 truncate">{tec.nombre}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${esp.cls}`}>{esp.label}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          {servsDia.length > 0 ? (
                            <span className="text-[10px] text-slate-500 font-medium">{servsDia.length} servicio{servsDia.length !== 1 ? 's' : ''}</span>
                          ) : evtsDia.length === 0 ? (
                            <span className="text-[10px] text-emerald-600 font-bold">LIBRE</span>
                          ) : null}
                          {evtsDia.length > 0 && (
                            <span className="text-[10px] text-red-400">{evtsDia.length} bloq.</span>
                          )}
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="relative" style={{ width: totalWidth, height: 80 }}>
                        {/* Líneas de hora */}
                        {HORAS.map(h => (
                          <div key={h} style={{ left: (h - HORA_INICIO) * PX_POR_HORA }} className="absolute top-0 bottom-0 w-px bg-slate-100" />
                        ))}

                        {/* Indicador hora actual */}
                        {esHoy && nowH >= HORA_INICIO && nowH <= HORA_INICIO + HORAS.length && (
                          <div
                            style={{ left: (nowH - HORA_INICIO) * PX_POR_HORA }}
                            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20"
                          >
                            <div className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-red-400" />
                          </div>
                        )}

                        {/* Eventos todo el día */}
                        {evtsDia.filter(e => e.todo_el_dia).map(evt => {
                          const cfg = tipoBloqueoConfig[evt.tipo] || tipoBloqueoConfig.otro;
                          const Icon = cfg.icon;
                          return (
                            <div key={evt.id} className={`absolute inset-x-1 top-1 bottom-1 rounded-lg border px-2 flex items-center gap-1.5 ${cfg.bg} ${cfg.border} group`}>
                              <Icon className={`h-3 w-3 ${cfg.color} shrink-0`} />
                              <span className={`text-[10px] font-bold ${cfg.color} truncate flex-1`}>{evt.titulo}</span>
                              <span className={`text-[10px] ${cfg.color} opacity-60`}>Todo el día</span>
                              <button onClick={() => handleEliminarEvento(evt.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Eventos con hora */}
                        {evtsDia.filter(e => !e.todo_el_dia).map(evt => {
                          const cfg = tipoBloqueoConfig[evt.tipo] || tipoBloqueoConfig.otro;
                          const Icon = cfg.icon;
                          const startH = parseHora(evt.hora_inicio, HORA_INICIO);
                          const endH = parseHora(evt.hora_fin, startH + 1);
                          const left = Math.max(0, (startH - HORA_INICIO) * PX_POR_HORA);
                          const width = Math.max(40, (endH - startH) * PX_POR_HORA);
                          return (
                            <div
                              key={evt.id}
                              style={{ left, width, top: 4, bottom: 4, position: 'absolute' }}
                              className={`rounded-lg border px-2 flex items-center gap-1 overflow-hidden ${cfg.bg} ${cfg.border} group`}
                            >
                              <Icon className={`h-3 w-3 ${cfg.color} shrink-0`} />
                              <div className="min-w-0 flex-1">
                                <p className={`text-[10px] font-bold ${cfg.color} truncate`}>{evt.titulo}</p>
                                <p className={`text-[9px] ${cfg.color} opacity-60`}>{evt.hora_inicio}–{evt.hora_fin}</p>
                              </div>
                              <button onClick={() => handleEliminarEvento(evt.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Trash2 className="h-3 w-3 text-red-400" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Servicios */}
                        {servsDia.map(s => {
                          const startH = parseHora(s.hora_inicio, 8);
                          const endH = parseHora(s.hora_fin, startH + 1.5);
                          const left = Math.max(0, (startH - HORA_INICIO) * PX_POR_HORA);
                          const width = Math.max(60, (endH - startH) * PX_POR_HORA);
                          return (
                            <button
                              key={s.id}
                              style={{ left, width, top: 4, bottom: 4, position: 'absolute' }}
                              onClick={() => setSelectedServicio(s)}
                              className={`rounded-lg border text-left px-2 overflow-hidden hover:shadow-lg hover:z-30 transition-all z-10 ${estadoColor[s.estado]}`}
                            >
                              <p className="text-[10px] font-bold truncate">{s.hora_inicio}–{s.hora_fin}</p>
                              <p className="text-[11px] font-semibold truncate leading-tight">{s.cliente?.nombre}</p>
                              {s.equipo && <p className="text-[9px] opacity-60 truncate">{tipoEquipoLabel[s.equipo.tipo]}</p>}
                            </button>
                          );
                        })}

                        {/* Sin nada */}
                        {servsDia.length === 0 && evtsDia.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              onClick={() => openCreateModal(tec.id, fecha, 'cita')}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-slate-200 text-slate-300 hover:text-blue-500 hover:border-blue-300 transition-colors text-[10px] font-semibold"
                            >
                              <Plus className="h-3 w-3" /> Agendar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-4 px-1">
            {[
              { label: 'Pendiente', color: 'bg-slate-400' },
              { label: 'Asignado', color: 'bg-blue-500' },
              { label: 'En camino', color: 'bg-amber-500' },
              { label: 'En servicio', color: 'bg-orange-500' },
              { label: 'Completado', color: 'bg-emerald-500' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${color}`} />
                <span className="text-[11px] text-slate-500">{label}</span>
              </div>
            ))}
            <div className="h-3 w-px bg-slate-200 mx-1" />
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-0.5 bg-red-400 rounded" />
              <span className="text-[11px] text-slate-500">Hora actual</span>
            </div>
          </div>
        </>
      )}

      {/* Service detail slide-over */}
      {selectedServicio && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedServicio(null)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-800 text-lg">Detalle del Servicio</h3>
              <button onClick={() => setSelectedServicio(null)} className="p-2 rounded-xl hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center justify-between">
                <EstadoBadge estado={selectedServicio.estado} />
                {selectedServicio.origen === 'whatsapp' && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg font-medium">vía WhatsApp</span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                  <Users className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Cliente</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedServicio.cliente?.nombre}</p>
                    {selectedServicio.cliente?.telefono && (
                      <a href={`tel:${selectedServicio.cliente.telefono}`} className="text-xs text-blue-500 flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" /> {selectedServicio.cliente.telefono}
                      </a>
                    )}
                  </div>
                </div>

                {selectedServicio.tecnico && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <Wrench className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase">Técnico Asignado</p>
                      <p className="text-sm font-bold text-blue-800 mt-0.5">{selectedServicio.tecnico.nombre}</p>
                    </div>
                  </div>
                )}

                {!selectedServicio.tecnico && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-amber-700">Sin técnico asignado</p>
                      <p className="text-xs text-amber-600 mt-0.5">Asigna un técnico desde Servicios</p>
                    </div>
                  </div>
                )}

                {selectedServicio.fecha_programada && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Fecha Programada</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5 capitalize">
                        {format(new Date(selectedServicio.fecha_programada), "EEEE d 'de' MMMM yyyy", { locale: es })}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {selectedServicio.hora_inicio || '--'} — {selectedServicio.hora_fin || '--'}
                      </p>
                    </div>
                  </div>
                )}

                {selectedServicio.direccion_servicio && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Dirección</p>
                      <p className="text-sm text-slate-700 mt-0.5">{selectedServicio.direccion_servicio}</p>
                    </div>
                  </div>
                )}

                {selectedServicio.equipo && (
                  <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <Wrench className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Equipo</p>
                      <p className="text-sm text-slate-700 mt-0.5">
                        {tipoEquipoLabel[selectedServicio.equipo.tipo]} {selectedServicio.equipo.marca} {selectedServicio.equipo.modelo}
                      </p>
                    </div>
                  </div>
                )}

                {selectedServicio.descripcion_falla && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-500 uppercase">Falla Reportada</p>
                    <p className="text-sm text-amber-800 mt-1">{selectedServicio.descripcion_falla}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {selectedServicio.valor_estimado != null && (
                    <div className="p-3 bg-slate-50 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Estimado</p>
                      <p className="text-lg font-black text-slate-700">${selectedServicio.valor_estimado.toLocaleString()}</p>
                    </div>
                  )}
                  {selectedServicio.valor_final != null && (
                    <div className="p-3 bg-emerald-50 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase">Cobrado</p>
                      <p className="text-lg font-black text-emerald-700">${selectedServicio.valor_final.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear evento/bloqueo o agendar cita */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">

            {/* Header con pestañas */}
            <div className="p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">
                  {modalMode === 'cita' ? 'Agendar cita' : 'Bloquear horario'}
                </h3>
                <button onClick={() => setShowModal(false)} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center">
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setModalMode('cita')}
                  className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${modalMode === 'cita' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                  <CalendarPlus className="h-3.5 w-3.5" /> Agendar cita
                </button>
                <button
                  onClick={() => setModalMode('bloqueo')}
                  className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${modalMode === 'bloqueo' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                  <Ban className="h-3.5 w-3.5" /> Bloquear horario
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* ── MODO CITA ── */}
              {modalMode === 'cita' && (
                <div className="p-5 space-y-4">
                  {/* Fecha primero para computar disponibilidad */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Fecha <span className="text-slate-400 font-normal">(Lun–Vie)</span></label>
                      <input
                        type="date"
                        value={citaForm.fecha_programada}
                        onChange={e => {
                          const v = e.target.value;
                          if (esFinDeSemana(v)) { toast.error('Solo lunes a viernes'); return; }
                          setCitaForm(f => ({ ...f, fecha_programada: v }));
                        }}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Inicio</label>
                      <input type="time" value={citaForm.hora_inicio}
                        onChange={e => setCitaForm(f => ({ ...f, hora_inicio: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Fin</label>
                      <input type="time" value={citaForm.hora_fin}
                        onChange={e => setCitaForm(f => ({ ...f, hora_fin: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Tipo servicio</label>
                      <select value={citaForm.tipo_servicio}
                        onChange={e => setCitaForm(f => ({ ...f, tipo_servicio: e.target.value }))}
                        className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Tipo</option>
                        <option value="diagnostico">Diagnóstico</option>
                        <option value="mantenimiento">Mantenimiento</option>
                        <option value="reparacion">Reparación</option>
                        <option value="instalacion">Instalación</option>
                      </select>
                    </div>
                  </div>

                  {/* Panel disponibilidad técnicos */}
                  {citaForm.fecha_programada && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-2 block">
                        Disponibilidad — {format(new Date(citaForm.fecha_programada + 'T00:00:00'), "EEEE d MMM", { locale: es })}
                        <span className="font-normal ml-1">{citaForm.hora_inicio}–{citaForm.hora_fin}</span>
                      </label>
                      <div className="space-y-2">
                        {getDisponibilidadTecnicos().map(({ tecnico, servsDia, conflicto, bloqueado }) => {
                          const selected = citaForm.tecnicoId === tecnico.id;
                          return (
                            <button
                              key={tecnico.id}
                              onClick={() => !bloqueado && setCitaForm(f => ({ ...f, tecnicoId: tecnico.id }))}
                              disabled={bloqueado}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                                selected ? 'border-blue-500 bg-blue-50' :
                                bloqueado ? 'border-red-100 bg-red-50/40 opacity-60 cursor-not-allowed' :
                                conflicto ? 'border-amber-200 bg-amber-50/40' :
                                'border-slate-100 hover:border-blue-200 hover:bg-blue-50/20'
                              }`}
                            >
                              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {tecnico.nombre.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800">{tecnico.nombre}</p>
                                <p className="text-[11px] text-slate-500">{servsDia} servicio{servsDia !== 1 ? 's' : ''} hoy</p>
                              </div>
                              <div className="shrink-0">
                                {bloqueado ? (
                                  <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-200">BLOQUEADO</span>
                                ) : conflicto ? (
                                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">CONFLICTO</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> LIBRE
                                  </span>
                                )}
                              </div>
                              {selected && <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cliente y equipo */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Cliente *</label>
                    <select value={citaForm.clienteId}
                      onChange={e => handleClienteCitaChange(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="">Seleccionar cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.telefono}</option>)}
                    </select>
                  </div>

                  {equipos.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Equipo</label>
                      <select value={citaForm.equipoId}
                        onChange={e => setCitaForm(f => ({ ...f, equipoId: e.target.value }))}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Seleccionar equipo (opcional)</option>
                        {equipos.map(eq => <option key={eq.id} value={eq.id}>{tipoEquipoLabel[eq.tipo]} {eq.marca} {eq.modelo}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Dirección del servicio</label>
                    <input type="text" value={citaForm.direccion_servicio}
                      onChange={e => setCitaForm(f => ({ ...f, direccion_servicio: e.target.value }))}
                      placeholder="Dirección donde se realizará el servicio"
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Descripción de la falla / motivo</label>
                    <textarea value={citaForm.descripcion_falla}
                      onChange={e => setCitaForm(f => ({ ...f, descripcion_falla: e.target.value }))}
                      placeholder="Describe la falla o motivo de la visita..."
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Valor estimado</label>
                    <input type="number" value={citaForm.valor_estimado}
                      onChange={e => setCitaForm(f => ({ ...f, valor_estimado: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              {/* ── MODO BLOQUEO ── */}
              {modalMode === 'bloqueo' && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Técnico</label>
                    <select value={form.tecnicoId}
                      onChange={e => setForm(f => ({ ...f, tecnicoId: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-2 block">Tipo de evento</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(tipoBloqueoConfig).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        const selected = form.tipo === key;
                        return (
                          <button key={key} onClick={() => setForm(f => ({ ...f, tipo: key }))}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                            <Icon className={`h-5 w-5 ${selected ? 'text-blue-600' : cfg.color}`} />
                            <span className={`text-[10px] font-semibold ${selected ? 'text-blue-700' : 'text-slate-500'}`}>{cfg.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Título</label>
                    <input type="text" value={form.titulo}
                      onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                      placeholder="Ej: Vacaciones, Capacitación AC inverter"
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Descripción (opcional)</label>
                    <textarea value={form.descripcion}
                      onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Detalles adicionales..." rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Fecha</label>
                    <input type="date" value={form.fecha}
                      onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`relative w-11 h-6 rounded-full transition-colors ${form.todo_el_dia ? 'bg-blue-600' : 'bg-slate-200'}`}
                      onClick={() => setForm(f => ({ ...f, todo_el_dia: !f.todo_el_dia }))}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.todo_el_dia ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">Todo el día</span>
                  </label>
                  {!form.todo_el_dia && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Hora inicio</label>
                        <input type="time" value={form.hora_inicio}
                          onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Hora fin</label>
                        <input type="time" value={form.hora_fin}
                          onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                          className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
              <button onClick={() => setShowModal(false)}
                className="flex-1 h-12 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={modalMode === 'cita' ? handleCrearCita : handleCrear}
                disabled={saving || (modalMode === 'bloqueo' && !form.titulo.trim()) || (modalMode === 'cita' && !citaForm.clienteId)}
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                {saving ? 'Guardando...' : modalMode === 'cita' ? 'Agendar cita' : 'Crear evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
