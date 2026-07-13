import { useEffect, useState, useCallback } from 'react';
import { getServicios, getServicio, cambiarEstadoServicio, asignarTecnico, eliminarServicio, actualizarServicio, crearServicio, subirFactura, eliminarFactura } from '@/api/servicios';
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
  CheckCircle, Trash2, AlertTriangle, Clock, Pencil, Save,
  XCircle, ArrowRightLeft, CalendarClock, FileText, Upload, ExternalLink,
} from 'lucide-react';

type EditForm = {
  fecha_programada: string;
  hora_inicio: string;
  hora_fin: string;
  tipo_servicio: string;
  descripcion_falla: string;
  direccion_servicio: string;
  valor_estimado: string;
  notas_admin: string;
};

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
  const [secciones, setSecciones] = useState({ info: true, cotizacion: false, timeline: false, checklist: false, fotos: false, cierre: false });

  // Edit mode
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    fecha_programada: '', hora_inicio: '', hora_fin: '',
    tipo_servicio: '', descripcion_falla: '', direccion_servicio: '',
    valor_estimado: '', notas_admin: '',
  });
  const [saving, setSaving] = useState(false);
  const [proximoServicio, setProximoServicio] = useState<Servicio | null>(null);
  const [modalTraslado, setModalTraslado] = useState(false);
  const [nuevoTecnicoId, setNuevoTecnicoId] = useState('');
  const [modalContinuar, setModalContinuar] = useState(false);
  const [continuarFecha, setContinuarFecha] = useState('');
  const [continuarHora, setContinuarHora] = useState('');
  const [continuarNota, setContinuarNota] = useState('');
  const [subiendoFactura, setSubiendoFactura] = useState(false);
  const [facturaProgress, setFacturaProgress] = useState(0);

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

  const fetchProximoServicio = async (s: Servicio) => {
    if (s.estado !== 'en_servicio' || !s.tecnicoId || !s.fecha_programada) {
      setProximoServicio(null);
      return;
    }
    try {
      const fecha = String(s.fecha_programada).substring(0, 10);
      const { data: res } = await getServicios({ tecnico_id: s.tecnicoId, fecha, limit: '10' });
      const candidatos = (res.data as Servicio[])
        .filter(sv => sv.id !== s.id && sv.hora_inicio && (!s.hora_fin || sv.hora_inicio >= s.hora_fin))
        .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
      setProximoServicio(candidatos[0] || null);
    } catch { setProximoServicio(null); }
  };

  const openDrawer = async (id: string) => {
    try {
      const { data: res } = await getServicio(id);
      setSelected(res.data);
      setDrawerOpen(true);
      setEditando(false);
      fetchProximoServicio(res.data);
    } catch { toast.error('Error cargando servicio'); }
  };

  const startEdit = (s: Servicio) => {
    setEditForm({
      fecha_programada: s.fecha_programada ? String(s.fecha_programada).substring(0, 10) : '',
      hora_inicio: s.hora_inicio || '',
      hora_fin: s.hora_fin || '',
      tipo_servicio: s.tipo_servicio || '',
      descripcion_falla: s.descripcion_falla || '',
      direccion_servicio: s.direccion_servicio || '',
      valor_estimado: s.valor_estimado != null ? String(s.valor_estimado) : '',
      notas_admin: s.notas_admin || '',
    });
    setEditando(true);
  };

  const handleGuardar = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        descripcion_falla: editForm.descripcion_falla || null,
        direccion_servicio: editForm.direccion_servicio || null,
        hora_inicio: editForm.hora_inicio || null,
        hora_fin: editForm.hora_fin || null,
        notas_admin: editForm.notas_admin || null,
        tipo_servicio: (editForm.tipo_servicio as Servicio['tipo_servicio']) || null,
      };
      if (editForm.fecha_programada) payload.fecha_programada = editForm.fecha_programada;
      if (editForm.valor_estimado !== '') payload.valor_estimado = parseFloat(editForm.valor_estimado);
      await actualizarServicio(selected.id, payload);
      toast.success('Servicio actualizado');
      setEditando(false);
      await openDrawer(selected.id);
      fetchServicios();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error guardando');
    } finally { setSaving(false); }
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

  const handleTraslado = async () => {
    if (!selected || !nuevoTecnicoId) return;
    setSaving(true);
    try {
      await asignarTecnico(selected.id, nuevoTecnicoId);
      toast.success('Técnico reasignado');
      setModalTraslado(false);
      setNuevoTecnicoId('');
      fetchServicios();
      openDrawer(selected.id);
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error en traslado'); }
    finally { setSaving(false); }
  };

  const handleContinuarDespues = async () => {
    if (!selected || !continuarFecha || !continuarHora) return;
    setSaving(true);
    try {
      await cambiarEstadoServicio(selected.id, 'cancelado', {
        motivo_cancelacion: `Reprogramado para el ${continuarFecha} a las ${continuarHora}${continuarNota ? `. ${continuarNota}` : ''}`,
      });
      await crearServicio({
        clienteId: selected.clienteId,
        equipoId: selected.equipoId,
        tecnicoId: selected.tecnicoId,
        tipo_servicio: selected.tipo_servicio,
        descripcion_falla: selected.descripcion_falla,
        direccion_servicio: selected.direccion_servicio,
        valor_estimado: selected.valor_estimado,
        notas_admin: continuarNota || selected.notas_admin,
        fecha_programada: continuarFecha,
        hora_inicio: continuarHora,
      });
      toast.success('Servicio reprogramado — nuevo servicio creado');
      setModalContinuar(false);
      setContinuarFecha('');
      setContinuarHora('');
      setContinuarNota('');
      setDrawerOpen(false);
      setSelected(null);
      fetchServicios();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error reprogramando'); }
    finally { setSaving(false); }
  };

  const handleSubirFactura = () => {
    if (!selected) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setSubiendoFactura(true);
      setFacturaProgress(0);
      try {
        const formData = new FormData();
        formData.append('factura', file);
        const { data: res } = await subirFactura(selected.id, formData, setFacturaProgress);
        setSelected(prev => prev ? { ...prev, factura_url: res.data.factura_url, factura_subida_at: res.data.factura_subida_at } : prev);
        toast.success('Factura cargada correctamente');
        fetchServicios();
      } catch { toast.error('Error subiendo la factura'); }
      finally { setSubiendoFactura(false); setFacturaProgress(0); }
    };
    input.click();
  };

  const handleEliminarFactura = async () => {
    if (!selected || !window.confirm('¿Eliminar la factura cargada?')) return;
    try {
      await eliminarFactura(selected.id);
      setSelected(prev => prev ? { ...prev, factura_url: undefined, factura_subida_at: undefined } : prev);
      toast.success('Factura eliminada');
      fetchServicios();
    } catch { toast.error('Error eliminando la factura'); }
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
      setProximoServicio(null);
      fetchServicios();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error eliminando servicio'); }
  };

  const filtrados = servicios.filter(s => {
    if (filtroEstado === 'sin_factura') {
      if (s.estado !== 'completado' || s.factura_url) return false;
    }
    if (!buscar) return true;
    const q = buscar.toLowerCase();
    return s.cliente?.nombre?.toLowerCase().includes(q) || s.direccion_servicio?.toLowerCase().includes(q);
  });

  const toggleSeccion = (key: keyof typeof secciones) =>
    setSecciones(prev => ({ ...prev, [key]: !prev[key] }));

  const canEdit = selected && selected.estado !== 'completado' && selected.estado !== 'cancelado';

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
          <Select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }} className="w-52 rounded-xl bg-slate-50 border-slate-100">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="asignado">Asignado</option>
            <option value="en_camino">En camino</option>
            <option value="en_servicio">En servicio</option>
            <option value="pausado">Pausado</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
            <option value="sin_factura">⚠ Pendiente factura</option>
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
                          {s.estado === 'completado' && !s.factura_url && (
                            <span title="Factura pendiente" className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-100 text-orange-500 shrink-0">
                              <FileText className="h-3 w-3" />
                            </span>
                          )}
                          {s.sla_ejecucion?.excedido && (
                            <span title={`Excedió SLA: ${s.sla_ejecucion.real_min} min (máx. ${s.sla_ejecucion.max_min} min)`} className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-100 text-red-500 shrink-0">
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                          {s.estado === 'en_servicio' && s.fecha_inicio_real && (() => {
                            const horas = Math.round((Date.now() - new Date(s.fecha_inicio_real).getTime()) / 3600000);
                            return horas >= 8 ? (
                              <span title={`Lleva ${horas} h en ejecución sin cerrarse`} className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-100 text-orange-500 shrink-0">
                                <Clock className="h-3 w-3" />
                              </span>
                            ) : null;
                          })()}
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
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => { setDrawerOpen(false); setEditando(false); setProximoServicio(null); }} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-100 p-5 flex items-center justify-between z-10">
              <h2 className="font-bold text-slate-800">Detalle del servicio</h2>
              <button onClick={() => { setDrawerOpen(false); setEditando(false); setProximoServicio(null); }} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Tres acciones principales */}
            {selected.estado !== 'completado' && selected.estado !== 'cancelado' && (
              <div className="px-5 pt-4 pb-2 grid grid-cols-3 gap-2">
                <button
                  onClick={() => setModalContinuar(true)}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  <CalendarClock className="h-5 w-5" />
                  <span className="text-[11px] font-semibold leading-tight text-center">Continuar después</span>
                </button>
                <button
                  onClick={() => { setNuevoTecnicoId(selected.tecnicoId || ''); setModalTraslado(true); }}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <ArrowRightLeft className="h-5 w-5" />
                  <span className="text-[11px] font-semibold leading-tight text-center">Traslado</span>
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`¿Cancelar el servicio de "${selected.cliente?.nombre || 'este cliente'}"?`)) return;
                    await handleCambiarEstado(selected.id, 'cancelado');
                  }}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
                >
                  <XCircle className="h-5 w-5" />
                  <span className="text-[11px] font-semibold leading-tight text-center">Cancelar servicio</span>
                </button>
              </div>
            )}

            <div className="p-5 space-y-3">
              {[
                { key: 'info' as const, label: 'Información general' },
                ...(((selected.repuestos && selected.repuestos.length > 0) || selected.valor_final != null)
                  ? [{ key: 'cotizacion' as const, label: `Cotización${selected.valor_final ? ` — ${formatCurrency(selected.valor_final)}` : ''}` }]
                  : []),
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
                      {/* Estado + acciones */}
                      <div className="flex items-center justify-between">
                        <EstadoBadge estado={selected.estado} />
                        <div className="flex gap-1.5">
                          {canEdit && !editando && (
                            <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => startEdit(selected)}>
                              <Pencil className="h-3.5 w-3.5" /> Editar
                            </Button>
                          )}
                          {selected.estado === 'pendiente' && (
                            <Button size="sm" className="rounded-xl" onClick={() => handleCambiarEstado(selected.id, 'asignado')} disabled={!selected.tecnicoId}>
                              Asignar
                            </Button>
                          )}
                          {selected.estado !== 'completado' && selected.estado !== 'cancelado' && (
                            <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => handleCambiarEstado(selected.id, 'cancelado')}>
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* ── MODO EDICIÓN ── */}
                      {editando ? (
                        <div className="space-y-3 bg-blue-50/40 border border-blue-100 rounded-xl p-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tipo de servicio</label>
                              <select
                                value={editForm.tipo_servicio}
                                onChange={e => setEditForm(f => ({ ...f, tipo_servicio: e.target.value }))}
                                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              >
                                <option value="">Sin asignar</option>
                                <option value="diagnostico">Diagnóstico</option>
                                <option value="mantenimiento">Mantenimiento</option>
                                <option value="reparacion">Reparación</option>
                                <option value="instalacion">Instalación</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Fecha</label>
                              <Input type="date" value={editForm.fecha_programada} onChange={e => setEditForm(f => ({ ...f, fecha_programada: e.target.value }))} className="rounded-lg h-9 text-sm" />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Hora inicio</label>
                              <Input type="time" value={editForm.hora_inicio} onChange={e => setEditForm(f => ({ ...f, hora_inicio: e.target.value }))} className="rounded-lg h-9 text-sm" />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-slate-500 block mb-1">Hora fin</label>
                              <Input type="time" value={editForm.hora_fin} onChange={e => setEditForm(f => ({ ...f, hora_fin: e.target.value }))} className="rounded-lg h-9 text-sm" />
                            </div>
                          </div>
                          {proximoServicio && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                              <span>Próximo servicio del técnico: <strong>{proximoServicio.cliente?.nombre}</strong> a las <strong>{proximoServicio.hora_inicio}</strong></span>
                            </div>
                          )}
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Dirección</label>
                            <Input value={editForm.direccion_servicio} onChange={e => setEditForm(f => ({ ...f, direccion_servicio: e.target.value }))} placeholder="Dirección del servicio" className="rounded-lg h-9 text-sm" />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Falla reportada</label>
                            <textarea
                              value={editForm.descripcion_falla}
                              onChange={e => setEditForm(f => ({ ...f, descripcion_falla: e.target.value }))}
                              rows={2}
                              placeholder="Descripción de la falla"
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Valor estimado</label>
                            <Input type="number" value={editForm.valor_estimado} onChange={e => setEditForm(f => ({ ...f, valor_estimado: e.target.value }))} placeholder="0" className="rounded-lg h-9 text-sm" />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-500 block mb-1">Notas admin</label>
                            <textarea
                              value={editForm.notas_admin}
                              onChange={e => setEditForm(f => ({ ...f, notas_admin: e.target.value }))}
                              rows={2}
                              placeholder="Notas internas"
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button onClick={handleGuardar} disabled={saving} className="flex-1 rounded-xl gap-1.5">
                              <Save className="h-4 w-4" />
                              {saving ? 'Guardando…' : 'Guardar cambios'}
                            </Button>
                            <Button variant="ghost" onClick={() => setEditando(false)} className="rounded-xl">
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ── MODO LECTURA ── */
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Cliente</p><p className="font-semibold text-slate-700">{selected.cliente?.nombre}</p></div>
                          <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Teléfono</p><p className="font-semibold text-slate-700">{selected.cliente?.telefono}</p></div>
                          <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Tipo de servicio</p><p className="font-semibold text-slate-700 capitalize">{selected.tipo_servicio || '--'}</p></div>
                          <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[11px] text-slate-400 font-medium mb-0.5">Fecha</p>
                            <p className="font-semibold text-slate-700">{selected.fecha_programada ? formatDate(selected.fecha_programada) : '--'}</p>
                            {(selected.hora_inicio || selected.hora_fin) && (
                              <p className="text-xs text-slate-400 mt-0.5">{selected.hora_inicio || ''}{selected.hora_fin ? ` — ${selected.hora_fin}` : ''}</p>
                            )}
                          </div>
                          <div className="col-span-2 bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Equipo</p><p className="font-semibold text-slate-700">{selected.equipo ? `${tipoEquipoLabel[selected.equipo.tipo]} ${selected.equipo.marca || ''}` : '--'}</p></div>
                          <div className="col-span-2 bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Dirección</p><p className="font-semibold text-slate-700">{selected.direccion_servicio || '--'}</p></div>
                          <div className="col-span-2 bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Falla reportada</p><p className="text-slate-600">{selected.descripcion_falla || '--'}</p></div>
                          {selected.valor_estimado != null && (
                            <div className="bg-slate-50 rounded-xl p-3"><p className="text-[11px] text-slate-400 font-medium mb-0.5">Valor estimado</p><p className="font-semibold text-slate-700">{formatCurrency(selected.valor_estimado)}</p></div>
                          )}
                          {selected.notas_admin && (
                            <div className="col-span-2 bg-amber-50 border border-amber-100 rounded-xl p-3"><p className="text-[11px] text-amber-600 font-medium mb-0.5">Notas admin</p><p className="text-slate-600 text-xs">{selected.notas_admin}</p></div>
                          )}
                        </div>
                      )}

                      {/* Panel SLA */}
                      {!editando && (
                        <div className={`rounded-xl p-4 border ${
                          selected.sla_ejecucion?.excedido === true ? 'bg-red-50 border-red-200'
                            : selected.sla_ejecucion?.excedido === false ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            {selected.sla_ejecucion?.excedido === true ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                              : selected.sla_ejecucion?.excedido === false ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                              : <Clock className="h-4 w-4 text-slate-400 shrink-0" />}
                            <span className={`text-sm font-semibold ${
                              selected.sla_ejecucion?.excedido === true ? 'text-red-700'
                                : selected.sla_ejecucion?.excedido === false ? 'text-emerald-700'
                                : 'text-slate-600'
                            }`}>
                              {selected.sla_ejecucion?.excedido === true ? 'Excedió el tiempo SLA'
                                : selected.sla_ejecucion?.excedido === false ? 'Dentro del tiempo SLA'
                                : selected.sla_ejecucion ? 'Tiempo de ejecución — en curso'
                                : 'Tiempo de ejecución SLA'}
                            </span>
                          </div>
                          {selected.sla_ejecucion ? (
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-[11px] text-slate-500 font-medium">Tiempo esperado</p>
                                <p className="font-semibold text-slate-700 mt-0.5">{selected.sla_ejecucion.max_min} min</p>
                              </div>
                              {selected.sla_ejecucion.real_min !== null ? (
                                <div>
                                  <p className="text-[11px] text-slate-500 font-medium">Tiempo real</p>
                                  <p className={`font-semibold mt-0.5 ${selected.sla_ejecucion.excedido ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {selected.sla_ejecucion.real_min} min
                                    {selected.sla_ejecucion.excedido && (
                                      <span className="text-[11px] text-red-400 font-normal ml-1">(+{selected.sla_ejecucion.real_min - selected.sla_ejecucion.max_min} min extra)</span>
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-[11px] text-slate-500 font-medium">Tiempo real</p>
                                  <p className="text-[11px] text-slate-400 mt-0.5 italic">Disponible al completar</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">
                              {selected.tipo_servicio ? 'Sin configuración SLA para este tipo' : 'Asigna un tipo de servicio para ver el SLA'}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Técnico asignado */}
                      {!editando && (
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
                      )}
                    </div>
                  )}

                  {secciones[key] && key === 'cotizacion' && (
                    <div className="p-4 space-y-3 text-sm">
                      {selected.repuestos && selected.repuestos.length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2">Repuestos y materiales</p>
                          {selected.repuestos.map((r, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-slate-700 font-medium truncate flex-1">{r.nombre}</span>
                              <span className="text-slate-400 shrink-0">×{r.cantidad}</span>
                              <span className="text-slate-600 font-semibold shrink-0 tabular-nums">
                                {r.precio_unitario > 0 ? formatCurrency(r.cantidad * r.precio_unitario) : '—'}
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-xs">
                            <span className="text-slate-500">Subtotal repuestos</span>
                            <span className="text-slate-700 tabular-nums">
                              {formatCurrency(selected.repuestos.reduce((s, r) => s + r.cantidad * r.precio_unitario, 0))}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                          <p className="text-[11px] text-emerald-600 font-medium mb-0.5">Valor total</p>
                          <p className="font-bold text-lg text-emerald-700">{selected.valor_final ? formatCurrency(selected.valor_final) : '--'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[11px] text-slate-400 font-medium mb-0.5">Método de pago</p>
                          <p className="font-semibold text-slate-700 capitalize">{selected.metodo_pago?.replace('_', ' ') || '--'}</p>
                        </div>
                      </div>
                      {selected.notas_tecnico && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[11px] text-slate-400 font-medium mb-0.5">Notas del técnico</p>
                          <p className="text-slate-600">{selected.notas_tecnico}</p>
                        </div>
                      )}
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

                      {/* Firma */}
                      {selected.firma && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[11px] text-slate-400 font-medium mb-2">Firma del cliente</p>
                          <img src={selected.firma.url} alt="Firma" className="h-20 border border-slate-200 rounded-xl" />
                        </div>
                      )}

                      {selected.calificacion_cliente && (
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-[11px] text-slate-400 font-medium mb-1">Calificación</p>
                          <p className="text-lg">{'★'.repeat(selected.calificacion_cliente)}{'☆'.repeat(5 - selected.calificacion_cliente)}</p>
                        </div>
                      )}

                      {/* Factura admin */}
                      <div className={`rounded-xl p-4 border space-y-3 ${selected.factura_url ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
                        <div className="flex items-center gap-2">
                          <FileText className={`h-4 w-4 shrink-0 ${selected.factura_url ? 'text-emerald-600' : 'text-orange-500'}`} />
                          <p className={`text-sm font-semibold ${selected.factura_url ? 'text-emerald-700' : 'text-orange-700'}`}>
                            {selected.factura_url ? 'Factura cargada' : 'Factura pendiente'}
                          </p>
                        </div>

                        {selected.factura_url ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={selected.factura_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center gap-2 py-2 px-3 bg-white border border-emerald-200 rounded-lg text-xs text-emerald-700 font-medium hover:bg-emerald-50 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              Ver factura
                            </a>
                            <button
                              onClick={handleEliminarFactura}
                              className="py-2 px-3 bg-white border border-red-200 rounded-lg text-xs text-red-500 font-medium hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs text-orange-600">Carga la factura del servicio para cerrar el expediente.</p>
                            {subiendoFactura && (
                              <div>
                                <div className="flex justify-between text-xs text-blue-600 mb-1">
                                  <span>Subiendo...</span><span>{facturaProgress}%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${facturaProgress}%` }} />
                                </div>
                              </div>
                            )}
                            <button
                              onClick={handleSubirFactura}
                              disabled={subiendoFactura}
                              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white border border-orange-300 rounded-lg text-sm font-semibold text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-50"
                            >
                              <Upload className="h-4 w-4" />
                              {subiendoFactura ? `Subiendo ${facturaProgress}%` : 'Subir factura'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Acción eliminar (permanente) */}
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

      {/* Modal Traslado */}
      {modalTraslado && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-500" />
                <h3 className="font-bold text-lg">Traslado de técnico</h3>
              </div>
              <button onClick={() => setModalTraslado(false)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Técnico actual</label>
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-3 py-2">{selected.tecnico?.nombre || 'Sin asignar'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Nuevo técnico</label>
              <select
                value={nuevoTecnicoId}
                onChange={e => setNuevoTecnicoId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                <option value="">Seleccionar técnico...</option>
                {tecnicos.filter(t => t.id !== selected.tecnicoId).map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleTraslado}
              disabled={saving || !nuevoTecnicoId}
              className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Confirmar traslado
            </button>
          </div>
        </div>
      )}

      {/* Modal Continuar después */}
      {modalContinuar && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-lg">Continuar después</h3>
              </div>
              <button onClick={() => setModalContinuar(false)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-500">El servicio actual se cancela y se crea uno nuevo para la fecha indicada con el mismo técnico y cliente.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Nueva fecha</label>
                <input
                  type="date"
                  value={continuarFecha}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setContinuarFecha(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Hora</label>
                <input
                  type="time"
                  value={continuarHora}
                  onChange={e => setContinuarHora(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Nota (opcional)</label>
              <textarea
                value={continuarNota}
                onChange={e => setContinuarNota(e.target.value)}
                placeholder="Ej: Cliente solicitó reprogramar..."
                rows={2}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <button
              onClick={handleContinuarDespues}
              disabled={saving || !continuarFecha || !continuarHora}
              className="w-full min-h-11 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <CalendarClock className="h-4 w-4" />
              Reprogramar servicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
