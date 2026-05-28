import { useEffect, useState } from 'react';
import { getServicios, crearServicio } from '@/api/servicios';
import { getUsuarios } from '@/api/usuarios';
import { getClientes } from '@/api/clientes';
import { getEquipos } from '@/api/clientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { LoadingSkeleton } from '@/components/shared/LoadingSpinner';
import { toast } from '@/components/shared/Toast';
import { tipoEquipoLabel } from '@/utils/helpers';
import type { Servicio, Usuario, Cliente, Equipo } from '@/types';
import { ChevronLeft, ChevronRight, Plus, X, CalendarRange, Clock } from 'lucide-react';
import {
  format, addDays, subDays, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { es } from 'date-fns/locale';

type Vista = 'dia' | 'semana' | 'mes';

const estadoColor: Record<string, string> = {
  pendiente: 'bg-slate-400',
  asignado: 'bg-blue-500',
  en_camino: 'bg-amber-500',
  en_servicio: 'bg-orange-500',
  completado: 'bg-emerald-500',
  cancelado: 'bg-red-400',
};

export const Agenda = () => {
  const [fecha, setFecha] = useState(new Date());
  const [vista, setVista] = useState<Vista>('dia');
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [form, setForm] = useState({
    clienteId: '', equipoId: '', tecnicoId: '', descripcion_falla: '', tipo_servicio: '',
    fecha_programada: format(new Date(), 'yyyy-MM-dd'), hora_inicio: '08:00', hora_fin: '10:00',
    direccion_servicio: '', valor_estimado: '40000',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      let params: Record<string, string>;
      if (vista === 'dia') {
        params = { fecha: format(fecha, 'yyyy-MM-dd') };
      } else if (vista === 'semana') {
        params = {
          desde: format(startOfWeek(fecha, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          hasta: format(endOfWeek(fecha, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        };
      } else {
        const start = startOfWeek(startOfMonth(fecha), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(fecha), { weekStartsOn: 1 });
        params = {
          desde: format(start, 'yyyy-MM-dd'),
          hasta: format(end, 'yyyy-MM-dd'),
        };
      }
      const [servRes, tecRes] = await Promise.all([
        getServicios({ ...params, limit: '200' }),
        getUsuarios({ rol: 'tecnico', activo: 'true' }),
      ]);
      setServicios(servRes.data.data);
      setTecnicos(tecRes.data.data);
    } catch { toast.error('Error cargando agenda'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [fecha, vista]);

  const handleNuevo = () => {
    setForm({ ...form, fecha_programada: format(fecha, 'yyyy-MM-dd') });
    getClientes({}).then(r => setClientes(r.data.data)).catch(() => {});
    setShowForm(true);
  };

  const handleClienteChange = async (clienteId: string) => {
    setForm({ ...form, clienteId, equipoId: '' });
    if (clienteId) {
      try {
        const { data: res } = await getEquipos(clienteId);
        setEquipos(res.data);
      } catch { setEquipos([]); }
    }
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await crearServicio({
        ...form,
        valor_estimado: parseFloat(form.valor_estimado) || undefined,
        equipoId: form.equipoId || undefined,
        tecnicoId: form.tecnicoId || undefined,
      } as any);
      toast.success('Servicio creado');
      setShowForm(false);
      fetchData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error creando servicio'); }
  };

  const navegar = (dir: -1 | 1) => {
    if (vista === 'dia') setFecha(d => dir === 1 ? addDays(d, 1) : subDays(d, 1));
    else if (vista === 'semana') setFecha(d => dir === 1 ? addDays(d, 7) : subDays(d, 7));
    else setFecha(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
  };

  const tituloNav = () => {
    if (vista === 'dia') return format(fecha, "EEEE d 'de' MMMM", { locale: es });
    if (vista === 'semana') return `Semana del ${format(startOfWeek(fecha, { weekStartsOn: 1 }), 'd MMM', { locale: es })}`;
    return format(fecha, 'MMMM yyyy', { locale: es });
  };

  const getCalendarDays = () => {
    const monthStart = startOfMonth(fecha);
    const monthEnd = endOfMonth(fecha);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = [];
    let current = calStart;
    while (current <= calEnd) { days.push(current); current = addDays(current, 1); }
    return days;
  };

  const getServiciosDia = (dia: Date) =>
    servicios.filter(s => s.fecha_programada && isSameDay(new Date(s.fecha_programada), dia));

  const serviciosPorTecnico = tecnicos.map(t => ({
    tecnico: t,
    servicios: servicios.filter(s => s.tecnicoId === t.id),
  }));
  const sinAsignar = servicios.filter(s => !s.tecnicoId);
  const serviciosDelDia = selectedDay ? getServiciosDia(selectedDay) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Agenda</h1>
          <p className="text-sm text-slate-400 mt-0.5">Organiza los servicios del equipo</p>
        </div>
        <Button onClick={handleNuevo} className="rounded-xl">
          <Plus className="h-4 w-4 mr-1.5" />Nuevo servicio
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navegar(-1)} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <div className="px-4 py-2 text-sm font-semibold text-slate-700 min-w-[200px] text-center capitalize">
              {tituloNav()}
            </div>
            <button onClick={() => navegar(1)} className="h-9 w-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setFecha(new Date()); setSelectedDay(null); }}>Hoy</Button>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {(['dia', 'semana', 'mes'] as Vista[]).map(v => (
              <button
                key={v}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${vista === v ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                onClick={() => { setVista(v); setSelectedDay(null); }}
              >
                {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleCrear} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Nuevo servicio</h3>
              <button type="button" onClick={() => setShowForm(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100"><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Select value={form.clienteId} onChange={e => handleClienteChange(e.target.value)} required className="rounded-xl">
                <option value="">Seleccionar cliente *</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.telefono}</option>)}
              </Select>
              <Select value={form.equipoId} onChange={e => setForm({...form, equipoId: e.target.value})} className="rounded-xl">
                <option value="">Seleccionar equipo</option>
                {equipos.map(eq => <option key={eq.id} value={eq.id}>{tipoEquipoLabel[eq.tipo]} {eq.marca} {eq.modelo}</option>)}
              </Select>
              <Select value={form.tecnicoId} onChange={e => setForm({...form, tecnicoId: e.target.value})} className="rounded-xl">
                <option value="">Seleccionar técnico</option>
                {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </Select>
              <Select value={form.tipo_servicio} onChange={e => setForm({...form, tipo_servicio: e.target.value})} className="rounded-xl">
                <option value="">Tipo de servicio</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="reparacion">Reparación</option>
                <option value="instalacion">Instalación</option>
                <option value="diagnostico">Diagnóstico</option>
              </Select>
              <Input type="date" value={form.fecha_programada} onChange={e => setForm({...form, fecha_programada: e.target.value})} required className="rounded-xl" />
              <Input type="time" value={form.hora_inicio} onChange={e => setForm({...form, hora_inicio: e.target.value})} className="rounded-xl" />
              <Input type="time" value={form.hora_fin} onChange={e => setForm({...form, hora_fin: e.target.value})} className="rounded-xl" />
              <Input placeholder="Dirección" value={form.direccion_servicio} onChange={e => setForm({...form, direccion_servicio: e.target.value})} className="rounded-xl" />
              <Input placeholder="Valor estimado" type="number" value={form.valor_estimado} onChange={e => setForm({...form, valor_estimado: e.target.value})} className="rounded-xl" />
            </div>
            <Textarea placeholder="Descripción de la falla" value={form.descripcion_falla} onChange={e => setForm({...form, descripcion_falla: e.target.value})} className="rounded-xl" />
            <div className="flex gap-2">
              <Button type="submit" className="rounded-xl">Crear servicio</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="rounded-xl">Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {vista === 'mes' && !loading && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                <div key={d} className="py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {getCalendarDays().map((dia, idx) => {
                const servsDia = getServiciosDia(dia);
                const esHoy = isToday(dia);
                const esEsteMes = isSameMonth(dia, fecha);
                const estaSeleccionado = selectedDay && isSameDay(dia, selectedDay);
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(dia)}
                    className={`relative min-h-[100px] p-2 border-b border-r border-slate-100 text-left transition-colors hover:bg-blue-50/40 ${!esEsteMes ? 'bg-slate-50/50' : ''} ${estaSeleccionado ? 'bg-blue-50 ring-2 ring-inset ring-blue-500/30' : ''}`}
                  >
                    <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-semibold ${esHoy ? 'bg-blue-600 text-white' : !esEsteMes ? 'text-slate-300' : 'text-slate-700'}`}>
                      {format(dia, 'd')}
                    </span>
                    {servsDia.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {servsDia.slice(0, 3).map(s => (
                          <div key={s.id} className="flex items-center gap-1.5 group">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${estadoColor[s.estado] || 'bg-slate-400'}`} />
                            <span className="text-[11px] text-slate-600 truncate leading-tight group-hover:text-blue-600">
                              {s.hora_inicio || '--'} {s.cliente?.nombre?.split(' ')[0] || ''}
                            </span>
                          </div>
                        ))}
                        {servsDia.length > 3 && <span className="text-[10px] text-blue-600 font-medium pl-3">+{servsDia.length - 3} más</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <div className="flex flex-wrap items-center gap-4 px-1">
            {[{ label: 'Pendiente', color: 'bg-slate-400' }, { label: 'Asignado', color: 'bg-blue-500' }, { label: 'En camino', color: 'bg-amber-500' }, { label: 'En servicio', color: 'bg-orange-500' }, { label: 'Completado', color: 'bg-emerald-500' }, { label: 'Cancelado', color: 'bg-red-400' }].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${color}`} />
                <span className="text-[11px] text-slate-500">{label}</span>
              </div>
            ))}
          </div>
          {selectedDay && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800 capitalize">{format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{serviciosDelDia.length} servicios programados</p>
                </div>
                <button onClick={() => setSelectedDay(null)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100"><X className="h-4 w-4 text-slate-400" /></button>
              </div>
              {serviciosDelDia.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarRange className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin servicios este día</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {serviciosDelDia.sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || '')).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-blue-50/30 transition-colors text-sm">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[50px]">
                          <p className="font-bold text-slate-700">{s.hora_inicio || '--'}</p>
                          <p className="text-[10px] text-slate-400">{s.hora_fin || ''}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">{s.cliente?.nombre}</p>
                          <p className="text-xs text-slate-400">{s.tecnico?.nombre || 'Sin asignar'} · {s.equipo ? tipoEquipoLabel[s.equipo.tipo] : ''} {s.equipo?.marca || ''}</p>
                        </div>
                      </div>
                      <EstadoBadge estado={s.estado} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {vista !== 'mes' && (loading ? <LoadingSkeleton rows={6} /> : (
        <div className="space-y-4">
          {sinAsignar.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/30 p-5">
              <h3 className="font-semibold text-amber-700 mb-3 flex items-center gap-2"><Clock className="h-4 w-4" />Sin asignar ({sinAsignar.length})</h3>
              <div className="space-y-2">
                {sinAsignar.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-700 min-w-[50px]">{s.hora_inicio || '--:--'}</span>
                      <div>
                        <p className="font-medium text-slate-700">{s.cliente?.nombre}</p>
                        <p className="text-xs text-slate-400">{s.descripcion_falla}</p>
                      </div>
                    </div>
                    <EstadoBadge estado={s.estado} />
                  </div>
                ))}
              </div>
            </Card>
          )}
          {serviciosPorTecnico.map(({ tecnico, servicios: servs }) => (
            <Card key={tecnico.id} className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-sm">{tecnico.nombre.charAt(0)}</div>
                <div>
                  <h3 className="font-semibold text-slate-800">{tecnico.nombre}</h3>
                  <p className="text-xs text-slate-400">{servs.length} servicios programados</p>
                </div>
              </div>
              {servs.length === 0 ? (
                <div className="text-center py-6">
                  <CalendarRange className="h-6 w-6 text-slate-200 mx-auto mb-1" />
                  <p className="text-sm text-slate-400">Sin servicios programados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {servs.sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || '')).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-blue-50/30 transition-colors text-sm">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[50px]">
                          <p className="font-bold text-slate-700">{s.hora_inicio || '--'}</p>
                          <p className="text-[10px] text-slate-400">{s.hora_fin || ''}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">{s.cliente?.nombre}</p>
                          <p className="text-xs text-slate-400">{s.equipo ? tipoEquipoLabel[s.equipo.tipo] : ''} {s.equipo?.marca || ''}</p>
                        </div>
                      </div>
                      <EstadoBadge estado={s.estado} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ))}
    </div>
  );
};
