import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUsuario, getMetricasTecnico } from '@/api/usuarios';
import { getServicios } from '@/api/servicios';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/shared/LoadingSpinner';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { toast } from '@/components/shared/Toast';
import { formatCurrency, formatDate, especialidadLabel, estadoConfig, tipoEquipoLabel } from '@/utils/helpers';
import type { Usuario, Servicio } from '@/types';
import {
  ArrowLeft, Mail, Phone, Star, Wrench, CheckCircle2,
  DollarSign, ChevronLeft, ChevronRight, Clock, MapPin,
  Settings, TrendingUp, Calendar as CalendarIcon, XCircle,
} from 'lucide-react';

interface TecnicoMetricas {
  total_servicios: number;
  completados: number;
  cancelados: number;
  calificacion_promedio: number;
  ingresos_generados: number;
  valor_promedio: number;
}

export const TecnicoDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tecnico, setTecnico] = useState<Usuario | null>(null);
  const [metricas, setMetricas] = useState<TecnicoMetricas | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [tecRes, metRes, servRes] = await Promise.all([
          getUsuario(id),
          getMetricasTecnico(id),
          getServicios({ tecnico_id: id, limit: '10', page: '1' }),
        ]);
        setTecnico(tecRes.data.data);
        setMetricas(metRes.data.data);
        setServicios(servRes.data.data);
      } catch {
        toast.error('Error cargando datos del técnico');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const calendarData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const monthName = calendarDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    const serviceDays = new Set(
      servicios
        .filter(s => {
          if (!s.fecha_programada) return false;
          const d = new Date(s.fecha_programada);
          return d.getMonth() === month && d.getFullYear() === year;
        })
        .map(s => new Date(s.fecha_programada!).getDate())
    );

    return { year, month, firstDay, daysInMonth, prevDays, monthName, serviceDays };
  }, [calendarDate, servicios]);

  const upcomingServices = useMemo(() => {
    const now = new Date();
    return servicios
      .filter(s => s.estado !== 'completado' && s.estado !== 'cancelado')
      .sort((a, b) => {
        const da = a.fecha_programada ? new Date(a.fecha_programada).getTime() : 0;
        const db = b.fecha_programada ? new Date(b.fecha_programada).getTime() : 0;
        return da - db;
      })
      .slice(0, 3);
  }, [servicios]);

  const prevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

  if (loading) return <LoadingSkeleton rows={8} />;
  if (!tecnico) return <div className="text-center py-12 text-muted-foreground">Técnico no encontrado</div>;

  const today = new Date().getDate();
  const isCurrentMonth = calendarDate.getMonth() === new Date().getMonth() && calendarDate.getFullYear() === new Date().getFullYear();

  const tipoServicioColors = [
    'bg-indigo-500',
    'bg-emerald-500',
    'bg-amber-500',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/tecnicos')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Perfil del Técnico</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Profile + Stats + Table */}
        <div className="lg:col-span-2 space-y-6">

          {/* Profile Card */}
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 pb-16 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Avatar */}
                <div className="h-20 w-20 rounded-2xl bg-white/10 backdrop-blur border-2 border-white/20 shadow-xl flex items-center justify-center text-3xl font-bold text-white shrink-0 overflow-hidden">
                  {tecnico.foto_url ? (
                    <img src={tecnico.foto_url} alt={tecnico.nombre} className="h-full w-full object-cover" />
                  ) : (
                    <span className="bg-gradient-to-br from-blue-400/30 to-indigo-400/30 h-full w-full flex items-center justify-center">
                      {tecnico.nombre.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Name + Status */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-white">{tecnico.nombre}</h2>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${tecnico.activo ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-red-400/20 text-red-300 border border-red-400/30'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tecnico.activo ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      {tecnico.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-0.5">Técnico Especialista</p>

                  {/* Badges inside header */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-400/30">
                      <Wrench className="h-3 w-3 mr-1" />
                      {especialidadLabel[tecnico.especialidad]}
                    </Badge>
                    {metricas && metricas.calificacion_promedio > 0 && (
                      <Badge className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30">
                        <Star className="h-3 w-3 mr-1" />
                        {metricas.calificacion_promedio.toFixed(1)}
                      </Badge>
                    )}
                    <Badge className="bg-white/10 hover:bg-white/15 text-slate-300 border border-white/20">
                      Desde {formatDate(tecnico.createdAt)}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact bar */}
            <div className="px-6 py-4 flex flex-wrap items-center gap-5 text-sm text-slate-500 bg-slate-50/50 border-t">
              <span className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                </div>
                {tecnico.email}
              </span>
              {tecnico.telefono && (
                <span className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center">
                    <Phone className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  {tecnico.telefono}
                </span>
              )}
            </div>
          </Card>

          {/* Stats Cards */}
          {metricas && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4 text-center hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
                  <Settings className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Total Servicios</p>
                <p className="text-2xl font-bold text-slate-800">{metricas.total_servicios}</p>
              </Card>
              <Card className="p-4 text-center hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Completados</p>
                <p className="text-2xl font-bold text-slate-800">{metricas.completados}</p>
              </Card>
              <Card className="p-4 text-center hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-2">
                  <Star className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Calificación</p>
                <p className="text-2xl font-bold text-slate-800">{metricas.calificacion_promedio.toFixed(1)}</p>
              </Card>
              <Card className="p-4 text-center hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium">Ingresos</p>
                <p className="text-lg font-bold text-slate-800">{formatCurrency(metricas.ingresos_generados)}</p>
              </Card>
            </div>
          )}

          {/* Services Table */}
          <Card>
            <div className="p-5 border-b">
              <h3 className="font-semibold text-slate-800">Últimos Servicios</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50/50">
                    <th className="text-left py-3 px-4 font-medium text-slate-500">No.</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Fecha</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Equipo</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-500">Estado</th>
                    <th className="text-right py-3 px-4 font-medium text-slate-500">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">Sin servicios registrados</td></tr>
                  ) : (
                    servicios.map((s, idx) => (
                      <tr
                        key={s.id}
                        className="border-b last:border-0 hover:bg-slate-50/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/admin/servicios?id=${s.id}`)}
                      >
                        <td className="py-3 px-4 text-slate-400 font-mono">{String(idx + 1).padStart(2, '0')}</td>
                        <td className="py-3 px-4 text-slate-700">
                          {s.fecha_programada ? formatDate(s.fecha_programada) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-slate-700">{s.cliente?.nombre || '-'}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {s.equipo ? `${s.equipo.marca || ''} ${s.equipo.modelo || ''}`.trim() || tipoEquipoLabel[s.equipo.tipo] : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <EstadoBadge estado={s.estado} />
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {s.valor_final ? formatCurrency(s.valor_final) : s.valor_estimado ? formatCurrency(s.valor_estimado) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column - Calendar + Upcoming */}
        <div className="space-y-6">
          {/* Calendar */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 capitalize">{calendarData.monthName}</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-slate-600" />
                </button>
                <button
                  onClick={nextMonth}
                  className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 text-center mb-2">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                <span key={d} className="text-xs font-medium text-slate-400 py-1">{d}</span>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 text-center gap-y-1">
              {/* Previous month days */}
              {Array.from({ length: calendarData.firstDay === 0 ? 6 : calendarData.firstDay - 1 }).map((_, i) => (
                <span key={`prev-${i}`} className="text-xs text-slate-300 py-2">
                  {calendarData.prevDays - (calendarData.firstDay === 0 ? 6 : calendarData.firstDay - 1) + i + 1}
                </span>
              ))}
              {/* Current month days */}
              {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = isCurrentMonth && day === today;
                const hasService = calendarData.serviceDays.has(day);
                const isSelected = day === selectedDay;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`
                      relative text-xs py-2 rounded-lg transition-all font-medium
                      ${isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : ''}
                      ${isSelected && !isToday ? 'bg-slate-100 text-slate-800' : ''}
                      ${!isToday && !isSelected ? 'text-slate-700 hover:bg-slate-50' : ''}
                    `}
                  >
                    {day}
                    {hasService && !isToday && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Upcoming Services */}
          <div className="space-y-3">
            {upcomingServices.length > 0 ? (
              upcomingServices.map((s, idx) => {
                const colorClass = tipoServicioColors[idx % tipoServicioColors.length];
                const isHighlighted = idx === 1;

                return (
                  <Card
                    key={s.id}
                    className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                      isHighlighted
                        ? 'bg-slate-800 text-white border-slate-700'
                        : 'hover:border-slate-300'
                    }`}
                    onClick={() => navigate(`/admin/servicios?id=${s.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-full ${isHighlighted ? 'bg-white/20' : 'bg-slate-100'} flex items-center justify-center shrink-0`}>
                        <Wrench className={`h-5 w-5 ${isHighlighted ? 'text-white' : 'text-slate-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${isHighlighted ? 'text-white' : 'text-slate-800'}`}>
                          {s.equipo
                            ? tipoEquipoLabel[s.equipo.tipo] || 'Equipo'
                            : s.descripcion_falla?.substring(0, 30) || 'Servicio'}
                        </p>
                        <p className={`text-xs mt-0.5 ${isHighlighted ? 'text-slate-300' : 'text-slate-500'}`}>
                          <Clock className="h-3 w-3 inline mr-1" />
                          {s.hora_inicio || '-'} - {s.hora_fin || '-'}
                        </p>
                        <p className={`text-xs mt-0.5 ${isHighlighted ? 'text-slate-300' : 'text-slate-500'}`}>
                          {s.cliente?.nombre || 'Cliente'}
                        </p>
                      </div>
                      <button className={`h-8 w-8 rounded-full ${isHighlighted ? 'bg-white/20 hover:bg-white/30' : 'bg-slate-100 hover:bg-slate-200'} flex items-center justify-center transition-colors`}>
                        <ChevronRight className={`h-4 w-4 ${isHighlighted ? 'text-white' : 'text-slate-600'}`} />
                      </button>
                    </div>
                  </Card>
                );
              })
            ) : (
              <Card className="p-6 text-center">
                <CalendarIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Sin servicios próximos</p>
              </Card>
            )}

            {/* Add New + See All */}
            <div className="flex items-center justify-between px-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500 hover:text-slate-700"
                onClick={() => navigate('/admin/agenda')}
              >
                + Asignar servicio
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500 hover:text-slate-700"
                onClick={() => navigate(`/admin/servicios?tecnico=${id}`)}
              >
                Ver todos &rarr;
              </Button>
            </div>
          </div>

          {/* Performance Summary */}
          {metricas && (
            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Rendimiento
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Tasa de completados</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {metricas.total_servicios > 0
                      ? ((metricas.completados / metricas.total_servicios) * 100).toFixed(0)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${metricas.total_servicios > 0
                        ? (metricas.completados / metricas.total_servicios) * 100
                        : 0}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-slate-500">Cancelados</span>
                  <span className="text-sm font-semibold text-red-600">{metricas.cancelados}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Valor promedio</span>
                  <span className="text-sm font-semibold text-slate-800">{formatCurrency(metricas.valor_promedio)}</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
