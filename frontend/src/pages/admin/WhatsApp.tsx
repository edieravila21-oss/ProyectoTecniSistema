import { useEffect, useState, useRef } from 'react';
import { getConversaciones, getConversacion, cambiarEstadoConversacion, toggleBotConversacion, agregarNotaConversacion, getEstadoBot, conectarBot, desconectarBot, eliminarConversacion, enviarEncuesta } from '@/api/whatsapp';
import { Input } from '@/components/ui/input';
import { useSocketStore } from '@/store/socketStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/shared/Toast';
import { formatRelative } from '@/utils/helpers';
import type { ConversacionWhatsApp, MensajeWhatsApp, EstadoConversacion } from '@/types';
import {
  MessageCircleMore, QrCode, Bot, UserCircle, BotOff,
  Phone, Calendar, AlertTriangle, CheckCircle2, X, GripVertical,
  MessageSquare, Pause, Play, Wifi, Loader2, WifiOff, Trash2,
} from 'lucide-react';

const COLUMNAS: { id: EstadoConversacion; label: string; color: string; icon: React.ReactNode; bg: string }[] = [
  { id: 'nuevo', label: 'Nuevos', color: 'text-blue-600', icon: <MessageCircleMore className="h-4 w-4" />, bg: 'bg-blue-50 border-blue-200' },
  { id: 'en_conversacion', label: 'En Conversación', color: 'text-amber-600', icon: <MessageSquare className="h-4 w-4" />, bg: 'bg-amber-50 border-amber-200' },
  { id: 'agendado', label: 'Agendados', color: 'text-emerald-600', icon: <Calendar className="h-4 w-4" />, bg: 'bg-emerald-50 border-emerald-200' },
  { id: 'escalado', label: 'Escalados', color: 'text-red-600', icon: <AlertTriangle className="h-4 w-4" />, bg: 'bg-red-50 border-red-200' },
  { id: 'bot_pausado', label: 'Bot Pausado', color: 'text-purple-600', icon: <BotOff className="h-4 w-4" />, bg: 'bg-purple-50 border-purple-200' },
  { id: 'completado', label: 'Completados', color: 'text-slate-500', icon: <CheckCircle2 className="h-4 w-4" />, bg: 'bg-slate-50 border-slate-200' },
];

