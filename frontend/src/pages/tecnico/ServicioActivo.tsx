import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getServicio, cambiarEstadoServicio, marcarChecklistItem,
  subirFoto, eliminarFoto, guardarFirma, agregarNota, actualizarServicio,
  getHistorialEquipo, eliminarServicio, corregirEquipo, registrarEquipo,
} from '@/api/servicios';
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
  Phone, MapPin, Camera, Check, CheckCircle,
  Trash2, Download, Pen, ArrowLeft, ArrowRight, PartyPopper, History, AlertTriangle,
  User, Clock, DollarSign, Star, Plus, X,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

interface HistorialCliente {
  stats: { total_servicios: number; total_gastado: number; calificacion_promedio: number };
  servicios: Servicio[];
  proximo_recordatorio?: { fecha_proximo_recordatorio: string };
}

const pasos = ['En camino', 'Llegada', 'Diagnóstico', 'Reparación', 'Cierre'];


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
  const [uploadingTipos, setUploadingTipos] = useState<Set<string>>(new Set());
  const [deletingFotos, setDeletingFotos] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notasTecnico, setNotasTecnico] = useState('');
  const [valorFinal, setValorFinal] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [descripcionTrabajo, setDescripcionTrabajo] = useState('');
  const [showExito, setShowExito] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);
  const [firmada, setFirmada] = useState(false);
  const [historialEquipo, setHistorialEquipo] = useState<Servicio[]>([]);
  const [historialTotal, setHistorialTotal] = useState(0);
  const [clienteHistorial, setClienteHistorial] = useState<HistorialCliente | null>(null);
  const [activeDiagItem, setActiveDiagItem] = useState<string | null>(null);
  const [diagEstado, setDiagEstado] = useState<'observacion' | 'falla' | null>(null);
  const [diagValue, setDiagValue] = useState('');
  const [correccionData, setCorreccionData] = useState({ marca: '', marcaOtra: '', capacidad: '', tecnologia: '', tipo: '' });
  const [fallaConfirmada, setFallaConfirmada] = useState<boolean | null>(null);
  const [diagnosticoFinal, setDiagnosticoFinal] = useState('');
  const [repuestos, setRepuestos] = useState<{ nombre: string; cantidad: number; precio_unitario: number }[]>([]);
  const [showCustomRepuesto, setShowCustomRepuesto] = useState(false);
  const [customRepuestoNombre, setCustomRepuestoNombre] = useState('');

  const fetchServicio = async () => {
    if (!id) return;
    try {
      const { data: res } = await getServicio(id);
      setServicio(res.data);

      // Solo calcula el paso en la carga inicial — no en refreshes posteriores
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        if (res.data.estado === 'asignado' || res.data.estado === 'en_camino') setPasoActual(0);
        else if (res.data.estado === 'en_servicio') {
          const cl = res.data.checklist || [];
          const llegada = cl.filter(c => c.categoria === 'llegada');
          const diag = cl.filter(c => c.categoria === 'diagnostico');
          const rep = cl.filter(c => c.categoria === 'reparacion');
          if (rep.every(c => c.completado)) setPasoActual(4);
          else if (diag.every(c => c.completado)) setPasoActual(3);
          else if (llegada.every(c => c.completado)) setPasoActual(2);
          else setPasoActual(1);
        }
      }
      if (res.data.valor_final) setValorFinal(String(res.data.valor_final));
      if (res.data.notas_tecnico) setDescripcionTrabajo(res.data.notas_tecnico);
      if (res.data.falla_confirmada !== undefined && res.data.falla_confirmada !== null) setFallaConfirmada(res.data.falla_confirmada);
      if (res.data.diagnostico_final) setDiagnosticoFinal(res.data.diagnostico_final);
      if (res.data.repuestos) setRepuestos(res.data.repuestos);
    } catch { toast.error('Error cargando servicio'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { fetchServicio(); }, [id]);

  useEffect(() => {
    if (servicio?.equipo) {
      const marcasConocidas = [
        'Samsung','LG','Carrier','Daikin','Midea','York','Trane','Lennox','Panasonic',
        'Gree','Hisense','TCL','Aux','Whirlpool','Electrolux','Mabe','Haceb',
        'Challenger','Indurama','Bosch','Frigidaire','Daewoo',
      ];
      const marcaEquipo = servicio.equipo.marca || '';
      const esConocida = marcasConocidas.includes(marcaEquipo);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCorreccionData({
        marca: esConocida ? marcaEquipo : marcaEquipo ? 'Otra' : '',
        marcaOtra: esConocida ? '' : marcaEquipo,
        capacidad: servicio.equipo.notas || '',
        tecnologia: '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicio?.equipo?.id]);

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

  const handleEliminar = async () => {
    if (!id || !servicio) return;
    const confirmar = window.confirm(`¿Eliminar el servicio de "${servicio.cliente?.nombre || 'este cliente'}"? Esta acción no se puede deshacer.`);
    if (!confirmar) return;
    try {
      await eliminarServicio(id);
      toast.success('Servicio eliminado');
      navigate('/tecnico/agenda');
    } catch (err: unknown) { toast.error((err as {response?: {data?: {error?: string}}}).response?.data?.error || 'Error eliminando'); }
  };

  const handleChecklistItem = async (itemId: string) => {
    if (!id) return;
    try {
      await marcarChecklistItem(id, itemId);
      fetchServicio();
    } catch { toast.error('Error actualizando checklist'); }
  };

  const autoCheckCierreItem = async (keyword: string) => {
    if (!servicio) return;
    const item = (servicio.checklist || []).find(
      c => c.categoria === 'cierre' && !c.completado && c.descripcion.toLowerCase().includes(keyword)
    );
    if (item && id) {
      try { await marcarChecklistItem(id, item.id); } catch { /* best-effort */ }
    }
  };

  const autoCheckLlegadaItem = async (keyword: string) => {
    if (!servicio) return;
    const item = (servicio.checklist || []).find(
      c => c.categoria === 'llegada' && !c.completado && c.descripcion.toLowerCase().includes(keyword)
    );
    if (item && id) {
      try { await marcarChecklistItem(id, item.id); } catch { /* best-effort */ }
    }
  };

  const autoCheckReparacionItem = async (keyword: string) => {
    if (!servicio) return;
    const item = (servicio.checklist || []).find(
      c => c.categoria === 'reparacion' && !c.completado && c.descripcion.toLowerCase().includes(keyword)
    );
    if (item && id) {
      try { await marcarChecklistItem(id, item.id); } catch { /* best-effort */ }
    }
  };

  const handleAvanzarACierre = async () => {
    if (id && repuestos.length > 0) {
      try { await actualizarServicio(id, { repuestos }); } catch { /* best-effort save */ }
    }
    setPasoActual(4);
  };

  const handleSubirFoto = (tipo: 'antes' | 'durante' | 'despues') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !id) return;

      // Sube en segundo plano — el técnico puede continuar de inmediato
      setUploadingTipos(prev => new Set(prev).add(tipo));
      toast.success('📷 Foto tomada, subiendo en segundo plano...');

      try {
        const formData = new FormData();
        formData.append('foto', file);
        formData.append('tipo', tipo);
        await subirFoto(id, formData);
        if (tipo === 'antes') await autoCheckLlegadaItem('foto');
        if (tipo === 'despues') await autoCheckCierreItem('foto');
        fetchServicio();
      } catch { toast.error('Error subiendo foto, intenta de nuevo'); }
      finally { setUploadingTipos(prev => { const s = new Set(prev); s.delete(tipo); return s; }); }
    };
    input.click();
  };

  const handleEliminarFoto = async (fotoId: string) => {
    if (!id) return;
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
      await autoCheckCierreItem('firma');
      fetchServicio();
    } catch { toast.error('Error guardando firma'); }
  };

  useEffect(() => {
    if (!servicio || !valorFinal || !metodoPago) return;
    const item = (servicio.checklist || []).find(
      c => c.categoria === 'cierre' && !c.completado && c.descripcion.toLowerCase().includes('valor')
    );
    if (item && id) {
      marcarChecklistItem(id, item.id).then(() => fetchServicio()).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorFinal, metodoPago]);

  const handleCerrarServicio = async () => {
    if (!id || !servicio) return;

    const fotoAntes = servicio.fotos?.some(f => f.tipo === 'antes');
    const fotoDespues = servicio.fotos?.some(f => f.tipo === 'despues');

    if (!fotoAntes) { toast.error('Falta foto "antes" del equipo'); return; }
    if (!fotoDespues) { toast.error('Falta al menos una foto "después"'); return; }
    if (!firmada && !servicio.firma) { toast.error('Falta la firma del cliente'); return; }
    if (!valorFinal) { toast.error('Ingresa el valor cobrado'); return; }
    if (!descripcionTrabajo) { toast.error('Describe el trabajo realizado'); return; }
    if (fallaConfirmada === null) { toast.error('Confirma si la falla fue la reportada'); return; }
    if (fallaConfirmada === false && !diagnosticoFinal) { toast.error('Selecciona el diagnóstico real'); return; }

    setSaving(true);
    try {
      if (!firmada && sigRef.current && !sigRef.current.isEmpty()) {
        await handleGuardarFirma();
      }
      await agregarNota(id, descripcionTrabajo);

      await actualizarServicio(id, {
        valor_final: parseFloat(valorFinal),
        metodo_pago: metodoPago as MetodoPago,
        notas_tecnico: descripcionTrabajo,
        falla_confirmada: fallaConfirmada ?? undefined,
        diagnostico_final: fallaConfirmada ? servicio.descripcion_falla || '' : diagnosticoFinal,
        repuestos: repuestos.length > 0 ? repuestos : undefined,
      });

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

  const checklist = servicio.checklist || [];
  const itemsPorCat = (cat: string) => checklist.filter(c => c.categoria === cat);

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {pasos.map((p, i) => (
          <div key={p} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${i <= pasoActual ? 'bg-primary' : 'bg-gray-200'}`} />
            <p className={`text-[10px] mt-1 text-center ${i <= pasoActual ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{p}</p>
          </div>
        ))}
      </div>


      {/* PASO 0 — EN CAMINO */}
      {pasoActual === 0 && (
        <>
          {/* Service info */}
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
              {/* Botón eliminar — solo si el servicio no ha iniciado */}
              {['asignado', 'en_camino', 'pendiente'].includes(servicio.estado) && (
                <button
                  onClick={handleEliminar}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-red-400 hover:text-red-600 transition-colors mt-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar servicio de prueba
                </button>
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

            {/* Fotos ANTES — máx 2 */}
            {(() => {
              const fotosAntes = servicio.fotos?.filter(f => f.tipo === 'antes') || [];
              const maxAntes = 2;
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Fotos del equipo ANTES <span className="text-slate-400 font-normal">(obligatorias)</span></p>
                    <span className={`text-xs font-medium ${fotosAntes.length >= maxAntes ? 'text-emerald-600' : 'text-slate-500'}`}>{fotosAntes.length}/{maxAntes}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {fotosAntes.map(f => (
                      <div key={f.id} className="aspect-square rounded-xl bg-gray-100 relative">
                        <img src={f.url} alt="Antes" className="w-full h-full object-cover rounded-xl" />
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
                  {fotosAntes.length < maxAntes && (
                    <Button variant="outline" className="w-full min-h-12" onClick={() => handleSubirFoto('antes')}>
                      <Camera className="h-5 w-5 mr-2" />
                      {uploadingTipos.has('antes') ? 'Subiendo foto...' : fotosAntes.length === 0 ? 'Tomar foto antes del servicio' : 'Tomar segunda foto antes'}
                    </Button>
                  )}
                  {fotosAntes.length >= maxAntes && (
                    <p className="text-xs text-emerald-600 font-medium text-center">✓ Fotos antes completadas</p>
                  )}
                </div>
              );
            })()}

            {/* Checklist de llegada con contexto */}
            <div className="space-y-2">
              {(() => {
                const tieneFotoAntes = servicio.fotos?.some(f => f.tipo === 'antes');
                return itemsPorCat('llegada').map(item => {
                  const desc = item.descripcion.toLowerCase();
                  const isFotoItem = desc.includes('foto');
                  const isEquipoItem = desc.includes('modelo') || desc.includes('serial') || desc.includes('btu') || desc.includes('verificar datos') || desc.includes('datos del equipo') || desc.includes('confirmar datos');

                  // Items 2 y 3 bloqueados hasta que exista foto 'antes'
                  const bloqueadoSinFoto = !isFotoItem && !tieneFotoAntes && !item.completado;
                  const isDisabled = item.completado || isFotoItem || bloqueadoSinFoto || (isEquipoItem && !item.completado);

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 w-full p-3 rounded-lg border text-left min-h-12 transition-opacity ${
                        (isFotoItem && !item.completado) || bloqueadoSinFoto ? 'opacity-50 cursor-not-allowed' : ''
                      } ${item.completado ? 'bg-green-50 border-green-200' : ''} ${!isDisabled ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                      onClick={() => !isDisabled && handleChecklistItem(item.id)}
                    >
                      <CheckCircle className={`h-6 w-6 shrink-0 mt-0.5 ${item.completado ? 'text-green-500' : 'text-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${item.completado ? 'line-through text-muted-foreground' : ''}`}>
                          {item.descripcion}
                        </span>
                        {/* Foto item: indicar que es automático */}
                        {isFotoItem && !item.completado && (
                          <p className="text-[11px] text-slate-400 mt-0.5">📷 Se confirma automáticamente al tomar la foto</p>
                        )}
                        {/* Items bloqueados: mostrar por qué están bloqueados */}
                        {bloqueadoSinFoto && (
                          <p className="text-[11px] text-slate-400 mt-0.5">🔒 Primero toma la foto del equipo</p>
                        )}
                        {/* Sin equipo vinculado: formulario para registrar el equipo */}
                        {isEquipoItem && tieneFotoAntes && !servicio.equipo && !item.completado && (
                          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-xs font-semibold text-blue-700">Registra los datos del equipo:</p>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-slate-500">Tipo de equipo</label>
                              <select
                                value={correccionData.tipo}
                                onChange={(e) => setCorreccionData(d => ({ ...d, tipo: e.target.value, marca: '', marcaOtra: '', capacidad: '', tecnologia: '' }))}
                                className="w-full h-8 text-xs bg-white border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Seleccionar tipo</option>
                                <option value="aire_acondicionado">Aire Acondicionado</option>
                                <option value="nevera">Nevera</option>
                                <option value="otro">Otro</option>
                              </select>
                              <label className="text-[11px] font-medium text-slate-500">Marca</label>
                              <select
                                value={correccionData.marca}
                                onChange={(e) => setCorreccionData(d => ({ ...d, marca: e.target.value, marcaOtra: '' }))}
                                className="w-full h-8 text-xs bg-white border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Seleccionar marca</option>
                                {correccionData.tipo === 'aire_acondicionado' ? (
                                  <>
                                    <option value="Samsung">Samsung</option>
                                    <option value="LG">LG</option>
                                    <option value="Carrier">Carrier</option>
                                    <option value="Daikin">Daikin</option>
                                    <option value="Midea">Midea</option>
                                    <option value="York">York</option>
                                    <option value="Trane">Trane</option>
                                    <option value="Lennox">Lennox</option>
                                    <option value="Panasonic">Panasonic</option>
                                    <option value="Gree">Gree</option>
                                    <option value="Hisense">Hisense</option>
                                    <option value="TCL">TCL</option>
                                    <option value="Aux">Aux</option>
                                    <option value="Whirlpool">Whirlpool</option>
                                    <option value="Electrolux">Electrolux</option>
                                  </>
                                ) : correccionData.tipo === 'nevera' ? (
                                  <>
                                    <option value="Samsung">Samsung</option>
                                    <option value="LG">LG</option>
                                    <option value="Whirlpool">Whirlpool</option>
                                    <option value="Mabe">Mabe</option>
                                    <option value="Haceb">Haceb</option>
                                    <option value="Electrolux">Electrolux</option>
                                    <option value="Challenger">Challenger</option>
                                    <option value="Indurama">Indurama</option>
                                    <option value="Bosch">Bosch</option>
                                    <option value="Frigidaire">Frigidaire</option>
                                    <option value="Panasonic">Panasonic</option>
                                    <option value="Daewoo">Daewoo</option>
                                  </>
                                ) : null}
                                <option value="Otra">Otra</option>
                              </select>
                              {correccionData.marca === 'Otra' && (
                                <Input
                                  placeholder="Escribir marca"
                                  value={correccionData.marcaOtra}
                                  onChange={(e) => setCorreccionData(d => ({ ...d, marcaOtra: e.target.value }))}
                                  className="h-8 text-xs bg-white"
                                />
                              )}
                              {(correccionData.tipo === 'aire_acondicionado') && (
                                <>
                                  <label className="text-[11px] font-medium text-slate-500">Tecnología</label>
                                  <select
                                    value={correccionData.tecnologia}
                                    onChange={(e) => setCorreccionData(d => ({ ...d, tecnologia: e.target.value }))}
                                    className="w-full h-8 text-xs bg-white border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="">Seleccionar</option>
                                    <option value="Inverter">Inverter</option>
                                    <option value="Convencional">Convencional</option>
                                  </select>
                                  <label className="text-[11px] font-medium text-slate-500">Capacidad</label>
                                  <select
                                    value={correccionData.capacidad}
                                    onChange={(e) => setCorreccionData(d => ({ ...d, capacidad: e.target.value }))}
                                    className="w-full h-8 text-xs bg-white border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="">Capacidad (BTU)</option>
                                    <option value="9,000 BTU">9,000 BTU</option>
                                    <option value="12,000 BTU (1 Ton)">12,000 BTU (1 Ton)</option>
                                    <option value="18,000 BTU (1.5 Ton)">18,000 BTU (1.5 Ton)</option>
                                    <option value="24,000 BTU (2 Ton)">24,000 BTU (2 Ton)</option>
                                    <option value="36,000 BTU (3 Ton)">36,000 BTU (3 Ton)</option>
                                    <option value="48,000 BTU (4 Ton)">48,000 BTU (4 Ton)</option>
                                    <option value="60,000 BTU (5 Ton)">60,000 BTU (5 Ton)</option>
                                  </select>
                                </>
                              )}
                            </div>
                            <Button
                              className="w-full h-9 text-xs bg-green-600 hover:bg-green-700"
                              onClick={async () => {
                                if (!id) return;
                                const tipo = correccionData.tipo;
                                const marca = correccionData.marca === 'Otra' ? correccionData.marcaOtra.trim() : correccionData.marca;
                                if (!tipo) { toast.error('Selecciona el tipo de equipo'); return; }
                                if (!marca) { toast.error('Selecciona la marca del equipo'); return; }
                                const capacidad = [correccionData.capacidad, correccionData.tecnologia].filter(Boolean).join(' - ');
                                try {
                                  await registrarEquipo(id, { tipo, marca, capacidad: capacidad || undefined });
                                  toast.success('Equipo registrado correctamente');
                                  await handleChecklistItem(item.id);
                                  fetchServicio();
                                } catch { toast.error('Error registrando el equipo'); }
                              }}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" /> Registrar equipo
                            </Button>
                          </div>
                        )}
                        {/* Equipo item: formulario de verificación/complemento */}
                        {isEquipoItem && tieneFotoAntes && servicio.equipo && !item.completado && (
                          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-xs font-semibold text-blue-700">Verifica y completa los datos del equipo:</p>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-slate-500">Marca</label>
                              <select
                                value={correccionData.marca}
                                onChange={(e) => setCorreccionData(d => ({ ...d, marca: e.target.value, marcaOtra: '' }))}
                                className="w-full h-8 text-xs bg-white border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Seleccionar marca</option>
                                {servicio.equipo?.tipo === 'aire_acondicionado' ? (
                                  <>
                                    <option value="Samsung">Samsung</option>
                                    <option value="LG">LG</option>
                                    <option value="Carrier">Carrier</option>
                                    <option value="Daikin">Daikin</option>
                                    <option value="Midea">Midea</option>
                                    <option value="York">York</option>
                                    <option value="Trane">Trane</option>
                                    <option value="Lennox">Lennox</option>
                                    <option value="Panasonic">Panasonic</option>
                                    <option value="Gree">Gree</option>
                                    <option value="Hisense">Hisense</option>
                                    <option value="TCL">TCL</option>
                                    <option value="Aux">Aux</option>
                                    <option value="Whirlpool">Whirlpool</option>
                                    <option value="Electrolux">Electrolux</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="Samsung">Samsung</option>
                                    <option value="LG">LG</option>
                                    <option value="Whirlpool">Whirlpool</option>
                                    <option value="Mabe">Mabe</option>
                                    <option value="Haceb">Haceb</option>
                                    <option value="Electrolux">Electrolux</option>
                                    <option value="Challenger">Challenger</option>
                                    <option value="Indurama">Indurama</option>
                                    <option value="Bosch">Bosch</option>
                                    <option value="Frigidaire">Frigidaire</option>
                                    <option value="Panasonic">Panasonic</option>
                                    <option value="Daewoo">Daewoo</option>
                                  </>
                                )}
                                <option value="Otra">Otra</option>
                              </select>
                              {correccionData.marca === 'Otra' && (
                                <Input
                                  placeholder="Escribir marca"
                                  value={correccionData.marcaOtra}
                                  onChange={(e) => setCorreccionData(d => ({ ...d, marcaOtra: e.target.value }))}
                                  className="h-8 text-xs bg-white"
                                />
                              )}
                              <label className="text-[11px] font-medium text-slate-500">Tecnología</label>
                              <select
                                value={correccionData.tecnologia}
                                onChange={(e) => setCorreccionData(d => ({ ...d, tecnologia: e.target.value }))}
                                className="w-full h-8 text-xs bg-white border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Seleccionar</option>
                                <option value="Inverter">Inverter</option>
                                <option value="Convencional">Convencional</option>
                              </select>
                              <label className="text-[11px] font-medium text-slate-500">Capacidad</label>
                              <select
                                value={correccionData.capacidad}
                                onChange={(e) => setCorreccionData(d => ({ ...d, capacidad: e.target.value }))}
                                className="w-full h-8 text-xs bg-white border border-slate-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Capacidad (BTU)</option>
                                <option value="9,000 BTU">9,000 BTU</option>
                                <option value="12,000 BTU (1 Ton)">12,000 BTU (1 Ton)</option>
                                <option value="18,000 BTU (1.5 Ton)">18,000 BTU (1.5 Ton)</option>
                                <option value="24,000 BTU (2 Ton)">24,000 BTU (2 Ton)</option>
                                <option value="36,000 BTU (3 Ton)">36,000 BTU (3 Ton)</option>
                                <option value="48,000 BTU (4 Ton)">48,000 BTU (4 Ton)</option>
                                <option value="60,000 BTU (5 Ton)">60,000 BTU (5 Ton)</option>
                              </select>
                            </div>
                            <Button
                              className="w-full h-9 text-xs bg-green-600 hover:bg-green-700"
                              onClick={async () => {
                                if (!id) return;
                                const marca = correccionData.marca === 'Otra' ? correccionData.marcaOtra.trim() : correccionData.marca;
                                if (!marca) {
                                  toast.error('Selecciona la marca del equipo');
                                  return;
                                }
                                const capacidad = [correccionData.capacidad, correccionData.tecnologia].filter(Boolean).join(' - ');
                                try {
                                  await corregirEquipo(id, {
                                    marca,
                                    capacidad: capacidad || undefined,
                                  });
                                  toast.success('Datos del equipo confirmados');
                                  await handleChecklistItem(item.id);
                                  fetchServicio();
                                } catch { toast.error('Error guardando datos'); }
                              }}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" /> Confirmar datos del equipo
                            </Button>
                          </div>
                        )}
                        {isEquipoItem && item.completado && servicio.equipo && (
                          <div className="mt-1.5 text-xs rounded-lg p-2 space-y-0.5 bg-green-100 text-green-800">
                            {servicio.equipo.marca && <p><span className="font-semibold">Marca:</span> {servicio.equipo.marca}</p>}
                            {servicio.equipo.notas && <p><span className="font-semibold">Capacidad:</span> {servicio.equipo.notas}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <Button className="w-full min-h-12" onClick={() => setPasoActual(2)}
              disabled={!itemsPorCat('llegada').every(i => i.completado)}>
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
            <div className="bg-muted p-2 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span>Progreso</span>
                <span className="font-medium">{itemsPorCat('diagnostico').filter(c => c.completado).length}/{itemsPorCat('diagnostico').length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(itemsPorCat('diagnostico').filter(c => c.completado).length / Math.max(1, itemsPorCat('diagnostico').length)) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-3">
              {(() => {
                const chipsPorItem: Record<string, string[]> = {
                  voltaje: ['Bajo', 'Alto', 'Inestable', 'Sin voltaje'],
                  amperaje: ['Bajo', 'Alto', 'Inestable', 'Pico anormal'],
                  gas: ['Bajo', 'Vacío', 'Fuga detectada', 'Requiere recarga'],
                  refrigerante: ['Bajo', 'Vacío', 'Fuga detectada', 'Requiere recarga'],
                  compresor: ['Ruido anormal', 'No arranca', 'Sobrecalentado', 'Trabado', 'Fuga'],
                  filtro: ['Sucios', 'Obstruidos', 'Rotos', 'Requieren cambio'],
                  condensador: ['Sucio', 'Aletas dobladas', 'Ventilador no gira', 'Sobrecalentado'],
                  evaporador: ['Congelado', 'Sucio', 'Fuga detectada', 'No enfría'],
                  termostato: ['No regula', 'Descalibrado', 'No responde', 'Dañado'],
                  ventilador: ['No gira', 'Ruido anormal', 'Gira lento', 'Aspas dañadas'],
                  resistencia: ['No calienta', 'Quemada', 'Intermitente'],
                  deshielo: ['No calienta', 'Quemada', 'Intermitente'],
                  sello: ['Desgastado', 'Roto', 'No sella bien', 'Sucio'],
                  tarjeta: ['Quemada', 'Corto circuito', 'Error en display', 'No responde'],
                  temperatura: ['No enfría', 'Enfría poco', 'Congela en exceso', 'Inestable'],
                  control: ['No responde', 'Pilas agotadas', 'Botones dañados'],
                  drenaje: ['Obstruido', 'Gotea', 'Bandeja llena', 'Tubería rota'],
                  condensado: ['Obstruido', 'Gotea', 'Bandeja llena', 'Tubería rota'],
                };

                const getChips = (desc: string): string[] => {
                  const d = desc.toLowerCase();
                  for (const [key, chips] of Object.entries(chipsPorItem)) {
                    if (d.includes(key)) return chips;
                  }
                  return ['Desgaste', 'Dañado', 'Requiere cambio', 'Ruido anormal'];
                };

                return itemsPorCat('diagnostico').map(item => {
                  const isExpanded = activeDiagItem === item.id;
                  const chips = getChips(item.descripcion);

                  const completarItem = (estado: string, detalle?: string) => {
                    handleChecklistItem(item.id);
                    const linea = detalle
                      ? `${item.descripcion}: ${estado.toUpperCase()} — ${detalle}`
                      : `${item.descripcion}: ${estado}`;
                    setNotasTecnico(prev => prev ? `${prev}\n- ${linea}` : `- ${linea}`);
                    setActiveDiagItem(null);
                    setDiagEstado(null);
                    setDiagValue('');
                  };

                  return (
                    <div key={item.id} className={`rounded-xl border overflow-hidden transition-colors ${
                      item.completado ? 'bg-green-50 border-green-200' :
                      isExpanded ? 'border-blue-300 ring-1 ring-blue-300' : 'bg-white'
                    }`}>
                      <button
                        className="flex items-center gap-3 w-full p-3 text-left min-h-12"
                        onClick={() => {
                          if (!item.completado) {
                            setActiveDiagItem(isExpanded ? null : item.id);
                            setDiagEstado(null);
                            setDiagValue('');
                          }
                        }}
                        disabled={item.completado}
                      >
                        <CheckCircle className={`h-6 w-6 shrink-0 ${item.completado ? 'text-green-500' : 'text-gray-300'}`} />
                        <span className={`text-sm font-medium flex-1 ${item.completado ? 'line-through text-green-700/70' : 'text-slate-700'}`}>
                          {item.descripcion}
                        </span>
                        {!item.completado && !isExpanded && (
                          <span className="ml-auto text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full uppercase tracking-wider shrink-0">Revisar</span>
                        )}
                      </button>

                      {isExpanded && !item.completado && (
                        <div className="border-t border-slate-100">
                          {/* Paso 1: Seleccionar estado */}
                          <div className="grid grid-cols-3 gap-0 border-b border-slate-100">
                            <button
                              className="py-3 text-center text-xs font-bold transition-colors bg-green-50 hover:bg-green-100 text-green-700 border-r border-slate-100"
                              onClick={() => completarItem('Normal')}
                            >
                              <Check className="h-4 w-4 mx-auto mb-0.5 text-green-600" />
                              Normal
                            </button>
                            <button
                              className={`py-3 text-center text-xs font-bold transition-colors border-r border-slate-100 ${
                                diagEstado === 'observacion' ? 'bg-amber-100 text-amber-800' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                              }`}
                              onClick={() => { setDiagEstado('observacion'); setDiagValue(''); }}
                            >
                              <AlertTriangle className="h-4 w-4 mx-auto mb-0.5 text-amber-500" />
                              Observación
                            </button>
                            <button
                              className={`py-3 text-center text-xs font-bold transition-colors ${
                                diagEstado === 'falla' ? 'bg-red-100 text-red-800' : 'bg-red-50 hover:bg-red-100 text-red-700'
                              }`}
                              onClick={() => { setDiagEstado('falla'); setDiagValue(''); }}
                            >
                              <AlertTriangle className="h-4 w-4 mx-auto mb-0.5 text-red-500" />
                              Falla
                            </button>
                          </div>

                          {/* Paso 2: Chips de detalle (solo si Observación o Falla) */}
                          {diagEstado && (
                            <div className={`p-3 space-y-2.5 ${diagEstado === 'falla' ? 'bg-red-50/50' : 'bg-amber-50/50'}`}>
                              <p className={`text-xs font-semibold ${diagEstado === 'falla' ? 'text-red-700' : 'text-amber-700'}`}>
                                ¿Qué encontraste?
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {chips.map(chip => (
                                  <button
                                    key={chip}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                      diagValue === chip
                                        ? diagEstado === 'falla'
                                          ? 'bg-red-600 text-white border-red-600'
                                          : 'bg-amber-500 text-white border-amber-500'
                                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                                    }`}
                                    onClick={() => setDiagValue(chip)}
                                  >
                                    {chip}
                                  </button>
                                ))}
                              </div>
                              <Input
                                placeholder="Otro (escribir aquí)"
                                value={!chips.includes(diagValue) ? diagValue : ''}
                                onChange={(e) => setDiagValue(e.target.value)}
                                className="h-9 text-xs bg-white"
                              />
                              <Button
                                className={`w-full h-10 text-sm font-semibold ${
                                  diagEstado === 'falla' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'
                                }`}
                                disabled={!diagValue.trim()}
                                onClick={() => completarItem(diagEstado === 'falla' ? 'FALLA' : 'OBSERVACIÓN', diagValue.trim())}
                              >
                                Confirmar {diagEstado === 'falla' ? 'falla' : 'observación'}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            <div className="pt-2">
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Reporte de diagnóstico generado</label>
              <Textarea 
                placeholder="El reporte se irá construyendo automáticamente aquí..." 
                value={notasTecnico} 
                onChange={e => setNotasTecnico(e.target.value)} 
                rows={5}
                className="bg-slate-50 border-slate-200"
              />
            </div>
            <div>
              <Button className="w-full min-h-12" onClick={() => setPasoActual(3)}
                disabled={!itemsPorCat('diagnostico').every(i => i.completado)}>
                Continuar a reparación <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASO 3 — REPARACIÓN */}
      {pasoActual === 3 && (
        <Card className="relative">
          <button onClick={() => setPasoActual(2)} className="absolute top-3 left-3 h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-10">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <CardContent className="p-4 pt-3 space-y-4">
            <h2 className="font-bold text-lg text-center">Reparación</h2>

            {/* Repuestos section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Repuestos utilizados</p>
                {repuestos.length > 0 && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {formatCurrency(repuestos.reduce((sum, r) => sum + r.cantidad * r.precio_unitario, 0))}
                  </span>
                )}
              </div>

              {/* Quick-add chips */}
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
                      onClick={async () => {
                        if (!added) {
                          const isFirst = repuestos.length === 0;
                          setRepuestos(prev => [...prev, { nombre: rc.nombre, cantidad: 1, precio_unitario: rc.precio }]);
                          if (isFirst) await autoCheckReparacionItem('repuestos');
                          if (rc.nombre.toLowerCase().includes('gas')) await autoCheckReparacionItem('gas');
                          if (isFirst || rc.nombre.toLowerCase().includes('gas')) fetchServicio();
                        }
                      }}
                      disabled={added}
                    >
                      {added ? '✓ ' : '+ '}{rc.nombre}
                    </button>
                  );
                })}
              </div>

              {/* Added repuestos list */}
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

              {/* Custom add */}
              {showCustomRepuesto ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={customRepuestoNombre}
                    onChange={(e) => setCustomRepuestoNombre(e.target.value)}
                    placeholder="Nombre del repuesto"
                    className="flex-1 h-9 text-sm"
                    autoFocus
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && customRepuestoNombre.trim()) {
                        const isFirst = repuestos.length === 0;
                        setRepuestos(prev => [...prev, { nombre: customRepuestoNombre.trim(), cantidad: 1, precio_unitario: 0 }]);
                        if (isFirst) await autoCheckReparacionItem('repuestos');
                        if (customRepuestoNombre.toLowerCase().includes('gas')) await autoCheckReparacionItem('gas');
                        if (isFirst || customRepuestoNombre.toLowerCase().includes('gas')) fetchServicio();
                        setCustomRepuestoNombre('');
                        setShowCustomRepuesto(false);
                      }
                    }}
                  />
                  <Button
                    className="h-9 px-3 text-sm"
                    onClick={async () => {
                      if (customRepuestoNombre.trim()) {
                        const isFirst = repuestos.length === 0;
                        setRepuestos(prev => [...prev, { nombre: customRepuestoNombre.trim(), cantidad: 1, precio_unitario: 0 }]);
                        if (isFirst) await autoCheckReparacionItem('repuestos');
                        if (customRepuestoNombre.toLowerCase().includes('gas')) await autoCheckReparacionItem('gas');
                        if (isFirst || customRepuestoNombre.toLowerCase().includes('gas')) fetchServicio();
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
                  Agregar otro repuesto
                </button>
              )}

              {/* No repuestos option */}
              {repuestos.length === 0 && !showCustomRepuesto && (
                <button
                  className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 underline underline-offset-2"
                  onClick={async () => {
                    await autoCheckReparacionItem('repuestos');
                    await autoCheckReparacionItem('gas');
                    fetchServicio();
                  }}
                >
                  No se usaron repuestos en este servicio
                </button>
              )}
            </div>

            {/* Remaining checklist items */}
            <div className="space-y-2">
              {itemsPorCat('reparacion')
                .filter(item => {
                  const d = item.descripcion.toLowerCase();
                  return !d.includes('repuestos') && !d.includes('gas cargado');
                })
                .map(item => (
                <button key={item.id} className="flex items-center gap-3 w-full p-3 rounded-lg border text-left min-h-12" onClick={() => !item.completado && handleChecklistItem(item.id)} disabled={item.completado}>
                  <CheckCircle className={`h-6 w-6 shrink-0 ${item.completado ? 'text-green-500' : 'text-gray-300'}`} />
                  <span className={`text-sm ${item.completado ? 'line-through text-muted-foreground' : ''}`}>{item.descripcion}</span>
                </button>
              ))}
            </div>

            {/* Fotos DURANTE — máx 2 */}
            {(() => {
              const fotosDurante = servicio.fotos?.filter(f => f.tipo === 'durante') || [];
              const maxDurante = 2;
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Fotos durante el servicio</p>
                    <span className={`text-xs font-medium ${fotosDurante.length >= maxDurante ? 'text-emerald-600' : 'text-slate-500'}`}>{fotosDurante.length}/{maxDurante}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {fotosDurante.map(f => (
                      <div key={f.id} className="aspect-square rounded-xl bg-gray-100 relative">
                        <img src={f.url} alt="Durante" className="w-full h-full object-cover rounded-xl" />
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
                  {fotosDurante.length < maxDurante && (
                    <Button variant="outline" className="w-full min-h-12" onClick={() => handleSubirFoto('durante')}>
                      <Camera className="h-4 w-4 mr-2" />
                      {uploadingTipos.has('durante') ? 'Subiendo...' : fotosDurante.length === 0 ? 'Tomar foto durante el servicio' : 'Tomar segunda foto durante'}
                    </Button>
                  )}
                  {fotosDurante.length >= maxDurante && (
                    <p className="text-xs text-emerald-600 font-medium text-center">✓ Fotos durante completadas</p>
                  )}
                </div>
              );
            })()}

            <div>
              <Button className="w-full min-h-12" onClick={handleAvanzarACierre}
                disabled={!itemsPorCat('reparacion').every(i => i.completado)}>
                Continuar al cierre <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASO 4 — CIERRE */}
      {pasoActual === 4 && (() => {
        const pendientes = checklist.filter(c => !c.completado);
        const checklistCompleto = pendientes.length === 0;
        return (
        <Card className="relative">
          <button onClick={() => setPasoActual(3)} className="absolute top-3 left-3 h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors z-10">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <CardContent className="p-4 pt-3 space-y-4">
            <h2 className="font-bold text-lg text-center">Cierre del servicio</h2>

            {!checklistCompleto && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Checklist incompleto ({pendientes.length} pendientes)</p>
                  <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
                    {pendientes.slice(0, 5).map(p => <li key={p.id}>• {p.descripcion}</li>)}
                    {pendientes.length > 5 && <li>... y {pendientes.length - 5} más</li>}
                  </ul>
                </div>
              </div>
            )}

            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
              <p><strong>Cliente:</strong> {servicio.cliente?.nombre}</p>
              <p><strong>Equipo:</strong> {servicio.equipo ? `${tipoEquipoLabel[servicio.equipo.tipo]} ${servicio.equipo.marca || ''}` : '--'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium">Checklist:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${checklistCompleto ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${((checklist.length - pendientes.length) / Math.max(1, checklist.length)) * 100}%` }} />
                </div>
                <span className="text-xs text-slate-500">{checklist.length - pendientes.length}/{checklist.length}</span>
              </div>
            </div>

            {/* Checklist de cierre */}
            {itemsPorCat('cierre').length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Checklist de cierre</p>
                <div className="space-y-2">
                  {itemsPorCat('cierre').map(item => {
                    const desc = item.descripcion.toLowerCase();
                    const isFirmaItem = desc.includes('firma');
                    const isFotoItem = desc.includes('foto');
                    const isValorItem = desc.includes('valor');
                    const isAuto = isFirmaItem || isFotoItem || isValorItem;
                    const hint = isFirmaItem
                      ? '✍️ Se confirma al guardar la firma del cliente'
                      : isFotoItem
                        ? '📷 Se confirma al subir la foto'
                        : isValorItem
                          ? '💰 Se confirma al ingresar el valor cobrado'
                          : null;
                    return (
                      <button
                        key={item.id}
                        className={`flex items-center gap-3 w-full p-3 rounded-lg border text-left min-h-12 ${isAuto && !item.completado ? 'opacity-60 cursor-default' : ''}`}
                        onClick={() => !item.completado && !isAuto && handleChecklistItem(item.id)}
                        disabled={item.completado || isAuto}
                      >
                        <CheckCircle className={`h-6 w-6 shrink-0 ${item.completado ? 'text-green-500' : 'text-gray-300'}`} />
                        <div className="flex-1">
                          <span className={`text-sm ${item.completado ? 'line-through text-muted-foreground' : ''}`}>{item.descripcion}</span>
                          {hint && !item.completado && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Descripción del trabajo realizado *</label>
              <Textarea value={descripcionTrabajo} onChange={e => setDescripcionTrabajo(e.target.value)} placeholder="Describe el trabajo que realizaste..." rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Valor cobrado *</label>
                <Input type="number" value={valorFinal} onChange={e => setValorFinal(e.target.value)} placeholder="80000" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Método de pago *</label>
                <Select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="link_pago">Link de pago</option>
                </Select>
              </div>
            </div>

            {/* Fotos DESPUÉS — máx 2 */}
            {(() => {
              const fotosDespues = servicio.fotos?.filter(f => f.tipo === 'despues') || [];
              const maxDespues = 2;
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Fotos después del servicio <span className="text-slate-400 font-normal">(obligatorias)</span></p>
                    <span className={`text-xs font-medium ${fotosDespues.length >= maxDespues ? 'text-emerald-600' : 'text-slate-500'}`}>{fotosDespues.length}/{maxDespues}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {fotosDespues.map(f => (
                      <div key={f.id} className="aspect-square rounded-xl bg-gray-100 relative">
                        <img src={f.url} alt="Después" className="w-full h-full object-cover rounded-xl" />
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
                  {fotosDespues.length < maxDespues && (
                    <Button variant="outline" className="w-full min-h-12" onClick={() => handleSubirFoto('despues')}>
                      <Camera className="h-4 w-4 mr-2" />
                      {uploadingTipos.has('despues') ? 'Subiendo...' : fotosDespues.length === 0 ? 'Tomar foto después del servicio' : 'Tomar segunda foto después'}
                    </Button>
                  )}
                  {fotosDespues.length >= maxDespues && (
                    <p className="text-xs text-emerald-600 font-medium text-center">✓ Fotos después completadas</p>
                  )}
                </div>
              );
            })()}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Firma del cliente *</label>
                {(firmada || servicio.firma) && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" />Firmado</span>}
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

            {/* Verificación de falla */}
            <div className="border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold">¿La falla fue la reportada por el cliente?</p>
              {servicio.descripcion_falla && (
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Falla reportada:</p>
                  <p className="text-sm text-slate-800 italic">"{servicio.descripcion_falla}"</p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    fallaConfirmada === true ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-green-300'
                  }`}
                  onClick={() => { setFallaConfirmada(true); setDiagnosticoFinal(''); }}
                >
                  <CheckCircle className={`h-5 w-5 mx-auto mb-1 ${fallaConfirmada === true ? 'text-green-500' : 'text-gray-300'}`} />
                  Sí, fue esa
                </button>
                <button
                  className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    fallaConfirmada === false ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-red-300'
                  }`}
                  onClick={() => setFallaConfirmada(false)}
                >
                  <AlertTriangle className={`h-5 w-5 mx-auto mb-1 ${fallaConfirmada === false ? 'text-red-500' : 'text-gray-300'}`} />
                  No, fue otra
                </button>
              </div>

              {fallaConfirmada === false && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-red-700">Selecciona el diagnóstico real:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      'Fuga de gas refrigerante',
                      'Compresor dañado',
                      'Tarjeta electrónica',
                      'Motor ventilador',
                      'Capacitor defectuoso',
                      'Obstrucción en drenaje',
                      'Filtros sucios / obstruidos',
                      'Sensor de temperatura',
                      'Válvula de expansión',
                      'Problema eléctrico / cableado',
                      'Termostato dañado',
                      'Bajo nivel de refrigerante',
                    ].map(opcion => (
                      <button
                        key={opcion}
                        className={`text-left text-xs p-2 rounded-lg border transition-colors ${
                          diagnosticoFinal === opcion
                            ? 'border-red-400 bg-red-50 text-red-800 font-medium'
                            : 'border-gray-200 hover:border-red-200 text-slate-600'
                        }`}
                        onClick={() => setDiagnosticoFinal(opcion)}
                      >
                        {opcion}
                      </button>
                    ))}
                  </div>
                  <Input
                    placeholder="Otro diagnóstico (escribir aquí)"
                    value={!['Fuga de gas refrigerante','Compresor dañado','Tarjeta electrónica','Motor ventilador','Capacitor defectuoso','Obstrucción en drenaje','Filtros sucios / obstruidos','Sensor de temperatura','Válvula de expansión','Problema eléctrico / cableado','Termostato dañado','Bajo nivel de refrigerante'].includes(diagnosticoFinal) ? diagnosticoFinal : ''}
                    onChange={(e) => setDiagnosticoFinal(e.target.value)}
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            <Button
              className="w-full min-h-14 text-base bg-green-600 hover:bg-green-700 text-white"
              onClick={handleCerrarServicio}
              disabled={saving || !checklistCompleto || fallaConfirmada === null || (fallaConfirmada === false && !diagnosticoFinal)}
            >
              {saving ? 'Cerrando...' : !checklistCompleto ? `CHECKLIST INCOMPLETO (${pendientes.length})` : fallaConfirmada === null ? 'CONFIRMA LA FALLA' : 'CERRAR SERVICIO'}
            </Button>
          </CardContent>
        </Card>
        );
      })()}

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
    </div>
  );
};
