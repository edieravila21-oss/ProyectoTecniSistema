import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getServicios, getServicio, cambiarEstadoServicio, crearServicio } from '@/api/servicios';
import { cacheServicio } from '@/lib/offlineDb';
import { getClientes } from '@/api/clientes';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { toast } from '@/components/shared/Toast';
import { actualizarBadge } from '@/hooks/usePushNotifications';
import { tipoEquipoLabel, formatCurrency, formatDate } from '@/utils/helpers';
import type { Servicio } from '@/types';
import {
  Phone, MapPin, Navigation, Wrench, Search, Star,
  CheckCircle2, ArrowRight, TrendingUp,
  Calendar, Snowflake, MessageSquare,
  Plus, ChevronRight, ClipboardList, Download, Loader2,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const AgendaTecnico = () => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [proximos, setProximos] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { usuario } = useAuthStore();
  const { socket } = useSocketStore();
  const navigate = useNavigate();
  const { openSearch } = useOutletContext<{ openSearch: () => void }>();
  const hoy = format(new Date(), 'yyyy-MM-dd');

  const cargarServicios = useCallback(async () => {
    try {
      const { data: res } = await getServicios({
        tecnico_id: usuario!.id,
        fecha: hoy,
      });
      setServicios(res.data);
      const pending = (res.data as Servicio[]).filter(s =>
        ['asignado', 'en_camino', 'en_servicio', 'pausado'].includes(s.estado)
      ).length;
      actualizarBadge(pending);
    } catch {
      toast.error('Error cargando agenda');
    }
  }, [usuario]);

  const cargarProximos = useCallback(async () => {
    try {
      const hasta = format(addDays(new Date(), 30), 'yyyy-MM-dd');
      const { data: res } = await getServicios({
        tecnico_id: usuario!.id,
        desde: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        hasta,
        limit: '20',
      });
      setProximos((res.data as Servicio[]).filter(s => !['cancelado', 'completado'].includes(s.estado)));
    } catch {}
  }, [usuario]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([cargarServicios(), cargarProximos()]);
      setLoading(false);
    };
    load();
  }, [cargarServicios, cargarProximos]);

  useEffect(() => {
    socket?.on('servicio_actualizado', () => { cargarServicios(); cargarProximos(); });
    return () => { socket?.off('servicio_actualizado', cargarServicios); };
  }, [socket, cargarServicios, cargarProximos]);

  const [accionandoId, setAccionandoId] = useState<string | null>(null);
  const [creandoTest, setCreandoTest] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [descargaProgreso, setDescargaProgreso] = useState<{ done: number; total: number } | null>(null);

  const handleDescargarAgenda = async () => {
    const activos = servicios.filter(s => !['cancelado', 'completado'].includes(s.estado));
    if (activos.length === 0) { toast.error('No hay servicios activos para descargar'); return; }
    setDescargando(true);
    setDescargaProgreso({ done: 0, total: activos.length });
    let ok = 0;
    for (let i = 0; i < activos.length; i++) {
      try {
        const { data: res } = await getServicio(activos[i].id);
        await cacheServicio(res.data);
        // Pre-load photos so the Service Worker caches them
        for (const foto of res.data.fotos || []) {
          if (foto.url) new Image().src = foto.url;
        }
        ok++;
      } catch {}
      setDescargaProgreso({ done: i + 1, total: activos.length });
    }
    setDescargando(false);
    setDescargaProgreso(null);
    toast.success(`Agenda lista sin internet — ${ok} servicio${ok !== 1 ? 's' : ''} descargado${ok !== 1 ? 's' : ''}`);
  };

  const crearServicioTest = async () => {
    setCreandoTest(true);
    try {
      const { data: res } = await getClientes({ limit: '10' });
      const clientes = res.data;
      if (clientes.length === 0) { toast.error('No hay clientes registrados'); return; }
      const cliente = clientes[Math.floor(Math.random() * clientes.length)];
      const equipos = cliente.equipos || [];
      const fallas = [
        'No enfría correctamente, sopla aire caliente',
        'Hace un ruido fuerte al encender',
        'Gotea agua por el frente del equipo',
        'No enciende, el compresor no arranca',
        'Mal olor al encender el equipo',
        'El control remoto no responde',
        'Congela en exceso y forma hielo',
        'Consume mucha energía últimamente',
      ];
      const horas = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
      const hora = horas[Math.floor(Math.random() * horas.length)];

      await crearServicio({
        clienteId: cliente.id,
        equipoId: equipos.length > 0 ? equipos[0].id : undefined,
        tecnicoId: usuario!.id,
        descripcion_falla: fallas[Math.floor(Math.random() * fallas.length)],
        fecha_programada: format(new Date(), 'yyyy-MM-dd'),
        hora_inicio: hora,
        hora_fin: `${parseInt(hora) + 2}:00`,
        direccion_servicio: cliente.direccion_principal || 'Calle 80 #45-12, Barranquilla',
        valor_estimado: [80000, 100000, 120000, 150000][Math.floor(Math.random() * 4)],
        notas_admin: 'Servicio de prueba creado desde la app del técnico',
        origen: 'manual' as const,
      } as Parameters<typeof crearServicio>[0]);
      toast.success(`Servicio creado para ${cliente.nombre}`);
      cargarServicios();
    } catch {
      toast.error('Error creando servicio');
    }
    finally { setCreandoTest(false); }
  };

  const handleEnCamino = async (e: React.MouseEvent, servicio: Servicio) => {
    e.stopPropagation();
    setAccionandoId(servicio.id);
    try {
      await cambiarEstadoServicio(servicio.id, 'en_camino');
      toast.success('Notificación enviada al cliente');
      cargarServicios();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Error al cambiar estado');
    }
    finally { setAccionandoId(null); }
  };

  const handleLlegue = async (e: React.MouseEvent, servicio: Servicio) => {
    e.stopPropagation();
    setAccionandoId(servicio.id);
    try {
      await cambiarEstadoServicio(servicio.id, 'en_servicio');
      navigate(`/tecnico/servicio/${servicio.id}`);
    } catch {
      toast.error('Error');
    }
    finally { setAccionandoId(null); }
  };

  const sorted = [...servicios].sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
  const activo = sorted.find(s => s.estado === 'en_servicio');
  const pausados = sorted.filter(s => s.estado === 'pausado');
  const pendientes = sorted.filter(s => ['asignado', 'en_camino'].includes(s.estado));
  const completados = sorted.filter(s => s.estado === 'completado');
  const totalGanado = completados.reduce((acc, s) => acc + (s.valor_final || 0), 0);

  const calificacion = usuario?.estadisticas?.calificacion_promedio || 0;
  const nombre = usuario?.nombre?.split(' ')[0] || 'Técnico';
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="max-w-lg mx-auto">
      {/* Hero greeting section */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-5 pt-[env(safe-area-inset-top,12px)] pb-5 rounded-b-[2rem]">
        <div className="flex items-center justify-between pt-4 mb-4">
          <div className="flex-1">
            <p className="text-blue-200 text-xs font-medium">{saludo}</p>
            <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">{nombre}</h1>
            <p className="text-blue-300 text-xs mt-0.5 capitalize">
              {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDescargarAgenda}
              disabled={descargando || loading}
              title="Descargar agenda para usar sin internet"
              className="h-10 w-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors disabled:opacity-60"
            >
              {descargando
                ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                : <Download className="h-4 w-4 text-white" />
              }
            </button>
            <button
              onClick={openSearch}
              className="h-10 w-10 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              <Search className="h-4.5 w-4.5 text-white" />
            </button>
            <div className="h-11 w-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-base font-bold border-2 border-white/30">
              {usuario?.foto_url ? (
                <img src={usuario.foto_url} alt={nombre} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                nombre.charAt(0)
              )}
            </div>
          </div>
        </div>

        {/* Quick stats — compactos */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-200 shrink-0" />
            <div>
              <p className="text-lg font-bold text-white leading-tight">{servicios.length}</p>
              <p className="text-[9px] text-blue-200 font-medium">Hoy</p>
            </div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-200 shrink-0" />
            <div>
              <p className="text-lg font-bold text-white leading-tight">{completados.length}</p>
              <p className="text-[9px] text-blue-200 font-medium">Hechos</p>
            </div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
            <Star className="h-4 w-4 text-blue-200 shrink-0" />
            <div>
              <p className="text-lg font-bold text-white leading-tight">{calificacion > 0 ? calificacion.toFixed(1) : '--'}</p>
              <p className="text-[9px] text-blue-200 font-medium">Rating</p>
            </div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-200 shrink-0" />
            <div>
              <p className="text-lg font-bold text-white leading-tight">{proximos.length}</p>
              <p className="text-[9px] text-blue-200 font-medium">Próx.</p>
            </div>
          </div>
        </div>

        {/* Barra de progreso de descarga */}
        {descargaProgreso && (
          <div className="mt-3 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-white font-medium">Descargando agenda...</span>
              <span className="text-[10px] text-blue-200">{descargaProgreso.done}/{descargaProgreso.total}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5">
              <div
                className="bg-white h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(descargaProgreso.done / descargaProgreso.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 mt-3 space-y-3 pb-4">
        {/* Active service card */}
        {activo && (
        <div
            className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl shadow-lg shadow-orange-500/20"
          >
            <div
              className="p-4 cursor-pointer"
              onClick={() => navigate(`/tecnico/servicio/${activo.id}`)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">
                  Servicio activo
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Wrench className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{activo.cliente?.nombre}</p>
                  <p className="text-xs text-white/80 truncate">
                    {activo.equipo ? `${tipoEquipoLabel[activo.equipo.tipo]} ${activo.equipo.marca || ''}` : 'Sin equipo'}
                  </p>
                  <p className="text-xs text-white/70 mt-0.5">{activo.hora_inicio || '--:--'}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <ArrowRight className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Earnings card */}
        {completados.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Ganado hoy</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(totalGanado)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Servicios</p>
                <p className="text-sm font-bold text-emerald-600">{completados.length}/{servicios.length}</p>
              </div>
            </div>
            <div className="mt-3 w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: servicios.length > 0 ? `${(completados.length / servicios.length) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 animate-pulse">
                <div className="flex gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded-lg w-3/4" />
                    <div className="h-3 bg-slate-100 rounded-lg w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && servicios.length === 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
            <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mx-auto mb-3">
              <Snowflake className="h-8 w-8 text-blue-300" />
            </div>
            <p className="font-bold text-slate-700 text-base">Sin servicios para hoy</p>
            {proximos.length > 0 ? (
              <>
                <p className="text-sm text-slate-400 mt-1">
                  Tienes <span className="font-semibold text-blue-600">{proximos.length} servicio{proximos.length !== 1 ? 's' : ''}</span> programado{proximos.length !== 1 ? 's' : ''} próximamente
                </p>
                <button
                  onClick={() => navigate('/tecnico/calendario')}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors"
                >
                  Ver agenda <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-1">Sin agenda próxima — disfruta tu día</p>
            )}
          </div>
        )}

        {/* Paused services */}
        {pausados.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-bold text-slate-700">Continuaciones pendientes</h2>
              <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2.5 py-1 rounded-full">{pausados.length} pausado{pausados.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2.5">
              {pausados.map(s => (
                <div
                  key={s.id}
                  className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 overflow-hidden cursor-pointer hover:shadow-md transition-all"
                  onClick={() => navigate(`/tecnico/servicio/${s.id}`)}
                >
                  <div className="p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="text-center shrink-0 min-w-[44px]">
                        <p className="text-base font-bold text-amber-800 leading-tight">{s.hora_inicio || '--:--'}</p>
                        <p className="text-[10px] text-amber-500">{s.hora_fin || ''}</p>
                      </div>
                      <div className="w-px h-10 bg-amber-200 shrink-0" />
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm shrink-0 border border-amber-200">
                          {s.cliente?.nombre?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-800 truncate">{s.cliente?.nombre || 'Cliente'}</p>
                          {s.nota_pausa && (
                            <p className="text-xs text-amber-700 truncate mt-0.5">"{s.nota_pausa}"</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/tecnico/servicio/${s.id}`); }}
                        className="shrink-0 h-11 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 flex items-center gap-1.5 text-xs font-bold text-white transition-colors shadow-sm"
                      >
                        <Wrench className="h-4 w-4" />
                        <span>Retomar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending services */}
        {pendientes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-bold text-slate-700">Próximos servicios</h2>
              <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-full">{pendientes.length} pendientes</span>
            </div>
            <div className="space-y-2.5">
              {pendientes.map((s, idx) => {
                const isExpanded = expandedId === s.id;
                return (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="p-3.5">
                    <div className="flex items-center gap-3">
                      <button
                        className="text-center shrink-0 min-w-[44px]"
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      >
                        <p className="text-base font-bold text-slate-800 leading-tight">{s.hora_inicio || '--:--'}</p>
                        <p className="text-[10px] text-slate-400">{s.hora_fin || ''}</p>
                      </button>

                      <div className="w-px h-10 bg-slate-100 shrink-0" />

                      <button
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      >
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 border border-slate-100">
                          {s.cliente?.nombre?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-slate-800 truncate">{s.cliente?.nombre || 'Cliente'}</p>
                            {idx === 0 && !activo && s.estado === 'asignado' && (
                              <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full shrink-0">Siguiente</span>
                            )}
                            {s.origen === 'whatsapp' && (
                              <MessageSquare className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {s.equipo ? `${tipoEquipoLabel[s.equipo.tipo]} ${s.equipo.marca || ''}`.trim() : 'Sin equipo'}
                            {s.descripcion_falla ? ` · ${s.descripcion_falla}` : ''}
                          </p>
                        </div>
                      </button>

                      {s.estado === 'asignado' ? (
                        <button
                          onClick={(e) => handleEnCamino(e, s)}
                          disabled={accionandoId === s.id}
                          className="shrink-0 h-11 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 text-xs font-bold text-white transition-colors shadow-sm disabled:opacity-60"
                        >
                          <Navigation className="h-4 w-4" />
                          <span>En camino</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleLlegue(e, s)}
                          disabled={accionandoId === s.id}
                          className="shrink-0 h-11 px-3.5 rounded-xl bg-green-600 hover:bg-green-700 flex items-center gap-1.5 text-xs font-bold text-white transition-colors shadow-sm animate-pulse disabled:opacity-60"
                        >
                          <Wrench className="h-4 w-4" />
                          <span>Iniciar servicio</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <a href={s.cliente?.telefono ? `tel:${s.cliente.telefono}` : '#'} className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-slate-100">
                            <Phone className="h-4 w-4 text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] text-slate-400">Teléfono</p>
                              <p className="text-xs font-semibold text-slate-700 truncate">{s.cliente?.telefono || '--'}</p>
                            </div>
                          </a>
                          <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-slate-100">
                            <Wrench className="h-4 w-4 text-indigo-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] text-slate-400">Equipo</p>
                              <p className="text-xs font-semibold text-slate-700 truncate">
                                {s.equipo ? `${tipoEquipoLabel[s.equipo.tipo]} ${s.equipo.marca || ''}`.trim() : '--'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {s.direccion_servicio && (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(s.direccion_servicio)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-slate-100"
                          >
                            <MapPin className="h-4 w-4 text-purple-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-slate-400">Dirección</p>
                              <p className="text-xs font-semibold text-slate-700 truncate">{s.direccion_servicio}</p>
                            </div>
                            <Navigation className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          </a>
                        )}

                        {s.descripcion_falla && (
                          <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100/80">
                            <p className="text-[10px] text-amber-600 font-semibold mb-0.5">Falla reportada</p>
                            <p className="text-xs text-amber-900">{s.descripcion_falla}</p>
                          </div>
                        )}

                        {s.notas_admin && (
                          <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-100/80">
                            <p className="text-[10px] text-blue-600 font-semibold mb-0.5">Nota del admin</p>
                            <p className="text-xs text-blue-900">{s.notas_admin}</p>
                          </div>
                        )}

                        {s.valor_estimado && (
                          <div className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-slate-100">
                            <span className="text-xs text-slate-400">Valor estimado</span>
                            <span className="text-sm font-bold text-slate-800">{formatCurrency(s.valor_estimado)}</span>
                          </div>
                        )}
                      </div>

                      <div className="px-4 pb-4 flex gap-2">
                        {s.cliente?.telefono && (
                          <a
                            href={`tel:${s.cliente.telefono}`}
                            className="h-11 flex-1 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                            Llamar
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </div>
        )}

        {/* Completed services */}
        {completados.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-bold text-slate-700">Completados hoy</h2>
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">{completados.length}</span>
            </div>
            <div className="space-y-2">
              {completados.map(s => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-700">{s.cliente?.nombre}</p>
                    <p className="text-xs text-slate-400">
                      {s.hora_inicio || '--:--'}
                      {s.equipo ? ` · ${tipoEquipoLabel[s.equipo.tipo]}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {s.valor_final && <p className="text-sm font-bold text-slate-700">{formatCurrency(s.valor_final)}</p>}
                    {s.calificacion_cliente && (
                      <div className="flex items-center gap-0.5 justify-end">
                        {Array.from({ length: s.calificacion_cliente }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Próximos servicios (otros días) */}
        {!loading && proximos.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-bold text-slate-700">Próxima agenda</h2>
              <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-1 rounded-full">{proximos.length} servicio{proximos.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {proximos.map(s => (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center gap-3"
                >
                  <div className="shrink-0 text-center min-w-[48px] bg-indigo-50 rounded-xl py-2 px-1">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase leading-tight">
                      {s.fecha_programada ? format(new Date(String(s.fecha_programada).substring(0, 10) + 'T12:00:00'), 'EEE', { locale: es }) : '--'}
                    </p>
                    <p className="text-base font-black text-indigo-700 leading-tight">
                      {s.fecha_programada ? format(new Date(String(s.fecha_programada).substring(0, 10) + 'T12:00:00'), 'd', { locale: es }) : '--'}
                    </p>
                    <p className="text-[9px] text-indigo-400 font-medium">
                      {s.hora_inicio || '--:--'}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800 truncate">{s.cliente?.nombre || 'Cliente'}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {s.equipo ? `${tipoEquipoLabel[s.equipo.tipo]} ${s.equipo.marca || ''}`.trim() : 'Sin equipo'}
                      {s.descripcion_falla ? ` · ${s.descripcion_falla}` : ''}
                    </p>
                    {s.direccion_servicio && (
                      <p className="text-[10px] text-slate-300 truncate mt-0.5 flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />{s.direccion_servicio}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => navigate('/tecnico/calendario')}
                    className="shrink-0 h-8 w-8 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test button */}
        <button
          onClick={crearServicioTest}
          disabled={creandoTest}
          className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-center gap-2 text-sm font-medium text-slate-400 hover:text-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {creandoTest ? 'Creando...' : 'Crear servicio de prueba'}
        </button>
      </div>
    </div>
  );
};
