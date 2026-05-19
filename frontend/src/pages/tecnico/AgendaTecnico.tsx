import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getServicios, cambiarEstadoServicio, crearServicio, eliminarServicio } from '@/api/servicios';
import { getClientes } from '@/api/clientes';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { toast } from '@/components/shared/Toast';
import { tipoEquipoLabel, formatCurrency } from '@/utils/helpers';
import type { Servicio } from '@/types';
import {
  Phone, MapPin, Navigation, Wrench, Search, Star,
  CheckCircle2, ArrowRight, TrendingUp,
  Calendar, Snowflake, MessageSquare,
  FileText, Plus, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const AgendaTecnico = () => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { usuario } = useAuthStore();
  const { socket } = useSocketStore();
  const navigate = useNavigate();
  const { openSearch } = useOutletContext<{ openSearch: () => void }>();

  const cargarServicios = useCallback(async () => {
    try {
      const { data: res } = await getServicios({
        tecnico_id: usuario!.id,
        fecha: format(new Date(), 'yyyy-MM-dd'),
      });
      setServicios(res.data);
    } catch {
      toast.error('Error cargando agenda');
    }
  }, [usuario]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await cargarServicios();
      setLoading(false);
    };
    load();
  }, [cargarServicios]);

  useEffect(() => {
    socket?.on('servicio_actualizado', cargarServicios);
    return () => { socket?.off('servicio_actualizado', cargarServicios); };
  }, [socket, cargarServicios]);

  const [accionandoId, setAccionandoId] = useState<string | null>(null);
  const [creandoTest, setCreandoTest] = useState(false);

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
    } catch {
      toast.error('Error');
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

  const handleEliminarActivo = async (e: React.MouseEvent, servicio: Servicio) => {
    e.stopPropagation();
    const confirmar = window.confirm(`¿Eliminar el servicio de "${servicio.cliente?.nombre || 'este cliente'}"?`);
    if (!confirmar) return;
    try {
      await eliminarServicio(servicio.id);
      toast.success('Servicio eliminado');
      cargarServicios();
    } catch {
      toast.error('Error eliminando');
    }
  };

  const sorted = [...servicios].sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
  const activo = sorted.find(s => s.estado === 'en_servicio');
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
        <div className="grid grid-cols-3 gap-2">
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
        </div>
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
            <button
              onClick={(e) => handleEliminarActivo(e, activo)}
              className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs font-medium rounded-b-2xl"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar servicio de prueba
            </button>
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
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center mx-auto mb-4">
              <Snowflake className="h-9 w-9 text-blue-300" />
            </div>
            <p className="font-bold text-slate-700 text-base">Sin servicios para hoy</p>
            <p className="text-sm text-slate-400 mt-1">Disfruta tu día libre</p>
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
                          <MapPin className="h-4 w-4" />
                          <span>Llegué</span>
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
                        <button
                          onClick={(e) => handleEliminarActivo(e, s)}
                          className="h-11 px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 text-red-500 flex items-center justify-center transition-colors shrink-0"
                          title="Eliminar servicio"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {s.cliente?.telefono && (
                          <a
                            href={`tel:${s.cliente.telefono}`}
                            className="h-11 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 transition-colors shrink-0"
                          >
                            <Phone className="h-4 w-4" />
                            Llamar
                          </a>
                        )}
                        <button
                          onClick={() => navigate(`/tecnico/servicio/${s.id}`)}
                          className="h-11 flex-1 rounded-xl bg-slate-700 hover:bg-slate-800 flex items-center justify-center gap-1.5 text-sm font-semibold text-white transition-colors shadow-sm"
                        >
                          <FileText className="h-4 w-4" />
                          Ver detalle
                        </button>
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
