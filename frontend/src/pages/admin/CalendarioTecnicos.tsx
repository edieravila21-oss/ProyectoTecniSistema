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
  CheckCircle2, CalendarPlus,
} from 'lucide-react';
import {
  format, addDays, addWeeks, subWeeks,
  startOfWeek, endOfWeek, isSameDay, isToday,
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

  const weekStart = startOfWeek(fecha, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(fecha, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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
      const [servRes, tecRes, evtRes] = await Promise.all([
        getServicios({
          desde: format(weekStart, 'yyyy-MM-dd'),
          hasta: format(weekEnd, 'yyyy-MM-dd'),
          limit: '200',
        }),
        getUsuarios({ rol: 'tecnico', activo: 'true' }),
        getEventosCalendario({
          desde: format(weekStart, 'yyyy-MM-dd'),
          hasta: format(weekEnd, 'yyyy-MM-dd'),
        }),
      ]);
      setServicios(servRes.data.data);
      setTecnicos(tecRes.data.data);
      setEventos(evtRes.data.data);
    } catch { toast.error('Error cargando calendario'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [fecha]);

  const getServiciosForCell = (tecnicoId: string, dia: Date, turno: 'AM' | 'PM') =>
    servicios.filter(s => {
      if (s.tecnicoId !== tecnicoId || !s.fecha_programada) return false;
      if (!isSameDay(new Date(s.fecha_programada), dia)) return false;
      const hora = parseInt(s.hora_inicio || '08');
      return turno === 'AM' ? hora < 13 : hora >= 13;
    });

  const getEventosForCell = (tecnicoId: string, dia: Date, turno: 'AM' | 'PM') =>
    eventos.filter(e => {
      if (e.tecnicoId !== tecnicoId) return false;
      if (!isSameDay(new Date(e.fecha), dia)) return false;
      if (e.todo_el_dia) return true;
      const hora = parseInt(e.hora_inicio || '08');
      return turno === 'AM' ? hora < 13 : hora >= 13;
    });

  const getTotalForDay = (tecnicoId: string, dia: Date) =>
    servicios.filter(s => s.tecnicoId === tecnicoId && s.fecha_programada && isSameDay(new Date(s.fecha_programada), dia));

  const sinAsignar = servicios.filter(s => !s.tecnicoId);

  const getWeekStats = (tecnicoId: string) => {
    const servsTec = servicios.filter(s => s.tecnicoId === tecnicoId);
    const completados = servsTec.filter(s => s.estado === 'completado').length;
    const activos = servsTec.filter(s => !['completado', 'cancelado'].includes(s.estado)).length;
    const slotsOcupados = servsTec.length;
    const bloqueos = eventos.filter(e => e.tecnicoId === tecnicoId).length;
    return { completados, activos, slotsOcupados, total: servsTec.length, bloqueos };
  };

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
    const fechaStr = dia ? format(dia, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
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
            <button onClick={() => setFecha(d => subWeeks(d, 1))} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <div className="px-4 py-2 text-sm font-semibold text-slate-700 min-w-[260px] text-center capitalize">
              {format(weekStart, "d MMM", { locale: es })} — {format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}
            </div>
            <button onClick={() => setFecha(d => addWeeks(d, 1))} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50">
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setFecha(new Date())}>
            Esta semana
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
          {/* Resource Grid */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="text-left p-3 w-[200px] sticky left-0 bg-slate-50/80 z-10 backdrop-blur-sm border-r border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Técnico</span>
                    </th>
                    {weekDays.map(day => {
                      const hoy = isToday(day);
                      const domingo = day.getDay() === 0;
                      return (
                        <th key={day.toISOString()} className={`p-2.5 text-center min-w-[115px] border-l border-slate-100 ${hoy ? 'bg-blue-50' : domingo ? 'bg-slate-100/50' : ''}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wide ${hoy ? 'text-blue-500' : 'text-slate-400'}`}>
                            {format(day, 'EEEE', { locale: es })}
                          </p>
                          <p className={`text-xl font-black mt-0.5 ${hoy ? 'text-blue-600' : 'text-slate-700'}`}>
                            {format(day, 'd')}
                          </p>
                          <p className="text-[10px] text-slate-400 capitalize">{format(day, 'MMM', { locale: es })}</p>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredTecnicos.map((tec, tIdx) => {
                    const stats = getWeekStats(tec.id);
                    const esp = especialidadBadge[tec.especialidad] || especialidadBadge.ambos;
                    return (
                      <tr key={tec.id} className={`border-b border-slate-100 ${tIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        {/* Technician cell */}
                        <td className={`p-3 sticky left-0 z-10 border-r border-slate-200 ${tIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}`}>
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                              {tec.nombre.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-slate-800 truncate">{tec.nombre}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${esp.cls}`}>{esp.label}</span>
                                <span className="text-[10px] text-slate-400">{stats.total} serv.</span>
                                {stats.bloqueos > 0 && (
                                  <span className="text-[10px] text-red-400">{stats.bloqueos} bloq.</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (stats.slotsOcupados / 12) * 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">{Math.round((stats.slotsOcupados / 12) * 100)}%</span>
                          </div>
                        </td>

                        {/* Day cells */}
                        {weekDays.map(day => {
                          const amServs = getServiciosForCell(tec.id, day, 'AM');
                          const pmServs = getServiciosForCell(tec.id, day, 'PM');
                          const amEvts = getEventosForCell(tec.id, day, 'AM');
                          const pmEvts = getEventosForCell(tec.id, day, 'PM');
                          const totalDay = getTotalForDay(tec.id, day);
                          const dayEvts = eventos.filter(e => e.tecnicoId === tec.id && isSameDay(new Date(e.fecha), day));
                          const isSunday = day.getDay() === 0;
                          const hoy = isToday(day);

                          return (
                            <td
                              key={day.toISOString()}
                              className={`p-1.5 align-top border-l border-slate-100 ${hoy ? 'bg-blue-50/30' : ''} ${isSunday ? 'bg-slate-100/30' : ''}`}
                            >
                              {isSunday ? (
                                <div className="text-center py-6">
                                  <div className="text-[10px] text-slate-300 font-bold">DESCANSO</div>
                                </div>
                              ) : totalDay.length === 0 && dayEvts.length === 0 ? (
                                <div className="text-center py-5">
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 border-dashed">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    <span className="text-[10px] font-bold text-emerald-600">LIBRE</span>
                                  </div>
                                  <button
                                    onClick={() => openCreateModal(tec.id, day, 'bloqueo')}
                                    className="mt-1.5 flex items-center justify-center gap-0.5 mx-auto text-[10px] text-slate-300 hover:text-blue-500 transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Bloquear
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {/* AM events */}
                                  {amEvts.map(evt => {
                                    const cfg = tipoBloqueoConfig[evt.tipo] || tipoBloqueoConfig.otro;
                                    const Icon = cfg.icon;
                                    return (
                                      <div
                                        key={`evt-${evt.id}`}
                                        className={`w-full text-left p-2 rounded-lg border text-[11px] leading-tight ${cfg.bg} ${cfg.border} relative group`}
                                      >
                                        <div className="flex items-center gap-1 mb-0.5">
                                          <Icon className={`h-3 w-3 ${cfg.color} opacity-60`} />
                                          <span className={`font-bold ${cfg.color}`}>
                                            {evt.todo_el_dia ? 'Todo el día' : `${evt.hora_inicio} - ${evt.hora_fin}`}
                                          </span>
                                        </div>
                                        <p className="font-semibold truncate text-slate-700">{evt.titulo}</p>
                                        <button
                                          onClick={() => handleEliminarEvento(evt.id)}
                                          className="absolute top-1 right-1 h-5 w-5 rounded bg-white/80 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <Trash2 className="h-3 w-3 text-red-400" />
                                        </button>
                                      </div>
                                    );
                                  })}

                                  {/* AM services */}
                                  {amServs.length > 0 ? amServs.map(s => (
                                    <button
                                      key={s.id}
                                      onClick={() => setSelectedServicio(s)}
                                      className={`w-full text-left p-2 rounded-lg border text-[11px] leading-tight transition-all hover:shadow-lg hover:scale-[1.02] ${estadoColor[s.estado]}`}
                                    >
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <Sun className="h-3 w-3 opacity-40" />
                                        <span className="font-bold">{s.hora_inicio} - {s.hora_fin}</span>
                                      </div>
                                      <p className="font-semibold truncate">{s.cliente?.nombre}</p>
                                      {s.equipo && <p className="text-[10px] opacity-70 truncate">{tipoEquipoLabel[s.equipo.tipo]}</p>}
                                    </button>
                                  )) : amEvts.length === 0 && (
                                    <div className="p-2 rounded-lg border border-dashed border-slate-200 text-center">
                                      <span className="text-[10px] text-slate-300 flex items-center justify-center gap-1">
                                        <Sun className="h-2.5 w-2.5" /> Mañana libre
                                      </span>
                                    </div>
                                  )}

                                  {/* PM events */}
                                  {pmEvts.filter(e => !e.todo_el_dia).map(evt => {
                                    const cfg = tipoBloqueoConfig[evt.tipo] || tipoBloqueoConfig.otro;
                                    const Icon = cfg.icon;
                                    return (
                                      <div
                                        key={`evt-${evt.id}`}
                                        className={`w-full text-left p-2 rounded-lg border text-[11px] leading-tight ${cfg.bg} ${cfg.border} relative group`}
                                      >
                                        <div className="flex items-center gap-1 mb-0.5">
                                          <Icon className={`h-3 w-3 ${cfg.color} opacity-60`} />
                                          <span className={`font-bold ${cfg.color}`}>{evt.hora_inicio} - {evt.hora_fin}</span>
                                        </div>
                                        <p className="font-semibold truncate text-slate-700">{evt.titulo}</p>
                                        <button
                                          onClick={() => handleEliminarEvento(evt.id)}
                                          className="absolute top-1 right-1 h-5 w-5 rounded bg-white/80 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <Trash2 className="h-3 w-3 text-red-400" />
                                        </button>
                                      </div>
                                    );
                                  })}

                                  {/* PM services */}
                                  {pmServs.length > 0 ? pmServs.map(s => (
                                    <button
                                      key={s.id}
                                      onClick={() => setSelectedServicio(s)}
                                      className={`w-full text-left p-2 rounded-lg border text-[11px] leading-tight transition-all hover:shadow-lg hover:scale-[1.02] ${estadoColor[s.estado]}`}
                                    >
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <Moon className="h-3 w-3 opacity-40" />
                                        <span className="font-bold">{s.hora_inicio} - {s.hora_fin}</span>
                                      </div>
                                      <p className="font-semibold truncate">{s.cliente?.nombre}</p>
                                      {s.equipo && <p className="text-[10px] opacity-70 truncate">{tipoEquipoLabel[s.equipo.tipo]}</p>}
                                    </button>
                                  )) : pmEvts.filter(e => !e.todo_el_dia).length === 0 && (
                                    <div className="p-2 rounded-lg border border-dashed border-slate-200 text-center">
                                      <span className="text-[10px] text-slate-300 flex items-center justify-center gap-1">
                                        <Moon className="h-2.5 w-2.5" /> Tarde libre
                                      </span>
                                    </div>
                                  )}

                                  {/* Add block button */}
                                  <button
                                    onClick={() => openCreateModal(tec.id, day, 'bloqueo')}
                                    className="w-full flex items-center justify-center gap-0.5 py-1 text-[10px] text-slate-300 hover:text-blue-500 transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Bloquear
                                  </button>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tecnicos.map(tec => {
              const stats = getWeekStats(tec.id);
              const esp = especialidadBadge[tec.especialidad] || especialidadBadge.ambos;
              const pctOcupacion = Math.round((stats.slotsOcupados / 12) * 100);

              return (
                <Card
                  key={tec.id}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${selectedTecnico === tec.id ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => setSelectedTecnico(selectedTecnico === tec.id ? null : tec.id)}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                      {tec.nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{tec.nombre}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${esp.cls}`}>{esp.label}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-black text-amber-600">{stats.activos}</p>
                      <p className="text-[10px] text-slate-400">Activos</p>
                    </div>
                    <div>
                      <p className="text-xl font-black text-emerald-600">{stats.completados}</p>
                      <p className="text-[10px] text-slate-400">Hechos</p>
                    </div>
                    <div>
                      <p className={`text-xl font-black ${pctOcupacion > 80 ? 'text-red-500' : pctOcupacion > 50 ? 'text-amber-500' : 'text-blue-600'}`}>{pctOcupacion}%</p>
                      <p className="text-[10px] text-slate-400">Carga</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pctOcupacion > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : pctOcupacion > 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`}
                      style={{ width: `${Math.min(100, pctOcupacion)}%` }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Legend */}
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
              <Ban className="h-3 w-3 text-red-400" /> <span className="text-[11px] text-slate-500">Bloqueado</span>
            </div>
            <div className="h-3 w-px bg-slate-200 mx-1" />
            <div className="flex items-center gap-1.5">
              <Sun className="h-3 w-3 text-amber-400" /> <span className="text-[11px] text-slate-500">8:00 - 12:00</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Moon className="h-3 w-3 text-indigo-400" /> <span className="text-[11px] text-slate-500">1:00 - 5:00</span>
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
