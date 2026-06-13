import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { getClientes, getHistorialCliente } from '@/api/clientes';
import { formatCurrency, tipoEquipoLabel } from '@/utils/helpers';
import {
  Home, CirclePlay, CircleUser, CalendarDays, Search, X, Phone, Star, Wrench,
  ChevronLeft, Camera, MapPin, FileText, MessageSquare, User, Pen,
} from 'lucide-react';

const navItems = [
  { to: '/tecnico/agenda', icon: Home, label: 'Inicio' },
  { to: '/tecnico/calendario', icon: CalendarDays, label: 'Calendario' },
  { to: '/tecnico/servicio', icon: CirclePlay, label: 'Servicio' },
  { to: '/tecnico/perfil', icon: CircleUser, label: 'Perfil' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const fotoUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
};

const estadoBadge = (estado: string) => {
  const map: Record<string, string> = {
    completado: 'bg-emerald-100 text-emerald-700',
    cancelado: 'bg-red-100 text-red-700',
    en_servicio: 'bg-orange-100 text-orange-700',
    en_camino: 'bg-amber-100 text-amber-700',
    asignado: 'bg-blue-100 text-blue-700',
    pendiente: 'bg-slate-100 text-slate-700',
  };
  return map[estado] || 'bg-slate-100 text-slate-700';
};

type View = 'search' | 'historial' | 'servicio-detalle';

export const TecnicoLayout = () => {
  const { usuario } = useAuthStore();
  usePushNotifications(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [view, setView] = useState<View>('search');
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [historial, setHistorial] = useState<any>(null);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [searchOpen]);

  useEffect(() => {
    if (!query || query.length < 2) { setResultados([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data: res } = await getClientes({ buscar: query, limit: '8' });
        setResultados(res.data);
      } catch { setResultados([]); }
      finally { setSearching(false); }
    }, 300);
  }, [query]);

  const openHistorial = async (cliente: any) => {
    setSelectedCliente(cliente);
    setView('historial');
    setLoadingHistorial(true);
    try {
      const { data: res } = await getHistorialCliente(cliente.id);
      setHistorial(res.data);
    } catch { setHistorial(null); }
    finally { setLoadingHistorial(false); }
  };

  const openServicioDetalle = (servicio: any) => {
    setSelectedServicio(servicio);
    setView('servicio-detalle');
  };

  const cerrar = () => {
    setSearchOpen(false);
    setQuery('');
    setResultados([]);
    setSelectedCliente(null);
    setHistorial(null);
    setSelectedServicio(null);
    setView('search');
  };

  const goBack = () => {
    if (view === 'servicio-detalle') {
      setSelectedServicio(null);
      setView('historial');
    } else if (view === 'historial') {
      setSelectedCliente(null);
      setHistorial(null);
      setView('search');
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-slate-50">
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-100 shrink-0">
            {view !== 'search' ? (
              <button onClick={goBack} className="h-8 w-8 rounded-xl flex items-center justify-center hover:bg-slate-100 shrink-0">
                <ChevronLeft className="h-4 w-4 text-slate-500" />
              </button>
            ) : (
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
            )}
            {view === 'search' ? (
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar cliente por nombre o teléfono..."
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedCliente(null); setHistorial(null); setView('search'); }}
                className="flex-1 text-sm outline-none bg-transparent placeholder:text-slate-400"
              />
            ) : view === 'historial' ? (
              <p className="flex-1 text-sm font-semibold text-slate-700 truncate">{selectedCliente?.nombre}</p>
            ) : (
              <p className="flex-1 text-sm font-semibold text-slate-700">Detalle del servicio</p>
            )}
            <button onClick={cerrar} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* === SEARCH VIEW === */}
            {view === 'search' && (
              <>
                {searching && <p className="text-sm text-slate-400 text-center py-8">Buscando...</p>}

                {!searching && query.length < 2 && (
                  <div className="text-center py-16">
                    <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                      <Search className="h-7 w-7 text-blue-300" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Busca un cliente</p>
                    <p className="text-xs text-slate-400 mt-1">Escribe al menos 2 caracteres</p>
                  </div>
                )}

                {!searching && query.length >= 2 && resultados.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-sm text-slate-400">Sin resultados para "{query}"</p>
                  </div>
                )}

                {resultados.map(c => (
                  <button
                    key={c.id}
                    onClick={() => openHistorial(c)}
                    className="w-full text-left px-4 py-3.5 border-b border-slate-50 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                        {c.nombre.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800">{c.nombre}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-3 w-3" />{c.telefono}
                          {c.total_servicios > 0 && <span className="ml-2">· {c.total_servicios} servicios</span>}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* === HISTORIAL VIEW === */}
            {view === 'historial' && (
              <div className="p-4 space-y-4">
                {/* Client card */}
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-lg shrink-0">
                    {selectedCliente?.nombre?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{selectedCliente?.nombre}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <a href={`tel:${selectedCliente?.telefono}`} className="flex items-center gap-1 text-blue-600">
                        <Phone className="h-3 w-3" />{selectedCliente?.telefono}
                      </a>
                    </div>
                  </div>
                </div>

                {loadingHistorial ? (
                  <div className="text-center py-8">
                    <div className="h-6 w-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 mt-2">Cargando historial...</p>
                  </div>
                ) : historial ? (
                  <>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-blue-50 rounded-2xl p-3 text-center">
                        <p className="text-lg font-bold text-blue-700">{historial.stats.total_servicios}</p>
                        <p className="text-[10px] text-blue-500 font-medium">Servicios</p>
                      </div>
                      <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(historial.stats.total_gastado)}</p>
                        <p className="text-[10px] text-emerald-500 font-medium">Total</p>
                      </div>
                      <div className="bg-amber-50 rounded-2xl p-3 text-center">
                        <p className="text-lg font-bold text-amber-700 flex items-center justify-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-500" />{historial.stats.calificacion_promedio.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-amber-500 font-medium">Rating</p>
                      </div>
                    </div>

                    {/* Equipos */}
                    {historial.equipos.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Equipos</p>
                        <div className="flex flex-wrap gap-2">
                          {historial.equipos.map((eq: any) => (
                            <span key={eq.id} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1">
                              <Wrench className="h-3 w-3" />
                              {tipoEquipoLabel[eq.tipo]} {eq.marca || ''} {eq.modelo || ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reminder */}
                    {historial.proximo_recordatorio && (
                      <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 font-medium">
                        Próximo mantenimiento: {new Date(historial.proximo_recordatorio.fecha_proximo_recordatorio).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    )}

                    {/* Services list — clickable */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Historial de servicios</p>
                      {historial.servicios.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">Sin servicios registrados</p>
                      ) : (
                        <div className="space-y-2">
                          {historial.servicios.map((s: any) => (
                            <button
                              key={s.id}
                              onClick={() => openServicioDetalle(s)}
                              className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-xl p-3 space-y-1 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-500">
                                  {s.fecha_programada ? new Date(s.fecha_programada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}
                                  {s.hora_inicio && ` · ${s.hora_inicio}`}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {s.fotos?.length > 0 && (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                      <Camera className="h-3 w-3" />{s.fotos.length}
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${estadoBadge(s.estado)}`}>
                                    {s.estado.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                              {s.equipo && <p className="text-xs text-slate-500">{tipoEquipoLabel[s.equipo.tipo]} {s.equipo.marca || ''}</p>}
                              {s.descripcion_falla && <p className="text-sm text-slate-700 line-clamp-2">{s.descripcion_falla}</p>}
                              <p className="text-xs text-slate-400">
                                {s.tecnico?.nombre || '--'}
                                {s.valor_final ? ` · ${formatCurrency(s.valor_final)}` : ''}
                                {s.calificacion_cliente ? ` · ${'★'.repeat(s.calificacion_cliente)}` : ''}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">Error cargando historial</p>
                )}
              </div>
            )}

            {/* === SERVICE DETAIL VIEW === */}
            {view === 'servicio-detalle' && selectedServicio && (
              <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${estadoBadge(selectedServicio.estado)}`}>
                      {selectedServicio.estado.replace('_', ' ')}
                    </span>
                    {selectedServicio.origen === 'whatsapp' && (
                      <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />WhatsApp
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {selectedServicio.fecha_programada
                      ? new Date(selectedServicio.fecha_programada).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                      : '--'}
                  </span>
                </div>

                {/* Client & service info */}
                <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100">
                  <div className="p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Cliente</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedCliente?.nombre}</p>
                    </div>
                  </div>

                  {selectedServicio.direccion_servicio && (
                    <div className="p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Dirección</p>
                        <p className="text-sm font-semibold text-slate-800">{selectedServicio.direccion_servicio}</p>
                      </div>
                    </div>
                  )}

                  {selectedServicio.equipo && (
                    <div className="p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                        <Wrench className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Equipo</p>
                        <p className="text-sm font-semibold text-slate-800">
                          {tipoEquipoLabel[selectedServicio.equipo.tipo]} {selectedServicio.equipo.marca || ''} {selectedServicio.equipo.modelo || ''}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedServicio.tecnico && (
                    <div className="p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Técnico asignado</p>
                        <p className="text-sm font-semibold text-slate-800">{selectedServicio.tecnico.nombre}</p>
                      </div>
                    </div>
                  )}

                  {selectedServicio.hora_inicio && (
                    <div className="p-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Horario</p>
                        <p className="text-sm font-semibold text-slate-800">{selectedServicio.hora_inicio}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reason / fault */}
                {selectedServicio.descripcion_falla && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Motivo del servicio</p>
                    <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-100">
                      <p className="text-sm text-amber-900">{selectedServicio.descripcion_falla}</p>
                    </div>
                  </div>
                )}

                {/* Admin notes */}
                {selectedServicio.notas_admin && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Notas del administrador</p>
                    <div className="bg-blue-50 rounded-2xl p-3.5 border border-blue-100">
                      <p className="text-sm text-blue-900">{selectedServicio.notas_admin}</p>
                    </div>
                  </div>
                )}

                {/* Technician description */}
                {selectedServicio.notas_tecnico && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Descripción del técnico</p>
                    <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Pen className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-700">{selectedServicio.tecnico?.nombre || 'Técnico'}</span>
                      </div>
                      <p className="text-sm text-emerald-900">{selectedServicio.notas_tecnico}</p>
                    </div>
                  </div>
                )}

                {/* Photos */}
                {selectedServicio.fotos?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Fotos del servicio ({selectedServicio.fotos.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedServicio.fotos.map((f: any) => (
                        <div key={f.id} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                          <img src={fotoUrl(f.url)} alt={f.tipo} className="w-full h-full object-cover" />
                          <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm ${
                            f.tipo === 'antes' ? 'bg-red-500/80 text-white' :
                            f.tipo === 'despues' ? 'bg-emerald-500/80 text-white' :
                            'bg-blue-500/80 text-white'
                          }`}>
                            {f.tipo === 'antes' ? 'Antes' : f.tipo === 'despues' ? 'Después' : 'Durante'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signature */}
                {selectedServicio.firma?.url && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Firma del cliente</p>
                    <div className="bg-white rounded-2xl border border-slate-200 p-2">
                      <img src={fotoUrl(selectedServicio.firma.url)} alt="Firma" className="w-full h-24 object-contain" />
                    </div>
                  </div>
                )}

                {/* Value & rating */}
                {(selectedServicio.valor_final || selectedServicio.calificacion_cliente) && (
                  <div className="flex gap-3">
                    {selectedServicio.valor_final && (
                      <div className="flex-1 bg-emerald-50 rounded-2xl p-3 text-center">
                        <p className="text-[10px] text-emerald-500 font-medium">Valor cobrado</p>
                        <p className="text-lg font-bold text-emerald-700">{formatCurrency(selectedServicio.valor_final)}</p>
                      </div>
                    )}
                    {selectedServicio.calificacion_cliente && (
                      <div className="flex-1 bg-amber-50 rounded-2xl p-3 text-center">
                        <p className="text-[10px] text-amber-500 font-medium">Calificación</p>
                        <div className="flex items-center justify-center gap-0.5 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-4 w-4 ${i < selectedServicio.calificacion_cliente ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet context={{ openSearch: () => setSearchOpen(true) }} />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-[env(safe-area-inset-bottom,8px)] pt-2 bg-white/80 backdrop-blur-xl border-t border-slate-200/60">
        <div className="flex items-center justify-around max-w-sm mx-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 px-4 rounded-2xl transition-all duration-200 ${
                  isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                  <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
