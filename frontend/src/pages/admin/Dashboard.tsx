import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMetricasHoy } from '@/api/metricas';
import { getServicios } from '@/api/servicios';
import { useSocketStore } from '@/store/socketStore';
import { Card } from '@/components/ui/card';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { CardSkeleton } from '@/components/shared/LoadingSpinner';
import { formatCurrency } from '@/utils/helpers';
import type { MetricasHoy, Servicio } from '@/types';
import {
  Wrench, CheckCircle2, Clock, MessageCircleMore,
  MapPin, TrendingUp, ArrowUpRight,
} from 'lucide-react';

export const Dashboard = () => {
  const [metricas, setMetricas] = useState<MetricasHoy | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocketStore();
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const [metRes, servRes] = await Promise.all([
        getMetricasHoy(),
        getServicios({ fecha: new Date().toISOString().split('T')[0] }),
      ]);
      setMetricas(metRes.data.data);
      setServicios(servRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    socket?.emit('admin_conectado');
    socket?.on('nuevo_servicio', fetchData);
    socket?.on('servicio_actualizado', fetchData);
    return () => {
      socket?.off('nuevo_servicio', fetchData);
      socket?.off('servicio_actualizado', fetchData);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const kpis = [
    { label: 'Servicios hoy', value: metricas?.servicios_hoy || 0, icon: Wrench, bg: 'bg-blue-50', iconColor: 'text-blue-600', ring: 'ring-blue-100' },
    { label: 'Completados', value: metricas?.completados || 0, icon: CheckCircle2, bg: 'bg-emerald-50', iconColor: 'text-emerald-600', ring: 'ring-emerald-100' },
    { label: 'Pendientes', value: metricas?.pendientes || 0, icon: Clock, bg: 'bg-amber-50', iconColor: 'text-amber-600', ring: 'ring-amber-100' },
    { label: 'Mensajes WhatsApp', value: metricas?.mensajes_whatsapp || 0, icon: MessageCircleMore, bg: 'bg-violet-50', iconColor: 'text-violet-600', ring: 'ring-violet-100' },
  ];

  const estadoColor: Record<string, string> = {
    disponible: 'bg-emerald-400',
    en_servicio: 'bg-amber-400',
    en_camino: 'bg-blue-400',
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Resumen de operaciones del día</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, bg, iconColor, ring }) => (
          <Card key={label} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex flex-col items-center text-center gap-3">
              <div className={`h-12 w-12 rounded-2xl ${bg} ring-4 ${ring} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-800 tracking-tight">{value}</p>
                <p className="text-xs text-slate-400 font-medium mt-1">{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Technicians */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Estado de técnicos</h2>
          <button
            onClick={() => navigate('/admin/tecnicos')}
            className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-0.5"
          >
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metricas?.tecnicos_activos.map((t) => (
            <Card
              key={t.id}
              className="p-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/admin/tecnicos/${t.id}`)}
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                    {t.foto_url ? (
                      <img src={t.foto_url} alt={t.nombre} className="h-full w-full rounded-2xl object-cover" />
                    ) : (
                      t.nombre.charAt(0)
                    )}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${estadoColor[t.estado] || 'bg-slate-300'}`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">{t.nombre}</p>
                  <p className="text-xs text-slate-400 capitalize mt-0.5">{t.estado.replace('_', ' ')}</p>
                </div>

                {/* Services count */}
                <div className="text-center shrink-0">
                  <p className="text-lg font-bold text-slate-800">{t.servicios_hoy}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">servicios</p>
                </div>
              </div>

              {t.servicio_activo && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-amber-600">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{t.servicio_activo.direccion_servicio || 'En servicio'}</span>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Services table + Revenue */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Services table */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">Servicios del día</h2>
            <button
              onClick={() => navigate('/admin/servicios')}
              className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-0.5"
            >
              Ver todos <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Hora</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Equipo</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Técnico</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {servicios.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <Clock className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No hay servicios programados para hoy</p>
                      </td>
                    </tr>
                  ) : (
                    servicios.map((s) => (
                      <tr
                        key={s.id}
                        className="border-t border-slate-50 hover:bg-blue-50/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/admin/servicios?id=${s.id}`)}
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-700">{s.hora_inicio || '--:--'}</td>
                        <td className="py-3.5 px-4 text-slate-600">{s.cliente?.nombre || 'N/A'}</td>
                        <td className="py-3.5 px-4 text-slate-500 hidden md:table-cell">
                          {s.equipo ? `${s.equipo.marca || ''} ${s.equipo.modelo || ''}`.trim() || '-' : '-'}
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell">
                          {s.tecnico?.nombre || <span className="text-amber-500 text-xs font-medium">Sin asignar</span>}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <EstadoBadge estado={s.estado} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Revenue card */}
        {metricas && (
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-4">Ingresos</h2>
            <Card className="p-6 flex flex-col items-center text-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 ring-4 ring-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Ingresos del día</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1 tracking-tight">
                  {formatCurrency(metricas.ingresos_hoy)}
                </p>
              </div>
              <div className="w-full pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-lg font-bold text-slate-800">{metricas.en_curso || 0}</p>
                  <p className="text-[11px] text-slate-400">En curso</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-800">{metricas.completados}</p>
                  <p className="text-[11px] text-slate-400">Finalizados</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
