import { useEffect, useState, useCallback } from 'react';
import { getServicios, getServicio, cambiarEstadoServicio, asignarTecnico, eliminarServicio } from '@/api/servicios';
import { getUsuarios } from '@/api/usuarios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { LoadingSkeleton } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from '@/components/shared/Toast';
import { formatDate, formatCurrency, formatRelative, tipoEquipoLabel } from '@/utils/helpers';
import type { Servicio, Usuario, ChecklistItem, EventoServicio } from '@/types';
import {
  Search, X, ChevronDown, ChevronUp,
  CheckCircle, Trash2, AlertTriangle, Clock,
} from 'lucide-react';

export const Servicios = () => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Servicio | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTecnico, setFiltroTecnico] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [secciones, setSecciones] = useState({ info: true, timeline: false, checklist: false, fotos: false, cierre: false });

  const fetchServicios = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (filtroEstado) params.estado = filtroEstado;
      if (filtroTecnico) params.tecnico_id = filtroTecnico;
      const { data: res } = await getServicios(params);
      setServicios(res.data);
      setTotalPages(res.meta?.totalPages || 1);
    } catch { toast.error('Error cargando servicios'); }
    finally { setLoading(false); }
  }, [page, filtroEstado, filtroTecnico]);

  useEffect(() => { fetchServicios(); }, [fetchServicios]);
  useEffect(() => {
    getUsuarios({ rol: 'tecnico', activo: 'true' }).then(r => setTecnicos(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) openDrawer(id);
  }, []);

  const openDrawer = async (id: string) => {
    try {
      const { data: res } = await getServicio(id);
      setSelected(res.data);
      setDrawerOpen(true);
    } catch { toast.error('Error cargando servicio'); }
  };

  const handleAsignar = async (servicioId: string, tecnicoId: string) => {
    try {
      await asignarTecnico(servicioId, tecnicoId);
      toast.success('Técnico asignado');
      fetchServicios();
      if (selected?.id === servicioId) openDrawer(servicioId);
    } catch { toast.error('Error asignando técnico'); }
  };

  const handleCambiarEstado = async (id: string, estado: string) => {
    try {
      await cambiarEstadoServicio(id, estado);
      toast.success('Estado actualizado');
      fetchServicios();
      if (selected?.id === id) openDrawer(id);
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error'); }
  };

  const handleEliminar = async () => {
    if (!selected) return;
    const confirmar = window.confirm(`¿Eliminar el servicio de "${selected.cliente?.nombre || 'este cliente'}"? Esta acción no se puede deshacer.`);
    if (!confirmar) return;
    try {
      await eliminarServicio(selected.id);
      toast.success('Servicio eliminado');
      setDrawerOpen(false);
      setSelected(null);
      fetchServicios();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error eliminando servicio'); }
  };

  const filtrados = servicios.filter(s => {
    if (!buscar) return true;
    const q = buscar.toLowerCase();
    return s.cliente?.nombre?.toLowerCase().includes(q) || s.direccion_servicio?.toLowerCase().includes(q);
  });

  const toggleSeccion = (key: keyof typeof secciones) =>
    setSecciones(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Servicios</h1>
        <p className="text-sm text-slate-400 mt-0.5">Gestiona todos los servicios técnicos</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
            <Input placeholder="Buscar cliente o dirección..." value={buscar} onChange={e => setBuscar(e.target.value)} className="pl-9 rounded-xl bg-slate-50 border-slate-100" />
          </div>
          <Select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }} className="w-44 rounded-xl bg-slate-50 border-slate-100">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="asignado">Asignado</option>
            <option value="en_camino">En camino</option>
            <option value="en_servicio">En servicio</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
          </Select>
          <Select value={filtroTecnico} onChange={e => { setFiltroTecnico(e.target.value); setPage(1); }} className="w-44 rounded-xl bg-slate-50 border-slate-100">
            <option value="">Todos los técnicos</option>
            {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </Select>
        </div>
      </Card>

      {/* Table */}
      {loading ? <LoadingSkeleton rows={8} /> : filtrados.length === 0 ? (
        <EmptyState title="No hay servicios" description="No se encontraron servicios con los filtros aplicados" />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha</th>
                    <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                    <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Equipo</th>
                    <th className="text-left py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Técnico</th>
                    <th className="text-center py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                    <th className="text-right py-3.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(s => (
                    <tr key={s.id} className="border-t border-slate-50 hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => openDrawer(s.id)}>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-700">{s.fecha_programada ? formatDate(s.fecha_programada) : '--'}</p>
                        <p className="text-[11px] text-slate-400">{s.hora_inicio || ''}</p>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{s.cliente?.nombre || 'N/A'}</td>
                      <td className="py-3.5 px-4 text-slate-500 hidden md:table-cell">{s.equipo ? tipoEquipoLabel[s.equipo.tipo] : '--'}</td>
                      <td className="py-3.5 px-4 hidden sm:table-cell">{s.tecnico?.nombre || <span className="text-amber-500 text-xs font-medium">Sin asignar</span>}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <EstadoBadge estado={s.estado} />
                          {s.sla_ejecucion?.excedido && (
                            <span title={`Excedió SLA: ${s.sla_ejecucion.real_min} min (máx. ${s.sla_ejecucion.max_min} min)`} className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-100 text-red-500 shrink-0">
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 hidden lg:table-cell">{s.valor_final ? formatCurrency(s.valor_final) : s.valor_estimado ? formatCurrency(s.valor_estimado) : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-xl">Anterior</Button>
              <span className="text-sm text-slate-500 font-medium">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl">Siguiente</Button>
            </div>
          )}
        </>
      )}

      {/* Drawer */}
      {drawerOpen && selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-100 p-5 flex items-center justify-between z-10">
              <h2 className="font-bold text-slate-800">Detalle del servicio</h2>
              <button onClick={() => setDrawerOpen(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100"><X className="h-4 w-4 text-slate-400" /></button>
            </div>

            <div className="p-5 space-y-3">
              {[
                { key: 'info' as const, label: 'Información general' },
                { key: 'timeline' as const, label: `Timeline (${selected.eventos?.length || 0})` },
                { key: 'checklist' as const, label: `Checklist (${selected.checklist?.filter(c => c.completado).length || 0}/${selected.checklist?.length || 0})` },
                { key: 'fotos' as const, label: `Fotos (${selected.fotos?.length || 0})` },
                { key: 'cierre' as const, label: 'Cierre' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <button className="w-full flex items-center justify-between p-3.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors" onClick={() => toggleSeccion(key)}>
                    <span className="font-semibold text-sm text-slate-700">{label}</span>
                    {secciones[key] ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </button>

                  {secciones[key] && key === 'info' && (
                    <div className="space-y-4 p-4">
                      <div className="flex items-center justify-between">
                        <EstadoBadge estado={selected.estado} />
                        <div className="flex gap-1.5">
                          {selected.estado === 'pendiente' && <Button size="sm" className="rounded-xl" onClick={() => handleCambiarEstado(selected.id, 'asignado')} disabled={!selected.tecnicoId}>Asignar</Button>}
                          {selected.estado !== 'completado' && selected.estado !== 'cancelado' && (
                            <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => handleCambiarEstado(selected.id, 'cancelado')}>Cancelar</Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Cliente</p><p className="font-semibold text-slate-700">{selected.cliente?.nombre}</p></div>
                        <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Teléfono</p><p className="font-semibold text-slate-700">{selected.cliente?.telefono}</p></div>
                        <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Equipo</p><p className="font-semibold text-slate-700">{selected.equipo ? `${tipoEquipoLabel[selected.equipo.tipo]} ${selected.equipo.marca || ''}` : '--'}</p></div>
                        <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Fecha</p><p className="font-semibold text-slate-700">{selected.fecha_programada ? formatDate(selected.fecha_programada) : '--'}</p></div>
                        <div className="col-span-2 bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Dirección</p><p className="font-semibold text-slate-700">{selected.direccion_servicio || '--'}</p></div>
                        <div className="col-span-2 bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Falla reportada</p><p className="text-slate-600">{selected.descripcion_falla || '--'}</p></div>
                      </div>
                      {/* Panel SLA ejecución — solo admin, no visible al técnico */}
                      {selected.sla_ejecucion && (
                        <div className={`rounded-xl p-4 border ${
                          selected.sla_ejecucion.excedido === true
                            ? 'bg-red-50 border-red-200'
                            : selected.sla_ejecucion.excedido === false
                              ? 'bg-emerald-50 border-emerald-200'
                              : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            {selected.sla_ejecucion.excedido === true
                              ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                              : selected.sla_ejecucion.excedido === false
                                ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                                : <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                            }
                            <span className={`text-sm font-semibold ${
                              selected.sla_ejecucion.excedido === true
                                ? 'text-red-700'
                                : selected.sla_ejecucion.excedido === false
                                  ? 'text-emerald-700'
                                  : 'text-slate-700'
                            }`}>
                              {selected.sla_ejecucion.excedido === true
                                ? 'Excedió el tiempo SLA'
                                : selected.sla_ejecucion.excedido === false
                                  ? 'Dentro del tiempo SLA'
                                  : 'Tiempo estimado de ejecución'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-[11px] text-slate-500 font-medium">Tiempo esperado</p>
                              <p className="font-semibold text-slate-700 mt-0.5">{selected.sla_ejecucion.max_min} min</p>
                            </div>
                            {selected.sla_ejecucion.real_min !== null && (
                              <div>
                                <p className="text-[11px] text-slate-500 font-medium">Tiempo real</p>
                                <p className={`font-semibold mt-0.5 ${selected.sla_ejecucion.excedido ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {selected.sla_ejecucion.real_min} min
                                  {selected.sla_ejecucion.excedido && (
                                    <span className="text-[11px] text-red-400 font-normal ml-1">
                                      (+{selected.sla_ejecucion.real_min - selected.sla_ejecucion.max_min} min)
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] text-slate-400 font-medium mb-1.5">Técnico asignado</p>
                        {selected.estado === 'completado' || selected.estado === 'cancelado' ? (
                          <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700">
                            {selected.tecnico?.nombre || <span className="text-slate-400 font-normal">Sin asignar</span>}
                          </div>
                        ) : (
                          <Select value={selected.tecnicoId || ''} onChange={e => e.target.value && handleAsignar(selected.id, e.target.value)} className="rounded-xl">
                            <option value="">Seleccionar técnico</option>
                            {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                          </Select>
                        )}
                      </div>
                    </div>
                  )}

                  {secciones[key] && key === 'timeline' && (
                    <div className="pl-4 border-l-2 border-blue-200 space-y-4 p-4 ml-4">
                      {selected.eventos?.map((ev: EventoServicio) => (
                        <div key={ev.id} className="relative pl-5">
                          <div className="absolute -left-[calc(0.625rem+1px)] top-1 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-50" />
                          <p className="text-sm font-medium text-slate-700">{ev.descripcion}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{ev.usuario?.nombre || 'Sistema'} · {formatRelative(ev.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {secciones[key] && key === 'checklist' && (
                    <div className="p-4 space-y-2">
                      {(['llegada', 'diagnostico', 'reparacion', 'cierre'] as const).map(cat => {
                        const items = selected.checklist?.filter(c => c.categoria === cat) || [];
                        if (items.length === 0) return null;
                        return (
                          <div key={cat}>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-3 mb-1.5">{cat}</p>
                            {items.map((item: ChecklistItem) => (
                              <div key={item.id} className="flex items-center gap-2.5 py-1.5">
                                <CheckCircle className={`h-4 w-4 shrink-0 ${item.completado ? 'text-emerald-500' : 'text-slate-200'}`} />
                                <span className={`text-sm ${item.completado ? 'line-through text-slate-400' : 'text-slate-600'}`}>{item.descripcion}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {secciones[key] && key === 'fotos' && (
                    <div className="grid grid-cols-3 gap-2 p-4">
                      {selected.fotos?.length ? selected.fotos.map(f => (
                        <div key={f.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                          <img src={f.url} alt={f.tipo} className="w-full h-full object-cover" />
                          <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-lg capitalize font-medium">{f.tipo}</span>
                        </div>
                      )) : <p className="col-span-3 text-sm text-slate-400 text-center py-6">Sin fotos</p>}
                    </div>
                  )}

                  {secciones[key] && key === 'cierre' && (
                    <div className="p-4 space-y-4 text-sm">
                      {selected.firma && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[11px] text-slate-400 font-medium mb-2">Firma del cliente</p>
                          <img src={selected.firma.url} alt="Firma" className="h-20 border border-slate-200 rounded-xl" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[11px] text-slate-400 font-medium mb-0.5">Valor cobrado</p>
                          <p className="font-bold text-lg text-emerald-600">{selected.valor_final ? formatCurrency(selected.valor_final) : '--'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[11px] text-slate-400 font-medium mb-0.5">Método de pago</p>
                          <p className="font-semibold text-slate-700 capitalize">{selected.metodo_pago?.replace('_', ' ') || '--'}</p>
                        </div>
                      </div>
                      {selected.notas_tecnico && <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Notas del técnico</p><p className="text-slate-600">{selected.notas_tecnico}</p></div>}
                      {selected.calificacion_cliente && (
                        <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-1">Calificación</p><p className="text-lg">{'★'.repeat(selected.calificacion_cliente)}{'☆'.repeat(5 - selected.calificacion_cliente)}</p></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Botón eliminar */}
            <div className="p-5 border-t border-slate-100">
              <button
                onClick={handleEliminar}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors text-sm font-medium"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar servicio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
