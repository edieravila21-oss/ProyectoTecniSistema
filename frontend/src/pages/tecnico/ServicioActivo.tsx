import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getServicio, cambiarEstadoServicio,
  subirFoto, eliminarFoto, guardarFirma, actualizarServicio,
  getHistorialEquipo,
} from '@/api/servicios';
import { cacheServicio, getCachedServicio, enqueueFoto } from '@/lib/offlineDb';
import { processSyncQueue } from '@/lib/syncManager';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { getHistorialCliente } from '@/api/clientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { toast } from '@/components/shared/Toast';
import { tipoEquipoLabel, formatCurrency } from '@/utils/helpers';
import type { Servicio, MetodoPago } from '@/types';
import {
  Phone, MapPin, Camera, Check, WifiOff,
  Trash2, Download, Pen, ArrowLeft, ArrowRight, PartyPopper, History,
  User, Clock, DollarSign, Star, Plus, X, PauseCircle, PlayCircle, ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import SignatureCanvas from 'react-signature-canvas';

interface HistorialCliente {
  stats: { total_servicios: number; total_gastado: number; calificacion_promedio: number };
  servicios: Servicio[];
  proximo_recordatorio?: { fecha_proximo_recordatorio: string };
}

const pasos = ['En camino', 'Llegada', 'Diagnóstico', 'Cotización', 'Reparación', 'Cierre'];

const repuestosComunes: Record<string, { nombre: string; precio: number }[]> = {
  aire_acondicionado: [
    { nombre: 'Capacitor', precio: 25000 },
    { nombre: 'Contactor', precio: 35000 },
    { nombre: 'Gas R-410A (lb)', precio: 45000 },
    { nombre: 'Gas R-22 (lb)', precio: 35000 },
    { nombre: 'Motor ventilador', precio: 85000 },
    { nombre: 'Tarjeta electrónica', precio: 120000 },
    { nombre: 'Filtro', precio: 15000 },
    { nombre: 'Sensor temperatura', precio: 20000 },
    { nombre: 'Válvula expansión', precio: 65000 },
  ],
  nevera: [
    { nombre: 'Gas R-134a', precio: 35000 },
    { nombre: 'Gas R-600a', precio: 40000 },
    { nombre: 'Compresor', precio: 180000 },
    { nombre: 'Termostato', precio: 25000 },
    { nombre: 'Motor ventilador', precio: 45000 },
    { nombre: 'Resistencia deshielo', precio: 30000 },
    { nombre: 'Timer deshielo', precio: 35000 },
    { nombre: 'Tarjeta electrónica', precio: 80000 },
    { nombre: 'Sello puerta', precio: 40000 },
    { nombre: 'Sensor temperatura', precio: 20000 },
  ],
  otro: [
    { nombre: 'Repuesto genérico', precio: 0 },
    { nombre: 'Tarjeta electrónica', precio: 80000 },
    { nombre: 'Motor', precio: 60000 },
    { nombre: 'Sensor', precio: 20000 },
    { nombre: 'Cable/conector', precio: 10000 },
  ],
};

export const ServicioActivo = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [servicio, setServicio] = useState<Servicio | null>(null);
  const [loading, setLoading] = useState(true);
  const [pasoActual, setPasoActual] = useState(0);
  const initialLoadDone = useRef(false);
  const isOffline = useOfflineStatus();
  const [uploadingTipos, setUploadingTipos] = useState<Set<string>>(new Set());
  const [deletingFotos, setDeletingFotos] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [observacionesDiag, setObservacionesDiag] = useState('');
  const [observacionesRep, setObservacionesRep] = useState('');
  const [costoServicio, setCostoServicio] = useState('');
  const [valorFinal, setValorFinal] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [showExito, setShowExito] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);
  const [firmada, setFirmada] = useState(false);
  const [historialEquipo, setHistorialEquipo] = useState<Servicio[]>([]);
  const [historialTotal, setHistorialTotal] = useState(0);
  const [clienteHistorial, setClienteHistorial] = useState<HistorialCliente | null>(null);
  const [repuestos, setRepuestos] = useState<{ nombre: string; cantidad: number; precio_unitario: number }[]>([]);
  const [showCustomRepuesto, setShowCustomRepuesto] = useState(false);
  const [customRepuestoNombre, setCustomRepuestoNombre] = useState('');
  const [modalPausa, setModalPausa] = useState(false);
  const [notaPausa, setNotaPausa] = useState('');
  const [fechaReanudacion, setFechaReanudacion] = useState('');
  const [horaReanudacion, setHoraReanudacion] = useState('');
  const [observacionesLlegada, setObservacionesLlegada] = useState('');
  const [llegadaModal, setLlegadaModal] = useState(false);
  const [llegadaSelecciones, setLlegadaSelecciones] = useState<string[]>([]);
  const [diagModal, setDiagModal] = useState(false);
  const [diagSelecciones, setDiagSelecciones] = useState<string[]>([]);
  const [repModal, setRepModal] = useState(false);
  const [repSelecciones, setRepSelecciones] = useState<string[]>([]);

  const fetchServicio = async () => {
    if (!id) return;
    let data: Servicio | undefined;

    if (!navigator.onLine) {
      data = await getCachedServicio(id).catch(() => undefined);
      if (!data) {
        toast.error('Sin conexión y sin datos en caché para este servicio');
        setLoading(false);
        return;
      }
    } else {
      try {
        const { data: res } = await getServicio(id);
        data = res.data;
        cacheServicio(data).catch(() => {});
      } catch {
        toast.error('Error cargando servicio');
        setLoading(false);
        return;
      }
    }

    setServicio(data);

    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      if (data.estado === 'asignado' || data.estado === 'en_camino' || data.estado === 'pausado') setPasoActual(0);
      else if (data.estado === 'en_servicio') setPasoActual(1);
    }
    if (data.valor_final) setValorFinal(String(data.valor_final));
    if (data.repuestos) setRepuestos(data.repuestos);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchServicio(); }, [id]);

  useEffect(() => {
    const handleOnline = async () => {
      toast.success('Conexión restaurada — sincronizando...');
      const synced = await processSyncQueue();
      if (synced > 0 || id) fetchServicio();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  useEffect(() => {
    if (servicio?.equipoId) {
      getHistorialEquipo(servicio.equipoId, servicio.id)
        .then(r => {
          setHistorialEquipo(r.data.data.servicios);
          setHistorialTotal(r.data.data.total);
        })
        .catch(() => {});
    }
    if (servicio?.clienteId) {
      getHistorialCliente(servicio.clienteId)
        .then(r => setClienteHistorial(r.data.data))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicio?.equipoId, servicio?.clienteId]);

  const handleCambiarEstado = async (estado: string) => {
    if (!id) return;
    setSaving(true);
    try {
      await cambiarEstadoServicio(id, estado);
      toast.success(`Estado: ${estado.replace('_', ' ')}`);
      fetchServicio();
    } catch (err: unknown) { toast.error((err as {response?: {data?: {error?: string}}}).response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const handlePausar = async () => {
    if (!id || !notaPausa.trim() || !fechaReanudacion || !horaReanudacion) return;
    setSaving(true);
    try {
      await cambiarEstadoServicio(id, 'pausado', { nota_pausa: notaPausa.trim(), fecha_reanudacion: fechaReanudacion, hora_reanudacion: horaReanudacion });
      toast.success('Servicio pausado');
      setModalPausa(false);
      navigate('/tecnico/agenda');
    } catch (err: unknown) { toast.error((err as {response?: {data?: {error?: string}}}).response?.data?.error || 'Error al pausar'); }
    finally { setSaving(false); }
  };

  const handleRetomar = async () => {
    if (!id || !servicio) return;
    setSaving(true);
    try {
      await cambiarEstadoServicio(id, 'en_servicio');
      toast.success('Servicio reanudado');
      setPasoActual(1);
      fetchServicio();
    } catch (err: unknown) { toast.error((err as {response?: {data?: {error?: string}}}).response?.data?.error || 'Error al retomar'); }
    finally { setSaving(false); }
  };


  const handleClienteAcepta = async () => {
    if (!id) return;
    const subtotalRepuestos = repuestos.reduce((sum, r) => sum + r.cantidad * r.precio_unitario, 0);
    const costoServ = parseFloat(costoServicio) || 0;
    const total = subtotalRepuestos + costoServ;
    setSaving(true);
    try {
      await actualizarServicio(id, {
        repuestos,
        valor_final: total || undefined,
        metodo_pago: metodoPago as MetodoPago,
      });
      if (total) setValorFinal(String(total));
      toast.success('Cotización aceptada — procedemos con la reparación');
      setPasoActual(4);
    } catch { toast.error('Error guardando cotización'); }
    finally { setSaving(false); }
  };

  const handleSubirFoto = (tipo: 'antes' | 'durante' | 'despues', source: 'camera' | 'gallery' = 'camera') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !id) return;

      if (!navigator.onLine) {
        const localUrl = URL.createObjectURL(file);
        const fakeId = `local-${Date.now()}`;
        setServicio(prev => prev ? {
          ...prev,
          fotos: [...(prev.fotos || []), { id: fakeId, servicioId: id, url: localUrl, tipo, subida_at: new Date().toISOString() }],
        } : prev);
        await enqueueFoto(id, tipo, file, localUrl).catch(() => {});
        toast.success('📷 Foto guardada localmente — se subirá al recuperar internet');
        return;
      }

      setUploadingTipos(prev => new Set(prev).add(tipo));
      toast.success('📷 Foto tomada, subiendo en segundo plano...');

      try {
        const formData = new FormData();
        formData.append('foto', file);
        formData.append('tipo', tipo);
        await subirFoto(id, formData);
        fetchServicio();
      } catch { toast.error('Error subiendo foto, intenta de nuevo'); }
      finally { setUploadingTipos(prev => { const s = new Set(prev); s.delete(tipo); return s; }); }
    };
    input.click();
  };

  const handleEliminarFoto = async (fotoId: string) => {
    if (!id) return;

    if (fotoId.startsWith('local-')) {
      setServicio(prev => prev ? { ...prev, fotos: (prev.fotos || []).filter(f => f.id !== fotoId) } : prev);
      toast.success('Foto local eliminada');
      return;
    }

    if (!navigator.onLine) {
      toast.error('Necesitas conexión para eliminar fotos ya subidas');
      return;
    }

    setDeletingFotos(prev => new Set(prev).add(fotoId));
    try {
      await eliminarFoto(id, fotoId);
      fetchServicio();
      toast.success('Foto eliminada');
    } catch { toast.error('Error al eliminar la foto'); }
    finally { setDeletingFotos(prev => { const s = new Set(prev); s.delete(fotoId); return s; }); }
  };

  const handleDescargarFoto = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = url.split('/').pop() || 'foto.jpg';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleGuardarFirma = async () => {
    if (!sigRef.current || sigRef.current.isEmpty() || !id) {
      toast.error('Por favor, solicita la firma del cliente');
      return;
    }
    const base64 = sigRef.current.toDataURL('image/png');
    try {
      await guardarFirma(id, base64);
      setFirmada(true);
      toast.success('Firma guardada');
      fetchServicio();
    } catch { toast.error('Error guardando firma'); }
  };

  const handleCerrarServicio = async () => {
    if (!id || !servicio) return;
    if (!firmada && !servicio.firma) { toast.error('Falta la firma del cliente'); return; }

    setSaving(true);
    try {
      if (!firmada && sigRef.current && !sigRef.current.isEmpty()) {
        await handleGuardarFirma();
      }
      const notas = [
        observacionesLlegada && `Llegada:\n${observacionesLlegada}`,
        observacionesDiag && `Diagnóstico:\n${observacionesDiag}`,
        observacionesRep && `Reparación:\n${observacionesRep}`,
      ].filter(Boolean).join('\n\n');
      if (notas) await actualizarServicio(id, { notas_tecnico: notas });
      await cambiarEstadoServicio(id, 'completado');
      setShowExito(true);
      setTimeout(() => navigate('/tecnico/agenda'), 3000);
    } catch (err: unknown) { toast.error((err as {response?: {data?: {error?: string}}}).response?.data?.error || 'Error cerrando servicio'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;
  if (!servicio) return <div className="text-center py-8">Servicio no encontrado</div>;

  if (showExito) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] text-center space-y-4">
        <PartyPopper className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold text-green-600">Servicio completado</h2>
        <p className="text-muted-foreground">El cliente recibirá un resumen por WhatsApp</p>
        <p className="text-sm text-muted-foreground">Redirigiendo a tu agenda...</p>
      </div>
    );
  }


  const renderFotos = (tipo: 'antes' | 'durante' | 'despues', label: string) => {
    const fotos = servicio.fotos?.filter(f => f.tipo === tipo) || [];
    const max = 4;
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">{label}</p>
          <span className={`text-xs font-medium ${fotos.length >= max ? 'text-emerald-600' : 'text-slate-500'}`}>{fotos.length}/{max}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {fotos.map(f => (
            <div key={f.id} className="aspect-square rounded-xl bg-gray-100 relative">
              <img src={f.url} alt={label} className="w-full h-full object-cover rounded-xl" />
              <div className="absolute bottom-1 right-1 flex gap-1">
                <button onClick={() => handleDescargarFoto(f.url)} className="h-7 w-7 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors">
                  <Download className="h-3.5 w-3.5 text-white" />
                </button>
                <button onClick={() => handleEliminarFoto(f.id)} disabled={deletingFotos.has(f.id)} className="h-7 w-7 rounded-lg bg-black/60 hover:bg-red-600 flex items-center justify-center transition-colors disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {fotos.length < max && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="w-full min-h-12" onClick={() => handleSubirFoto(tipo, 'camera')}>
              <Camera className="h-4 w-4 mr-2" />
              {uploadingTipos.has(tipo) ? 'Subiendo...' : 'Tomar foto'}
            </Button>
            <Button variant="outline" className="w-full min-h-12" onClick={() => handleSubirFoto(tipo, 'gallery')}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Galería
            </Button>
          </div>
        )}
        {fotos.length >= max && (
          <p className="text-xs text-emerald-600 font-medium text-center">✓ Fotos completadas</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8">
      {/* Offline banner */}
      {isOffline && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Sin conexión — los cambios se guardan y sincronizan al volver la señal</span>
        </div>
      )}
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {pasos.map((p, i) => (
          <div key={p} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${i <= pasoActual ? 'bg-primary' : 'bg-gray-200'}`} />
            <p className={`text-[9px] mt-1 text-center ${i <= pasoActual ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{p}</p>
          </div>
        ))}
      </div>

      {/* PASO 0 — EN CAMINO */}
      {pasoActual === 0 && (
        <>
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="font-bold text-lg">Información del servicio</h2>

              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <User className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-slate-800">{servicio.cliente?.nombre}</p>
                    {clienteHistorial?.stats && (
                      <p className="text-[11px] text-slate-400">{clienteHistorial.stats.total_servicios} servicios previos · {formatCurrency(clienteHistorial.stats.total_gastado)} total</p>
                    )}
                  </div>
                </div>

                <a href={`tel:${servicio.cliente?.telefono}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <Phone className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-blue-600">{servicio.cliente?.telefono}</span>
                </a>

                {servicio.direccion_servicio && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700">{servicio.direccion_servicio}</span>
                  </div>
                )}

                {servicio.equipo && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm">
                    <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700">{tipoEquipoLabel[servicio.equipo.tipo]} {servicio.equipo.marca || ''} {servicio.equipo.modelo || ''}</span>
                  </div>
                )}

                {servicio.descripcion_falla && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Falla reportada</p>
                    <p className="text-sm text-amber-900">{servicio.descripcion_falla}</p>
                  </div>
                )}

                {servicio.notas_admin && (
                  <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                    <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1">Nota del admin</p>
                    <p className="text-sm text-yellow-900">{servicio.notas_admin}</p>
                  </div>
                )}
              </div>

              {servicio.estado === 'asignado' && (
                <Button className="w-full min-h-12 text-base" onClick={() => handleCambiarEstado('en_camino')} disabled={saving}>
                  Estoy en camino <ArrowRight className="h-5 w-5 ml-1" />
                </Button>
              )}
              {servicio.estado === 'en_camino' && (
                <Button className="w-full min-h-12 text-base bg-green-600 hover:bg-green-700" onClick={() => { handleCambiarEstado('en_servicio'); setPasoActual(1); }} disabled={saving}>
                  Iniciar servicio <Check className="h-5 w-5 ml-1" />
                </Button>
              )}
              {servicio.estado === 'en_servicio' && (
                <Button className="w-full min-h-12 text-base" onClick={() => setPasoActual(1)}>
                  Continuar servicio <ArrowRight className="h-5 w-5 ml-1" />
                </Button>
              )}
              {servicio.estado === 'en_servicio' && (
                <button
                  onClick={() => {
                    setFechaReanudacion(format(new Date(), 'yyyy-MM-dd'));
                    setHoraReanudacion('');
                    setNotaPausa('');
                    setModalPausa(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-amber-600 hover:text-amber-700 transition-colors mt-1"
                >
                  <PauseCircle className="h-4 w-4" />
                  Continuar después
                </button>
              )}
              {servicio.estado === 'pausado' && (
                <div className="space-y-3">
                  {servicio.nota_pausa && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                      <p className="font-semibold text-xs text-amber-600 mb-1">Motivo de pausa</p>
                      {servicio.nota_pausa}
                    </div>
                  )}
                  <Button className="w-full min-h-12 text-base bg-amber-500 hover:bg-amber-600" onClick={handleRetomar} disabled={saving}>
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Retomar servicio
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client history */}
          {clienteHistorial && clienteHistorial.servicios.length > 1 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-violet-600" />
                  <h2 className="font-bold text-lg">Historial del cliente</h2>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg text-slate-600">
                    <DollarSign className="h-3 w-3" />{formatCurrency(clienteHistorial.stats.total_gastado)}
                  </span>
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg text-slate-600">
                    {clienteHistorial.stats.total_servicios} servicios
                  </span>
                  {clienteHistorial.stats.calificacion_promedio > 0 && (
                    <span className="flex items-center gap-1 bg-amber-50 px-2.5 py-1.5 rounded-lg text-amber-700">
                      <Star className="h-3 w-3" />{clienteHistorial.stats.calificacion_promedio.toFixed(1)}
                    </span>
                  )}
                </div>
                {clienteHistorial.proximo_recordatorio && (
                  <div className="p-2.5 bg-blue-50 rounded-xl text-xs text-blue-700">
                    Próximo mantenimiento: {new Date(clienteHistorial.proximo_recordatorio.fecha_proximo_recordatorio).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
                <div className="space-y-2">
                  {clienteHistorial.servicios
                    .filter((s) => s.id !== id)
                    .slice(0, 5)
                    .map((s) => (
                    <div key={s.id} className="bg-slate-50 rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          {s.fecha_programada ? new Date(s.fecha_programada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          s.estado === 'completado' ? 'bg-emerald-100 text-emerald-700' :
                          s.estado === 'cancelado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>{s.estado}</span>
                      </div>
                      {s.equipo && <p className="text-xs text-slate-500">{tipoEquipoLabel[s.equipo.tipo]} {s.equipo.marca || ''}</p>}
                      {s.descripcion_falla && <p className="text-sm text-slate-700">{s.descripcion_falla}</p>}
                      {s.notas_tecnico && <p className="text-xs text-slate-500 italic">{s.notas_tecnico}</p>}
                      <p className="text-xs text-slate-400">
                        {s.tecnico?.nombre || '--'}
                        {s.valor_final ? ` · ${formatCurrency(s.valor_final)}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* HISTORIAL DEL EQUIPO */}
      {pasoActual === 0 && historialEquipo.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-lg">Historial del equipo</h2>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{historialTotal} servicios previos</span>
            </div>
            <div className="space-y-2">
              {historialEquipo.map(h => (
                <div key={h.id} className="bg-slate-50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      {h.fecha_programada ? new Date(h.fecha_programada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '--'}
                    </span>
                    {h.calificacion_cliente && (
                      <span className="text-xs text-amber-600 font-medium">{'★'.repeat(h.calificacion_cliente)}</span>
                    )}
                  </div>
                  {h.descripcion_falla && <p className="text-sm text-slate-700"><strong>Falla:</strong> {h.descripcion_falla}</p>}
                  {h.notas_tecnico && <p className="text-sm text-slate-600"><strong>Trabajo:</strong> {h.notas_tecnico}</p>}
                  <p className="text-xs text-slate-400">Técnico: {h.tecnico?.nombre || '--'} {h.valor_final ? `· ${formatCurrency(h.valor_final)}` : ''}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASO 1 — LLEGADA */}
      {pasoActual === 1 && (
        <Card className="relative">
          <button onClick={() => setPasoActual(0)} className="absolute top-3 left-3 h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-10">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <CardContent className="p-4 pt-3 space-y-4">
            <h2 className="font-bold text-lg text-center">Llegada</h2>

            {renderFotos('antes', 'Fotos del equipo ANTES')}

            {/* Selector de verificaciones */}
            <div className="space-y-2">
              <button
                className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                onClick={() => setLlegadaModal(true)}
              >
                <span className="text-sm font-semibold text-blue-700">Seleccionar condiciones observadas</span>
                <span className="text-blue-500 text-lg">＋</span>
              </button>
              {llegadaSelecciones.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {llegadaSelecciones.map(s => (
                    <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700">
                      {s}
                      <button onClick={() => setLlegadaSelecciones(prev => prev.filter(x => x !== s))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Observaciones de llegada</label>
              <Textarea
                placeholder="Estado del equipo, condiciones del lugar, lo que reporta el cliente..."
                value={observacionesLlegada}
                onChange={e => setObservacionesLlegada(e.target.value)}
                rows={3}
                className="bg-slate-50 border-slate-200"
              />
            </div>

            <Button className="w-full min-h-12" onClick={() => setPasoActual(2)}>
              Continuar al diagnóstico <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* PASO 2 — DIAGNÓSTICO */}
      {pasoActual === 2 && (
        <Card className="relative">
          <button onClick={() => setPasoActual(1)} className="absolute top-3 left-3 h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-10">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <CardContent className="p-4 pt-3 space-y-4">
            <h2 className="font-bold text-lg text-center">Diagnóstico</h2>

            {renderFotos('durante', 'Fotos del diagnóstico')}

            {/* Selector de errores típicos */}
            <div className="space-y-2">
              <button
                className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                onClick={() => setDiagModal(true)}
              >
                <span className="text-sm font-semibold text-blue-700">Seleccionar errores / hallazgos típicos</span>
                <span className="text-blue-500 text-lg">＋</span>
              </button>
              {diagSelecciones.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {diagSelecciones.map(s => (
                    <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 border border-red-200 text-red-700">
                      {s}
                      <button onClick={() => setDiagSelecciones(prev => prev.filter(x => x !== s))} className="hover:text-red-900">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Observaciones del diagnóstico</label>
              <Textarea
                placeholder="Describe mediciones, condiciones del equipo, información adicional..."
                value={observacionesDiag}
                onChange={e => setObservacionesDiag(e.target.value)}
                rows={4}
                className="bg-slate-50 border-slate-200"
              />
            </div>

            <Button className="w-full min-h-12" onClick={() => setPasoActual(3)}>
              Continuar a cotización <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* PASO 3 — COTIZACIÓN */}
      {pasoActual === 3 && (
        <Card className="relative">
          <button onClick={() => setPasoActual(2)} className="absolute top-3 left-3 h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-10">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <CardContent className="p-4 pt-3 space-y-4">
            <h2 className="font-bold text-lg text-center">Cotización</h2>
            <p className="text-sm text-slate-500 text-center -mt-2">Presenta los costos al cliente antes de iniciar la reparación</p>

            {/* Insumos / Repuestos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Insumos / Repuestos</p>
                {repuestos.length > 0 && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {formatCurrency(repuestos.reduce((sum, r) => sum + r.cantidad * r.precio_unitario, 0))}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(repuestosComunes[servicio.equipo?.tipo || 'otro'] || repuestosComunes.otro).map(rc => {
                  const added = repuestos.some(r => r.nombre === rc.nombre);
                  return (
                    <button
                      key={rc.nombre}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        added
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                      onClick={() => {
                        if (!added) setRepuestos(prev => [...prev, { nombre: rc.nombre, cantidad: 1, precio_unitario: rc.precio }]);
                      }}
                      disabled={added}
                    >
                      {added ? '✓ ' : '+ '}{rc.nombre}
                    </button>
                  );
                })}
              </div>

              {repuestos.length > 0 && (
                <div className="space-y-2">
                  {repuestos.map((r, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">{r.nombre}</p>
                        <button
                          className="h-7 w-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 shrink-0"
                          onClick={() => setRepuestos(repuestos.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 text-sm font-bold"
                            onClick={() => {
                              if (r.cantidad > 1) {
                                const copy = [...repuestos];
                                copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad - 1 };
                                setRepuestos(copy);
                              }
                            }}
                          >−</button>
                          <span className="text-sm font-bold w-5 text-center text-slate-700">{r.cantidad}</span>
                          <button
                            className="h-7 w-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 text-sm font-bold"
                            onClick={() => {
                              const copy = [...repuestos];
                              copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
                              setRepuestos(copy);
                            }}
                          >+</button>
                        </div>
                        <Input
                          type="number"
                          value={r.precio_unitario || ''}
                          onChange={(e) => {
                            const copy = [...repuestos];
                            copy[idx] = { ...copy[idx], precio_unitario: parseFloat(e.target.value) || 0 };
                            setRepuestos(copy);
                          }}
                          className="h-7 flex-1 text-xs text-right"
                          placeholder="$"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showCustomRepuesto ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={customRepuestoNombre}
                    onChange={(e) => setCustomRepuestoNombre(e.target.value)}
                    placeholder="Nombre del repuesto"
                    className="flex-1 h-9 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customRepuestoNombre.trim()) {
                        setRepuestos(prev => [...prev, { nombre: customRepuestoNombre.trim(), cantidad: 1, precio_unitario: 0 }]);
                        setCustomRepuestoNombre('');
                        setShowCustomRepuesto(false);
                      }
                    }}
                  />
                  <Button
                    className="h-9 px-3 text-sm"
                    onClick={() => {
                      if (customRepuestoNombre.trim()) {
                        setRepuestos(prev => [...prev, { nombre: customRepuestoNombre.trim(), cantidad: 1, precio_unitario: 0 }]);
                        setCustomRepuestoNombre('');
                        setShowCustomRepuesto(false);
                      }
                    }}
                    disabled={!customRepuestoNombre.trim()}
                  >
                    Agregar
                  </Button>
                  <button
                    className="h-9 w-9 rounded-lg hover:bg-slate-100 flex items-center justify-center shrink-0"
                    onClick={() => { setShowCustomRepuesto(false); setCustomRepuestoNombre(''); }}
                  >
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              ) : (
                <button
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                  onClick={() => setShowCustomRepuesto(true)}
                >
                  <Plus className="h-4 w-4" />
                  Agregar insumo / repuesto
                </button>
              )}
            </div>

            {/* Costo del servicio */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Mano de obra / Costo del servicio</label>
              <Input
                type="number"
                value={costoServicio}
                onChange={e => setCostoServicio(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Método de pago */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Método de pago</label>
              <Select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="link_pago">Link de pago</option>
              </Select>
            </div>

            {/* Resumen total */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-200">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Insumos / Repuestos</span>
                <span>{formatCurrency(repuestos.reduce((s, r) => s + r.cantidad * r.precio_unitario, 0))}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Mano de obra</span>
                <span>{formatCurrency(parseFloat(costoServicio) || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2 mt-1">
                <span>Total</span>
                <span className="text-emerald-700">
                  {formatCurrency(repuestos.reduce((s, r) => s + r.cantidad * r.precio_unitario, 0) + (parseFloat(costoServicio) || 0))}
                </span>
              </div>
            </div>

            <Button
              className="w-full min-h-14 text-base bg-green-600 hover:bg-green-700 text-white"
              onClick={handleClienteAcepta}
              disabled={saving}
            >
              <Check className="h-5 w-5 mr-2" />
              {saving ? 'Guardando...' : 'Cliente acepta — iniciar reparación'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* PASO 4 — REPARACIÓN */}
      {pasoActual === 4 && (
        <Card className="relative">
          <button onClick={() => setPasoActual(3)} className="absolute top-3 left-3 h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-10">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <CardContent className="p-4 pt-3 space-y-4">
            <h2 className="font-bold text-lg text-center">Reparación</h2>

            {renderFotos('durante', 'Fotos de la reparación')}

            {/* Selector de trabajos realizados */}
            <div className="space-y-2">
              <button
                className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
                onClick={() => setRepModal(true)}
              >
                <span className="text-sm font-semibold text-blue-700">Seleccionar trabajos realizados</span>
                <span className="text-blue-500 text-lg">＋</span>
              </button>
              {repSelecciones.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {repSelecciones.map(s => (
                    <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                      {s}
                      <button onClick={() => setRepSelecciones(prev => prev.filter(x => x !== s))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Observaciones de la reparación</label>
              <Textarea
                placeholder="Describe el trabajo realizado, repuestos cambiados, resultados..."
                value={observacionesRep}
                onChange={e => setObservacionesRep(e.target.value)}
                rows={4}
                className="bg-slate-50 border-slate-200"
              />
            </div>

            <Button className="w-full min-h-12" onClick={() => setPasoActual(5)}>
              Continuar al cierre <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* PASO 5 — CIERRE */}
      {pasoActual === 5 && (
        <Card className="relative">
          <button onClick={() => setPasoActual(4)} className="absolute top-3 left-3 h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-10">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <CardContent className="p-4 pt-3 space-y-4">
            <h2 className="font-bold text-lg text-center">Cierre del servicio</h2>

            {/* Resumen */}
            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
              <p><strong>Cliente:</strong> {servicio.cliente?.nombre}</p>
              <p><strong>Equipo:</strong> {servicio.equipo ? `${tipoEquipoLabel[servicio.equipo.tipo]} ${servicio.equipo.marca || ''}` : '--'}</p>
              {valorFinal && (
                <p><strong>Total cobrado:</strong> {formatCurrency(parseFloat(valorFinal))}</p>
              )}
            </div>

            {/* Firma del cliente */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Firma del cliente *</label>
                {(firmada || servicio.firma) && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />Firmado
                  </span>
                )}
              </div>
              {servicio.firma ? (
                <img src={servicio.firma.url} alt="Firma" className="border rounded-lg w-full h-32 object-contain bg-white" />
              ) : (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <SignatureCanvas
                    ref={sigRef}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-32' }}
                    onEnd={() => setFirmada(false)}
                  />
                  <div className="flex border-t">
                    <button className="flex-1 py-2 text-xs text-muted-foreground hover:bg-gray-50" onClick={() => sigRef.current?.clear()}>
                      <Trash2 className="h-3 w-3 inline mr-1" />Limpiar
                    </button>
                    <button className="flex-1 py-2 text-xs text-primary hover:bg-primary/5 border-l" onClick={handleGuardarFirma}>
                      <Pen className="h-3 w-3 inline mr-1" />Guardar firma
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button
              className="w-full min-h-14 text-base bg-green-600 hover:bg-green-700 text-white"
              onClick={handleCerrarServicio}
              disabled={saving || (!firmada && !servicio.firma)}
            >
              {saving ? 'Cerrando...' : 'CERRAR SERVICIO'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Floating phone button */}
      {pasoActual >= 1 && servicio.cliente?.telefono && (
        <a
          href={`tel:${servicio.cliente.telefono}`}
          className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-green-500 shadow-lg shadow-green-500/30 flex items-center justify-center z-50 active:scale-95 transition-transform"
          aria-label="Llamar al cliente"
        >
          <Phone className="h-6 w-6 text-white" />
        </a>
      )}

      {/* Modal llegada — condiciones observadas */}
      {llegadaModal && (() => {
        const opciones = [
          'Equipo en buen estado físico', 'Equipo con golpes / daños físicos', 'Instalación correcta',
          'Instalación deficiente', 'Voltaje verificado OK', 'Voltaje fuera de rango',
          'Filtros sucios / obstruidos', 'Área de trabajo limpia', 'Área con suciedad excesiva',
          'Drenaje obstruido', 'Ruidos anormales al encender', 'Sin ruidos anormales',
          'Cliente describe falla claramente', 'Falla intermitente', 'Falla constante',
          'Equipo no enciende', 'Equipo enciende con dificultad', 'Acceso limitado al equipo',
        ];
        const confirmar = () => {
          if (llegadaSelecciones.length > 0) {
            const texto = llegadaSelecciones.join(', ');
            setObservacionesLlegada(prev => prev ? `${prev}\nCondiciones: ${texto}` : `Condiciones: ${texto}`);
          }
          setLlegadaModal(false);
          setLlegadaSelecciones([]);
        };
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setLlegadaModal(false); setLlegadaSelecciones([]); }}>
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b">
                <h3 className="font-bold text-base text-slate-800">Condiciones observadas en llegada</h3>
                <button onClick={() => { setLlegadaModal(false); setLlegadaSelecciones([]); }} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 max-h-72 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {opciones.map(op => {
                    const sel = llegadaSelecciones.includes(op);
                    return (
                      <button key={op} className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'}`}
                        onClick={() => setLlegadaSelecciones(prev => sel ? prev.filter(x => x !== op) : [...prev, op])}>
                        {sel ? '✓ ' : ''}{op}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full min-h-11" onClick={confirmar} disabled={llegadaSelecciones.length === 0}>
                  Agregar {llegadaSelecciones.length > 0 ? `(${llegadaSelecciones.length})` : ''} a observaciones
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal reparación — trabajos realizados */}
      {repModal && (() => {
        const opcionesPorTipo: Record<string, string[]> = {
          aire_acondicionado: [
            'Limpieza de filtros', 'Limpieza de evaporador', 'Limpieza de condensador',
            'Recarga de gas refrigerante', 'Cambio de capacitor', 'Cambio de contactor',
            'Cambio de motor ventilador', 'Cambio de tarjeta electrónica', 'Cambio de sensor',
            'Desobstrucción de drenaje', 'Cambio de válvula de expansión', 'Soldadura en tubería',
            'Cambio de compresor', 'Ajuste eléctrico / cableado', 'Prueba de funcionamiento OK',
            'Equipo operando con normalidad',
          ],
          nevera: [
            'Limpieza general', 'Cambio de selladura', 'Recarga de gas',
            'Cambio de compresor', 'Cambio de termostato', 'Cambio de timer deshielo',
            'Cambio de resistencia deshielo', 'Cambio de motor ventilador', 'Cambio de tarjeta electrónica',
            'Desobstrucción de drenaje', 'Ajuste eléctrico', 'Soldadura en tubería',
            'Prueba de funcionamiento OK', 'Equipo operando con normalidad',
          ],
          otro: [
            'Limpieza general', 'Cambio de componente eléctrico', 'Ajuste mecánico',
            'Cambio de motor', 'Cambio de tarjeta electrónica', 'Soldadura',
            'Ajuste eléctrico / cableado', 'Prueba de funcionamiento OK', 'Equipo operando con normalidad',
          ],
        };
        const tipo = servicio.equipo?.tipo || 'otro';
        const opciones = opcionesPorTipo[tipo] ?? opcionesPorTipo.otro;
        const confirmar = () => {
          if (repSelecciones.length > 0) {
            const texto = repSelecciones.join(', ');
            setObservacionesRep(prev => prev ? `${prev}\nTrabajos: ${texto}` : `Trabajos: ${texto}`);
          }
          setRepModal(false);
          setRepSelecciones([]);
        };
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setRepModal(false); setRepSelecciones([]); }}>
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b">
                <h3 className="font-bold text-base text-slate-800">Trabajos realizados</h3>
                <button onClick={() => { setRepModal(false); setRepSelecciones([]); }} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 max-h-72 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {opciones.map(op => {
                    const sel = repSelecciones.includes(op);
                    return (
                      <button key={op} className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${sel ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'}`}
                        onClick={() => setRepSelecciones(prev => sel ? prev.filter(x => x !== op) : [...prev, op])}>
                        {sel ? '✓ ' : ''}{op}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full min-h-11" onClick={confirmar} disabled={repSelecciones.length === 0}>
                  Agregar {repSelecciones.length > 0 ? `(${repSelecciones.length})` : ''} a observaciones
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal diagnóstico — errores típicos por tipo de equipo */}
      {diagModal && (() => {
        const erroresPorTipo: Record<string, string[]> = {
          aire_acondicionado: [
            'No enfría', 'Enfría poco', 'Fuga de gas refrigerante', 'Ruido en compresor',
            'No enciende', 'Gotea agua al interior', 'Control remoto no responde',
            'Apaga solo (protección térmica)', 'Evaporador congelado', 'Mal olor',
            'Compresor no arranca', 'Ventilador no gira', 'Tarjeta electrónica dañada',
            'Capacitor defectuoso', 'Filtros sucios', 'Obstrucción en drenaje',
            'Sensor de temperatura dañado', 'Bajo nivel de refrigerante',
          ],
          nevera: [
            'No enfría', 'Congela en exceso', 'Compartimento no enfría',
            'Gotea agua', 'No enciende', 'Ruido anormal', 'Mal olor',
            'No hace hielo', 'Falla de iluminación interna', 'Selladura dañada',
            'Compresor no arranca', 'Acumula escarcha', 'Timer de deshielo dañado',
            'Resistencia de deshielo quemada', 'Termostato descalibrado', 'Fuga de gas',
          ],
          otro: [
            'No enciende', 'Ruido anormal', 'Sobrecalentamiento', 'No funciona',
            'Fallo electrónico', 'Vibración excesiva', 'Fuga de líquido',
            'Error en display', 'Protección activada', 'Cortocircuito',
          ],
        };
        const tipo = servicio.equipo?.tipo || 'otro';
        const opciones = erroresPorTipo[tipo] ?? erroresPorTipo.otro;
        const confirmar = () => {
          if (diagSelecciones.length > 0) {
            const texto = diagSelecciones.join(', ');
            setObservacionesDiag(prev => prev ? `${prev}\nHallazgos: ${texto}` : `Hallazgos: ${texto}`);
          }
          setDiagModal(false);
          setDiagSelecciones([]);
        };
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setDiagModal(false); setDiagSelecciones([]); }}>
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b">
                <h3 className="font-bold text-base text-slate-800">Errores / hallazgos típicos</h3>
                <button onClick={() => { setDiagModal(false); setDiagSelecciones([]); }} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 max-h-72 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {opciones.map(op => {
                    const sel = diagSelecciones.includes(op);
                    return (
                      <button
                        key={op}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                          sel
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700'
                        }`}
                        onClick={() => setDiagSelecciones(prev => sel ? prev.filter(x => x !== op) : [...prev, op])}
                      >
                        {sel ? '✓ ' : ''}{op}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 border-t">
                <Button className="w-full min-h-11" onClick={confirmar} disabled={diagSelecciones.length === 0}>
                  Agregar {diagSelecciones.length > 0 ? `(${diagSelecciones.length})` : ''} a observaciones
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal pausa */}
      {modalPausa && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-lg">Continuar después</h3>
              </div>
              <button onClick={() => setModalPausa(false)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Motivo de la pausa</label>
              <textarea
                value={notaPausa}
                onChange={e => setNotaPausa(e.target.value)}
                placeholder="Ej: Falta repuesto, se agenda para mañana..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Fecha de reanudación</label>
                <input
                  type="date"
                  value={fechaReanudacion}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => setFechaReanudacion(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Hora</label>
                <input
                  type="time"
                  value={horaReanudacion}
                  onChange={e => setHoraReanudacion(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <button
              onClick={handlePausar}
              disabled={saving || !notaPausa.trim() || !fechaReanudacion || !horaReanudacion}
              className="w-full min-h-12 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <PauseCircle className="h-5 w-5" />
              Confirmar pausa
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