export const WhatsAppPage = () => {
  const [conversaciones, setConversaciones] = useState<ConversacionWhatsApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConv, setSelectedConv] = useState<ConversacionWhatsApp | null>(null);
  const [mensajes, setMensajes] = useState<MensajeWhatsApp[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState('');
  const [draggedTel, setDraggedTel] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showEncuesta, setShowEncuesta] = useState(false);
  const [encuestaTel, setEncuestaTel] = useState('');
  const [enviandoEncuesta, setEnviandoEncuesta] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { socket, whatsappConectado } = useSocketStore();
  const { resetMensajes } = useNotificacionesStore();

  const fetchConversaciones = async () => {
    try {
      const { data: res } = await getConversaciones();
      setConversaciones(res.data || []);
    } catch {
      setConversaciones([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchConversaciones(); resetMensajes(); }, []);

  useEffect(() => {
    socket?.on('whatsapp_conversacion_update', () => fetchConversaciones());
    socket?.on('whatsapp_mensaje', () => fetchConversaciones());
    socket?.on('whatsapp_qr', (data: { qr: string }) => { setQrData(data.qr); });
    socket?.on('servicio_calificado', (data: { servicioId: string; calificacion: number }) => {
      const estrellas = '⭐'.repeat(data.calificacion);
      console.log(`[ENCUESTA] Calificación recibida: ${data.calificacion} ${estrellas} — Servicio: ${data.servicioId}`);
      toast.success(`Calificación recibida: ${estrellas} (${data.calificacion}/5)`);
    });
    return () => {
      socket?.off('whatsapp_conversacion_update');
      socket?.off('whatsapp_mensaje');
      socket?.off('whatsapp_qr');
      socket?.off('servicio_calificado');
    };
  }, [socket]);

  useEffect(() => {
    if (whatsappConectado && showQR) {
      setShowQR(false);
      setQrData('');
      toast.success('WhatsApp conectado correctamente');
    }
  }, [whatsappConectado]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const openDetail = async (conv: ConversacionWhatsApp) => {
    setSelectedConv(conv);
    try {
      const { data: res } = await getConversacion(conv.telefono);
      setMensajes(res.data.mensajes);
      if (res.data.conversacion) setSelectedConv(res.data.conversacion);
    } catch { toast.error('Error cargando detalle'); }
  };

  const handleToggleBot = async (telefono: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await toggleBotConversacion(telefono);
      await fetchConversaciones();
      if (selectedConv?.telefono === telefono) {
        const { data: res } = await getConversacion(telefono);
        setSelectedConv(res.data.conversacion);
      }
      toast.success('Bot actualizado');
    } catch { toast.error('Error actualizando bot'); }
  };

  const handleMoveEstado = async (telefono: string, estado: EstadoConversacion) => {
    try {
      await cambiarEstadoConversacion(telefono, estado);
      await fetchConversaciones();
      if (selectedConv?.telefono === telefono) {
        const { data: res } = await getConversacion(telefono);
        setSelectedConv(res.data.conversacion);
      }
    } catch { toast.error('Error moviendo conversación'); }
  };

  const [conectando, setConectando] = useState(false);

  const handleConectar = async () => {
    setConectando(true);
    try {
      await conectarBot();
      setShowQR(true);
    } catch { toast.error('Error al iniciar conexión'); }
    finally { setConectando(false); }
  };

  const handleDesconectar = async () => {
    try {
      await desconectarBot();
      toast.success('WhatsApp desconectado');
    } catch { toast.error('Error al desconectar'); }
  };

  const handleEliminar = async (telefono: string) => {
    if (!confirm('¿Eliminar esta conversación y todos sus mensajes?')) return;
    try {
      await eliminarConversacion(telefono);
      setSelectedConv(null);
      setMensajes([]);
      await fetchConversaciones();
      toast.success('Conversación eliminada');
    } catch { toast.error('Error eliminando conversación'); }
  };

  const onDragStart = (telefono: string) => setDraggedTel(telefono);
  const onDragEnd = () => { setDraggedTel(null); setDragOverCol(null); };
  const onDragOver = (e: React.DragEvent, colId: string) => { e.preventDefault(); setDragOverCol(colId); };
  const onDragLeave = () => setDragOverCol(null);
  const onDrop = async (colId: EstadoConversacion) => {
    if (draggedTel) {
      await handleMoveEstado(draggedTel, colId);
    }
    setDraggedTel(null);
    setDragOverCol(null);
  };

  const convsBy = (estado: EstadoConversacion) =>
    conversaciones.filter(c => c.estado === estado);

  return (
    <div className="space-y-4 h-[calc(100dvh-130px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">WhatsApp</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gestión de conversaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-emerald-500" /> {conversaciones.filter(c => c.bot_activo).length} activos</span>
            <span className="flex items-center gap-1.5"><BotOff className="h-3.5 w-3.5 text-purple-500" /> {conversaciones.filter(c => !c.bot_activo).length} pausados</span>
          </div>
          {whatsappConectado ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEncuesta(true)}
                className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 shadow-sm hover:bg-amber-100 transition-colors text-xs font-semibold text-amber-700 flex items-center gap-1.5"
              >
                ⭐ Enviar encuesta
              </button>
              <div className="flex items-center gap-0">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-l-full bg-emerald-50 border border-emerald-200 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-600">WhatsApp conectado</span>
                </div>
                <button
                  onClick={handleDesconectar}
                  className="px-2 py-1.5 rounded-r-full bg-red-50 border border-red-200 shadow-sm hover:bg-red-100 transition-colors"
                  title="Desconectar WhatsApp"
                >
                  <WifiOff className="h-3.5 w-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ) : (
            <Button size="sm" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md" onClick={handleConectar} disabled={conectando}>
              {conectando ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5 mr-1.5" />}
              Conectar WhatsApp
            </Button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full min-w-max pb-2">
          {COLUMNAS.map(col => {
            const items = convsBy(col.id);
            const isOver = dragOverCol === col.id;
            return (
              <div
                key={col.id}
                className={`w-[240px] flex flex-col rounded-2xl border transition-all duration-200 ${col.bg} ${isOver ? 'ring-2 ring-blue-400 scale-[1.01]' : ''}`}
                onDragOver={(e) => onDragOver(e, col.id)}
                onDragLeave={onDragLeave}
                onDrop={() => onDrop(col.id)}
              >
                {/* Column header */}
                <div className="p-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={col.color}>{col.icon}</span>
                    <span className={`text-sm font-bold ${col.color}`}>{col.label}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 ${col.color}`}>
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
                  {items.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      Sin conversaciones
                    </div>
                  ) : (
                    items.map(conv => (
                      <div
                        key={conv.telefono}
                        draggable
                        onDragStart={() => onDragStart(conv.telefono)}
                        onDragEnd={onDragEnd}
                        onClick={() => openDetail(conv)}
                        className={`bg-white rounded-lg px-2.5 py-1.5 shadow-sm border border-white/80 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group ${
                          draggedTel === conv.telefono ? 'opacity-40 scale-95' : ''
                        } ${selectedConv?.telefono === conv.telefono ? 'ring-2 ring-blue-400' : ''}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="h-3 w-3 text-slate-200 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-semibold text-xs text-slate-700 truncate">
                                {conv.nombre || conv.cliente?.nombre || conv.telefono}
                              </p>
                              <div className="flex items-center gap-1 shrink-0">
                                {conv.ultimo_mensaje_at && (
                                  <span className="text-[10px] text-slate-300">
                                    {formatRelative(conv.ultimo_mensaje_at)}
                                  </span>
                                )}
                                <button
                                  onClick={(e) => handleToggleBot(conv.telefono, e)}
                                  className={`p-0.5 rounded transition-colors ${
                                    conv.bot_activo
                                      ? 'text-emerald-500 hover:bg-emerald-50'
                                      : 'text-purple-500 hover:bg-purple-50'
                                  }`}
                                  title={conv.bot_activo ? 'Pausar bot' : 'Activar bot'}
                                >
                                  {conv.bot_activo ? <Bot className="h-3 w-3" /> : <BotOff className="h-3 w-3" />}
                                </button>
                              </div>
                            </div>
                            {conv.ultimo_mensaje && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {conv.ultimo_mensaje}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Panel (Slide over) */}
      {selectedConv && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedConv(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Detail Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center text-emerald-700 font-bold">
                  {(selectedConv.nombre || selectedConv.cliente?.nombre || selectedConv.telefono).charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{selectedConv.nombre || selectedConv.cliente?.nombre || selectedConv.telefono}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedConv.telefono}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleBot(selectedConv.telefono)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    selectedConv.bot_activo
                      ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                  }`}
                >
                  {selectedConv.bot_activo ? <><Pause className="h-3 w-3" /> Pausar Bot</> : <><Play className="h-3 w-3" /> Activar Bot</>}
                </button>
                <button
                  onClick={() => handleEliminar(selectedConv.telefono)}
                  className="p-2 rounded-xl hover:bg-red-50 transition-colors"
                  title="Eliminar conversación"
                >
                  <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                </button>
                <button onClick={() => setSelectedConv(null)} className="p-2 rounded-xl hover:bg-slate-100">
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Info cards */}
            <div className="p-4 space-y-3 shrink-0 border-b border-slate-100">
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</p>
                  <p className="text-sm font-bold text-slate-700 mt-1 capitalize">{selectedConv.estado.replace('_', ' ')}</p>
                </div>
                <div className="flex-1 bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bot</p>
                  <p className={`text-sm font-bold mt-1 ${selectedConv.bot_activo ? 'text-emerald-600' : 'text-purple-600'}`}>
                    {selectedConv.bot_activo ? 'Activo' : 'Pausado'}
                  </p>
                </div>
              </div>

              {selectedConv.servicio && (
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Servicio Vinculado</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    {selectedConv.servicio.descripcion_falla || 'Sin descripción'} — <span className="font-bold capitalize">{selectedConv.servicio.estado}</span>
                  </p>
                  {selectedConv.servicio.fecha_programada && (
                    <p className="text-xs text-emerald-600 mt-0.5">📅 {new Date(selectedConv.servicio.fecha_programada).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  )}
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-2">
                {COLUMNAS.filter(c => c.id !== selectedConv.estado).map(col => (
                  <button
                    key={col.id}
                    onClick={() => handleMoveEstado(selectedConv.telefono, col.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-colors hover:shadow-sm ${col.bg} ${col.color}`}
                  >
                    {col.icon}
                    <span className="hidden sm:inline">{col.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f0f2f5]">
              {mensajes.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircleMore className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">Sin mensajes</p>
                </div>
              ) : (
                mensajes.map(m => (
                  <div key={m.id} className={`flex ${m.direccion === 'saliente' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
                      m.direccion === 'saliente'
                        ? 'bg-[#dcf8c6] text-slate-800 rounded-br-md'
                        : 'bg-white text-slate-800 rounded-bl-md'
                    }`}>
                      <div className="flex items-center gap-1 mb-0.5">
                        {m.direccion === 'saliente' ? <Bot className="h-3 w-3 text-emerald-500" /> : <UserCircle className="h-3 w-3 text-slate-400" />}
                        <span className="text-[10px] font-semibold text-slate-400">{m.direccion === 'saliente' ? 'Bot' : 'Cliente'}</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{m.contenido}</p>
                      <p className="text-[10px] text-slate-400 text-right mt-1">{formatRelative(m.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Encuesta Modal */}
      {showEncuesta && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <Card className="max-w-sm w-full mx-4 p-8 rounded-3xl">
            <div className="text-center mb-5">
              <div className="h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⭐</span>
              </div>
              <h3 className="font-bold text-slate-800">Enviar encuesta de calificación</h3>
              <p className="text-sm text-slate-400 mt-1">El cliente recibirá una encuesta de 1 a 5 estrellas por WhatsApp</p>
            </div>
            <Input
              placeholder="Número (ej: 573001234567)"
              value={encuestaTel}
              onChange={e => setEncuestaTel(e.target.value)}
              className="rounded-xl mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600"
                disabled={!encuestaTel.trim() || enviandoEncuesta}
                onClick={async () => {
                  setEnviandoEncuesta(true);
                  try {
                    await enviarEncuesta(encuestaTel.trim());
                    toast.success('Encuesta enviada');
                    setShowEncuesta(false);
                    setEncuestaTel('');
                  } catch { toast.error('Error enviando encuesta'); }
                  finally { setEnviandoEncuesta(false); }
                }}
              >
                {enviandoEncuesta ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Enviar
              </Button>
              <Button variant="ghost" className="rounded-xl" onClick={() => { setShowEncuesta(false); setEncuestaTel(''); }}>
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* QR Modal */}
      {showQR && !whatsappConectado && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <Card className="max-w-sm w-full mx-4 p-8 text-center rounded-3xl">
            <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <QrCode className="h-7 w-7 text-blue-600" />
            </div>
            {qrData ? (
              <>
                <h3 className="font-bold text-slate-800 mb-1">Escanea el código QR</h3>
                <p className="text-sm text-slate-400 mb-5">Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular dispositivo</p>
                <img src={qrData} alt="QR Code" className="mx-auto w-56 h-56 rounded-xl" />
              </>
            ) : (
              <>
                <h3 className="font-bold text-slate-800 mb-1">Generando código QR...</h3>
                <p className="text-sm text-slate-400 mb-5">Espera un momento</p>
                <div className="flex justify-center py-8">
                  <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                </div>
              </>
            )}
            <Button variant="ghost" className="mt-5 rounded-xl" onClick={() => { setShowQR(false); setQrData(''); }}>Cancelar</Button>
          </Card>
        </div>
      )}
    </div>
  );
};
