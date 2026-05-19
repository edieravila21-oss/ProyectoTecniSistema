import { useEffect, useState } from 'react';
import { getResumen, getMetricasTecnicos, getMetricasCanales, getMetricasSLA } from '@/api/metricas';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { CardSkeleton } from '@/components/shared/LoadingSpinner';
import { formatCurrency } from '@/utils/helpers';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, Star, CheckCircle2, Briefcase, Clock, Shield, ClipboardCheck, Users, XCircle, Timer, UserCheck, Camera, FileText, Navigation } from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Metricas = () => {
  const [periodo, setPeriodo] = useState('mes');
  const [resumen, setResumen] = useState<any>(null);
  const [tecnicosData, setTecnicosData] = useState<any[]>([]);
  const [canalesData, setCanalesData] = useState<any>(null);
  const [slaData, setSlaData] = useState<any>(null);
  const [tecnicoId, setTecnicoId] = useState('');
  const [loading, setLoading] = useState(true);

  const getFechas = () => {
    const hasta = format(new Date(), 'yyyy-MM-dd');
    let desde: string;
    switch (periodo) {
      case 'semana': desde = format(subDays(new Date(), 7), 'yyyy-MM-dd'); break;
      case 'trimestre': desde = format(subMonths(new Date(), 3), 'yyyy-MM-dd'); break;
      default: desde = format(subMonths(new Date(), 1), 'yyyy-MM-dd');
    }
    return { desde, hasta, ...(tecnicoId ? { tecnicoId } : {}) };
  };

  const fetchData = async () => {
    setLoading(true);
    const params = getFechas();
    try {
      const [resRes, tecRes, canRes, slaRes] = await Promise.all([
        getResumen(params),
        getMetricasTecnicos(params),
        getMetricasCanales(params),
        getMetricasSLA(params),
      ]);
      setResumen(resRes.data.data);
      setTecnicosData(tecRes.data.data);
      setCanalesData(canRes.data.data);
      setSlaData(slaRes.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [periodo, tecnicoId]);

  if (loading) return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800 tracking-tight">Métricas</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}</div>
    </div>
  );

  const kpis = [
    { label: 'Total servicios', value: resumen?.total_servicios || 0, icon: Briefcase, bg: 'bg-blue-50', iconColor: 'text-blue-600', ring: 'ring-blue-100' },
    { label: 'Ingresos', value: formatCurrency(resumen?.ingresos_totales || 0), icon: DollarSign, bg: 'bg-emerald-50', iconColor: 'text-emerald-600', ring: 'ring-emerald-100' },
    { label: 'Valor promedio', value: formatCurrency(resumen?.valor_promedio || 0), icon: TrendingUp, bg: 'bg-violet-50', iconColor: 'text-violet-600', ring: 'ring-violet-100' },
    { label: 'Calificación', value: (resumen?.calificacion_promedio || 0).toFixed(1), icon: Star, bg: 'bg-amber-50', iconColor: 'text-amber-600', ring: 'ring-amber-100' },
    { label: 'Completados', value: resumen?.completados || 0, icon: CheckCircle2, bg: 'bg-teal-50', iconColor: 'text-teal-600', ring: 'ring-teal-100' },
  ];

  const canalesPie = canalesData ? [
    { name: 'WhatsApp', value: canalesData.por_origen.whatsapp },
    { name: 'Manual', value: canalesData.por_origen.manual },
  ] : [];

  const formatMinutos = (min: number) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const slaKpis = slaData ? [
    // Tiempos de proceso del técnico
    { label: 'Tiempo de respuesta', value: formatMinutos(slaData.tiempo_respuesta_promedio), icon: Clock, bg: 'bg-blue-50', iconColor: 'text-blue-600', ring: 'ring-blue-100', desc: 'Creación → inicio real' },
    { label: 'Duración servicio', value: formatMinutos(slaData.tiempo_servicio_promedio), icon: Timer, bg: 'bg-indigo-50', iconColor: 'text-indigo-600', ring: 'ring-indigo-100', desc: 'Inicio → cierre' },
    { label: 'Tiempo en camino', value: formatMinutos(slaData.tiempo_en_camino_promedio ?? 0), icon: Navigation, bg: 'bg-sky-50', iconColor: 'text-sky-600', ring: 'ring-sky-100', desc: 'Prog. → llegada real' },
    // Calidad del proceso
    { label: 'Tasa completado', value: `${slaData.tasa_completado}%`, icon: Shield, bg: 'bg-emerald-50', iconColor: 'text-emerald-600', ring: 'ring-emerald-100', desc: `${slaData.total_completados} de ${slaData.total_servicios}` },
    { label: 'Checklist cumplido', value: `${slaData.checklist_completion}%`, icon: ClipboardCheck, bg: 'bg-amber-50', iconColor: 'text-amber-600', ring: 'ring-amber-100', desc: `${slaData.checklist_done ?? 0}/${slaData.checklist_total ?? 0} items` },
    { label: 'Cancelaciones', value: `${slaData.tasa_cancelacion}%`, icon: XCircle, bg: 'bg-red-50', iconColor: 'text-red-600', ring: 'ring-red-100', desc: `${slaData.total_cancelados} servicios` },
    // Documentación del técnico
    { label: 'Fotos tomadas', value: `${slaData.tasa_fotos ?? 0}%`, icon: Camera, bg: 'bg-orange-50', iconColor: 'text-orange-600', ring: 'ring-orange-100', desc: `${slaData.fotos_despues ?? 0} fotos después` },
    { label: 'Firmas cliente', value: `${slaData.tasa_firmas ?? 0}%`, icon: FileText, bg: 'bg-teal-50', iconColor: 'text-teal-600', ring: 'ring-teal-100', desc: `${slaData.firmas_totales ?? 0} firmas obtenidas` },
    // Fidelización
    { label: 'Retención clientes', value: `${slaData.tasa_retencion}%`, icon: UserCheck, bg: 'bg-violet-50', iconColor: 'text-violet-600', ring: 'ring-violet-100', desc: `${slaData.clientes_unicos} clientes únicos` },
  ] : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Métricas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Análisis de rendimiento del negocio</p>
        </div>
        <div className="flex gap-3">
          <Select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)} className="w-48 rounded-xl bg-white border-slate-200">
            <option value="">Todos los técnicos</option>
            {tecnicosData.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </Select>
          <Select value={periodo} onChange={e => setPeriodo(e.target.value)} className="w-40 rounded-xl bg-white border-slate-200">
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
            <option value="trimestre">Trimestre</option>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(({ label, value, icon: Icon, bg, iconColor, ring }) => (
          <Card key={label} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex flex-col items-center text-center gap-3">
              <div className={`h-11 w-11 rounded-2xl ${bg} ring-4 ${ring} flex items-center justify-center`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800 tracking-tight">{value}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* SLA Dashboard */}
      {slaData && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Shield className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">SLA y Rendimiento</h2>
              <p className="text-xs text-slate-400">Indicadores de calidad del servicio — todos los procesos del técnico</p>
            </div>
            {(slaData?.en_curso_ahora ?? 0) > 0 && (
              <span className="ml-auto flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                {slaData.en_curso_ahora} en curso ahora
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {slaKpis.map(({ label, value, icon: Icon, bg, iconColor, ring, desc }) => (
              <Card key={label} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col items-center text-center gap-2.5">
                  <div className={`h-10 w-10 rounded-2xl ${bg} ring-4 ${ring} flex items-center justify-center`}>
                    <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800 tracking-tight">{value}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Rating distribution + Day of week charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Distribución de calificaciones</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={slaData.rating_distribucion}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="estrellas" tickFormatter={v => `${v}★`} fontSize={12} stroke="#94a3b8" />
                  <YAxis fontSize={11} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} formatter={(v: any) => [v, 'Servicios']} />
                  <Bar dataKey="cantidad" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Servicios por día de la semana</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={slaData.por_dia_semana}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dia" fontSize={12} stroke="#94a3b8" />
                  <YAxis fontSize={11} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} formatter={(v: any) => [v, 'Servicios']} />
                  <Bar dataKey="cantidad" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Servicios por día</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={resumen?.servicios_por_dia || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="fecha" tickFormatter={v => format(new Date(v), 'dd/MM')} fontSize={11} stroke="#94a3b8" />
              <YAxis fontSize={11} stroke="#94a3b8" />
              <Tooltip labelFormatter={v => format(new Date(v), 'dd/MM/yyyy')} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Canales de entrada</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={canalesPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={50} label={{ fontSize: 12 }}>
                {canalesPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Technician performance */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Rendimiento por técnico</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Técnico</th>
                <th className="text-center py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Servicios</th>
                <th className="text-center py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Completados</th>
                <th className="text-center py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Ingresos</th>
                <th className="text-center py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Calificación</th>
              </tr>
            </thead>
            <tbody>
              {tecnicosData.map((t: any) => (
                <tr key={t.id} className="border-t border-slate-50 hover:bg-blue-50/30 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-xs">{t.nombre.charAt(0)}</div>
                      <span className="font-medium text-slate-700">{t.nombre}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-slate-700">{t.servicios}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-emerald-600">{t.completados}</td>
                  <td className="py-3.5 px-4 text-center font-medium text-slate-600 hidden sm:table-cell">{formatCurrency(t.ingresos_generados)}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="text-amber-500">{'★'.repeat(Math.round(t.calificacion_promedio))}</span>
                    <span className="text-slate-200">{'★'.repeat(5 - Math.round(t.calificacion_promedio))}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
