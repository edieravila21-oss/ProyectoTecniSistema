import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServicios } from '@/api/servicios';
import { getEventosCalendario, crearEventoCalendario, eliminarEventoCalendario } from '@/api/calendario';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { toast } from '@/components/shared/Toast';
import { tipoEquipoLabel, formatCurrency } from '@/utils/helpers';
import type { Servicio, EventoCalendario } from '@/types';
import {
  ChevronLeft, ChevronRight, Clock, MapPin, Wrench,
  Phone, Snowflake, MessageSquare, Zap, Plus, X, Trash2,
  Ban, Coffee, GraduationCap, Stethoscope, Palmtree, CalendarOff,
} from 'lucide-react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';

const estadoColor: Record<string, string> = {
  asignado: 'bg-blue-500',
  en_camino: 'bg-amber-500',
  en_servicio: 'bg-orange-500',
  completado: 'bg-emerald-500',
  cancelado: 'bg-red-400',
};

const estadoLabel: Record<string, string> = {
  asignado: 'Asignado',
  en_camino: 'En camino',
  en_servicio: 'En servicio',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

const tipoBloqueoConfig: Record<string, { label: string; icon: typeof Ban; color: string; bg: string }> = {
  personal: { label: 'Personal', icon: Ban, color: 'text-slate-600', bg: 'bg-slate-100' },
  vacaciones: { label: 'Vacaciones', icon: Palmtree, color: 'text-amber-600', bg: 'bg-amber-50' },
  capacitacion: { label: 'Capacitación', icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  almuerzo: { label: 'Almuerzo', icon: Coffee, color: 'text-orange-600', bg: 'bg-orange-50' },
  cita_medica: { label: 'Cita médica', icon: Stethoscope, color: 'text-red-600', bg: 'bg-red-50' },
  otro: { label: 'Otro', icon: CalendarOff, color: 'text-purple-600', bg: 'bg-purple-50' },
};

export const CalendarioTecnico = () => {
  const [mes, setMes] = useState(new Date());
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const { usuario } = useAuthStore();
  const { socket } = useSocketStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    hora_inicio: '08:00',
    hora_fin: '09:00',
    tipo: 'personal' as string,
    todo_el_dia: false,
  });

  const fetchData = async () => {
    if (!usuario) return;
    const start = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 });
    try {
      const [servRes, evtRes] = await Promise.all([
        getServicios({
          tecnico_id: usuario.id,
          desde: format(start, 'yyyy-MM-dd'),
          hasta: format(end, 'yyyy-MM-dd'),
          limit: '200',
        }),
        getEventosCalendario({
          tecnico_id: usuario.id,
          desde: format(start, 'yyyy-MM-dd'),
          hasta: format(end, 'yyyy-MM-dd'),
        }),
      ]);
      setServicios(servRes.data.data);
      setEventos(evtRes.data.data);
    } catch { toast.error('Error cargando calendario'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [mes]);

  useEffect(() => {
    socket?.on('servicio_actualizado', fetchData);
    socket?.on('nuevo_servicio', fetchData);
    socket?.on('evento_calendario_creado', fetchData);
    socket?.on('evento_calendario_eliminado', fetchData);
    return () => {
      socket?.off('servicio_actualizado', fetchData);
      socket?.off('nuevo_servicio', fetchData);
      socket?.off('evento_calendario_creado', fetchData);
      socket?.off('evento_calendario_eliminado', fetchData);
    };
  }, [socket]);

  const getCalendarDays = () => {
    const monthStart = startOfMonth(mes);
    const monthEnd = endOfMonth(mes);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let current = calStart;
    while (current <= calEnd) { days.push(current); current = addDays(current, 1); }
    return days;
  };

  const getServiciosDia = (dia: Date) =>
    servicios.filter(s => s.fecha_programada && isSameDay(new Date(s.fecha_programada), dia));

  const getEventosDia = (dia: Date) =>
    eventos.filter(e => isSameDay(new Date(e.fecha), dia));

  const serviciosDelDia = getServiciosDia(selectedDay)
    .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));

  const eventosDelDia = getEventosDia(selectedDay)
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  const totalMes = servicios.filter(s => s.fecha_programada && isSameMonth(new Date(s.fecha_programada), mes)).length;
  const completadosMes = servicios.filter(s => s.estado === 'completado' && s.fecha_programada && isSameMonth(new Date(s.fecha_programada), mes)).length;

  const openCreateModal = () => {
    setForm({ titulo: '', descripcion: '', hora_inicio: '08:00', hora_fin: '09:00', tipo: 'personal', todo_el_dia: false });
    setShowModal(true);
  };

  const handleCrear = async () => {
    if (!form.titulo.trim()) { toast.error('Escribe un título'); return; }
    if (!usuario) return;
    setSaving(true);
    try {
      await crearEventoCalendario({
        tecnicoId: usuario.id,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || undefined,
        fecha: format(selectedDay, 'yyyy-MM-dd'),
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

  const handleEliminar = async (id: string) => {
    try {
      await eliminarEventoCalendario(id);
      toast.success('Evento eliminado');
      fetchData();
    } catch { toast.error('Error eliminando evento'); }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header con mes */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-5 pt-[env(safe-area-inset-top,12px)] pb-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between pt-4 mb-4">
          <h1 className="text-lg font-bold text-white">Mi Calendario</h1>
          <div className="flex items-center gap-3 text-xs text-blue-200">
            <span>{totalMes} servicios</span>
            <span>{completadosMes} completados</span>
          </div>
        </div>

        {/* Navegación del mes */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMes(m => subMonths(m, 1))}
            className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
          <div className="text-center">
            <p className="text-white font-bold capitalize">{format(mes, 'MMMM yyyy', { locale: es })}</p>
          </div>
          <button
            onClick={() => setMes(m => addMonths(m, 1))}
            className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 mt-4 mb-1">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-blue-300 uppercase">{d}</div>
          ))}
        </div>

        {/* Calendario */}
        <div className="grid grid-cols-7 gap-1">
          {getCalendarDays().map((dia, idx) => {
            const servsDia = getServiciosDia(dia);
            const evtsDia = getEventosDia(dia);
            const esHoy = isToday(dia);
            const esEsteMes = isSameMonth(dia, mes);
            const estaSeleccionado = isSameDay(dia, selectedDay);
            const tieneBloqueo = evtsDia.length > 0;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(dia)}
                className={`relative flex flex-col items-center py-1.5 rounded-xl transition-all ${
                  estaSeleccionado
                    ? 'bg-white text-blue-700 shadow-lg shadow-blue-900/20'
                    : esHoy
                    ? 'bg-white/20 text-white'
                    : esEsteMes
                    ? 'text-white/90 hover:bg-white/10'
                    : 'text-white/30'
                }`}
              >
                <span className={`text-sm font-semibold ${estaSeleccionado ? 'text-blue-700' : ''}`}>
                  {format(dia, 'd')}
                </span>
                <div className="flex gap-0.5 mt-0.5">
                  {servsDia.slice(0, 2).map((s, i) => (
                    <span
                      key={`s${i}`}
                      className={`h-1 w-1 rounded-full ${estaSeleccionado ? estadoColor[s.estado] || 'bg-slate-400' : 'bg-white/70'}`}
                    />
                  ))}
                  {tieneBloqueo && (
                    <span className={`h-1 w-1 rounded-full ${estaSeleccionado ? 'bg-red-400' : 'bg-red-300/80'}`} />
                  )}
                  {servsDia.length > 2 && (
                    <span className={`h-1 w-1 rounded-full ${estaSeleccionado ? 'bg-slate-300' : 'bg-white/40'}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Servicios y eventos del día seleccionado */}
      <div className="px-4 -mt-3 pb-4 space-y-3">
        {/* Fecha seleccionada + botón agregar */}
        <div className="flex items-center justify-between bg-white rounded-2xl p-3 shadow-sm border border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-700 capitalize">
              {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
            </p>
            <span className="text-xs text-slate-400 font-medium">
              {serviciosDelDia.length} {serviciosDelDia.length === 1 ? 'servicio' : 'servicios'}
              {eventosDelDia.length > 0 && ` · ${eventosDelDia.length} ${eventosDelDia.length === 1 ? 'evento' : 'eventos'}`}
            </span>
          </div>
          <button
            onClick={openCreateModal}
            className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Eventos/bloqueos del día */}
        {eventosDelDia.map(evt => {
          const cfg = tipoBloqueoConfig[evt.tipo] || tipoBloqueoConfig.otro;
          const Icon = cfg.icon;
          return (
            <div key={evt.id} className={`rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${cfg.bg}`}>
              <div className="p-3.5">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl ${cfg.bg} border border-slate-200/50 flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800">{evt.titulo}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {evt.todo_el_dia ? 'Todo el día' : `${evt.hora_inicio} - ${evt.hora_fin}`}
                      <span className="mx-1.5">·</span>
                      <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                    </p>
                    {evt.descripcion && <p className="text-xs text-slate-400 mt-1 truncate">{evt.descripcion}</p>}
                  </div>
                  <button
                    onClick={() => handleEliminar(evt.id)}
                    className="h-8 w-8 rounded-lg hover:bg-white/60 flex items-center justify-center transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="space-y-2.5">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 animate-pulse">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
                    <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && serviciosDelDia.length === 0 && eventosDelDia.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
            <Snowflake className="h-10 w-10 text-blue-200 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">Sin servicios este día</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {isToday(selectedDay) ? 'Disfruta tu día libre' : 'Puedes bloquear este horario'}
            </p>
          </div>
        )}

        {!loading && serviciosDelDia.map(s => (
          <div
            key={s.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
          >
            <div className="p-3.5">
              <div className="flex items-center gap-3">
                <div className="text-center shrink-0 min-w-[44px]">
                  <p className="text-base font-bold text-slate-800 leading-tight">{s.hora_inicio || '--:--'}</p>
                  <p className="text-[10px] text-slate-400">{s.hora_fin || ''}</p>
                </div>

                <div className="w-px h-10 bg-slate-100 shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-slate-800 truncate">{s.cliente?.nombre || 'Cliente'}</p>
                    {s.origen === 'whatsapp' && <MessageSquare className="h-3 w-3 text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {s.equipo ? `${tipoEquipoLabel[s.equipo.tipo]} ${s.equipo.marca || ''}`.trim() : 'Sin equipo'}
                    {s.descripcion_falla ? ` · ${s.descripcion_falla}` : ''}
                  </p>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${estadoColor[s.estado] || 'bg-slate-400'}`}>
                    <span className="h-1 w-1 rounded-full bg-white/60" />
                    {estadoLabel[s.estado]}
                  </span>
                  {s.valor_estimado && (
                    <span className="text-[10px] text-slate-400">{formatCurrency(s.valor_estimado)}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-400">
                {s.direccion_servicio && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.direccion_servicio}</span>
                  </span>
                )}
              </div>

              {['asignado', 'en_camino', 'en_servicio'].includes(s.estado) && (
                <div className="flex gap-2 mt-3">
                  {s.cliente?.telefono && (
                    <a
                      href={`tel:${s.cliente.telefono}`}
                      className="h-9 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 transition-colors shrink-0"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Llamar
                    </a>
                  )}
                  <button
                    onClick={() => navigate(`/tecnico/servicio/${s.id}`)}
                    className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-1.5 text-xs font-semibold text-white transition-colors"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {s.estado === 'asignado' ? 'Iniciar' : 'Continuar'}
                  </button>
                </div>
              )}

              {s.estado === 'completado' && s.valor_final && (
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
                  <span className="text-xs text-slate-400">Cobrado</span>
                  <span className="text-sm font-bold text-emerald-600">{formatCurrency(s.valor_final)}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Leyenda */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {Object.entries(estadoColor).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              <span className="text-[10px] text-slate-400">{estadoLabel[key]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span className="text-[10px] text-slate-400">Bloqueado</span>
          </div>
        </div>
      </div>

      {/* Modal crear evento */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Nuevo evento</h3>
                <button onClick={() => setShowModal(false)} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center">
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1 capitalize">
                {format(selectedDay, "EEEE d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Tipo */}
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-2 block">Tipo de evento</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(tipoBloqueoConfig).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    const selected = form.tipo === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setForm(f => ({ ...f, tipo: key }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          selected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${selected ? 'text-blue-600' : cfg.color}`} />
                        <span className={`text-[10px] font-semibold ${selected ? 'text-blue-700' : 'text-slate-500'}`}>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Título</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej: Cita con el doctor"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Descripción (opcional)</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Detalles adicionales..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Todo el día toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.todo_el_dia ? 'bg-blue-600' : 'bg-slate-200'}`}
                  onClick={() => setForm(f => ({ ...f, todo_el_dia: !f.todo_el_dia }))}
                >
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.todo_el_dia ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">Todo el día</span>
              </label>

              {/* Horas */}
              {!form.todo_el_dia && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Hora inicio</label>
                    <input
                      type="time"
                      value={form.hora_inicio}
                      onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Hora fin</label>
                    <input
                      type="time"
                      value={form.hora_fin}
                      onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="p-5 pt-0 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 h-12 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrear}
                disabled={saving || !form.titulo.trim()}
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {saving ? 'Guardando...' : 'Crear evento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
