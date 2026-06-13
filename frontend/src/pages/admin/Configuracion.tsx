import { useEffect, useState } from 'react';
import { getConfiguracion, actualizarConfiguracion } from '@/api/configuracion';
import api from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { toast } from '@/components/shared/Toast';
import type { Configuracion as ConfigType } from '@/types';
import { Building2, Clock, DollarSign, MessageCircleMore, Bell, Save, Bot, Send } from 'lucide-react';

export const Configuracion = () => {
  const [config, setConfig] = useState<ConfigType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const enviarPushPrueba = async () => {
    setTestingPush(true);
    try {
      const { data: res } = await api.post<{ success: boolean; data: { enviadas: number } }>('/push/test');
      if (res.data.enviadas === 0) {
        toast.error('No hay técnicos con notificaciones activas. Asegúrate de que hayan abierto la app en Android.');
      } else {
        toast.success(`Notificación enviada a ${res.data.enviadas} dispositivo${res.data.enviadas !== 1 ? 's' : ''}`);
      }
    } catch {
      toast.error('Error enviando notificación de prueba');
    } finally {
      setTestingPush(false);
    }
  };

  useEffect(() => {
    getConfiguracion()
      .then(r => setConfig(r.data.data))
      .catch(() => toast.error('Error cargando configuración'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { data: res } = await actualizarConfiguracion(config);
      setConfig(res.data);
      toast.success('Configuración guardada');
    } catch { toast.error('Error guardando configuración'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;
  if (!config) return null;

  const update = (field: keyof ConfigType, value: any) =>
    setConfig({ ...config, [field]: value });

  const sections = [
    {
      icon: Building2, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
      title: 'Datos del negocio',
      content: (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Nombre del negocio</label>
            <Input value={config.nombre_negocio} onChange={e => update('nombre_negocio', e.target.value)} className="rounded-xl" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Teléfono</label>
              <Input value={config.telefono_negocio || ''} onChange={e => update('telefono_negocio', e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Dirección</label>
              <Input value={config.direccion_negocio || ''} onChange={e => update('direccion_negocio', e.target.value)} className="rounded-xl" />
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-600',
      title: 'Horario de atención',
      content: (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Hora inicio</label>
            <Input type="time" value={config.hora_inicio} onChange={e => update('hora_inicio', e.target.value)} className="rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Hora fin</label>
            <Input type="time" value={config.hora_fin} onChange={e => update('hora_fin', e.target.value)} className="rounded-xl" />
          </div>
        </div>
      ),
    },
    {
      icon: DollarSign, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
      title: 'Valores',
      content: (
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Valor del diagnóstico base (COP)</label>
          <Input type="number" value={config.valor_diagnostico} onChange={e => update('valor_diagnostico', parseFloat(e.target.value) || 0)} className="rounded-xl" />
        </div>
      ),
    },
    {
      icon: MessageCircleMore, iconBg: 'bg-green-50', iconColor: 'text-green-600',
      title: 'Bot de WhatsApp',
      content: (
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Mensaje de bienvenida</label>
          <Textarea value={config.mensaje_bienvenida} onChange={e => update('mensaje_bienvenida', e.target.value)} rows={3} className="rounded-xl" />
        </div>
      ),
    },
    {
      icon: Bot, iconBg: 'bg-cyan-50', iconColor: 'text-cyan-600',
      title: 'Tiempos de respuesta del bot',
      content: (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Controla cuánto espera el bot antes de responder, para que los clientes puedan terminar de escribir.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Espera mínima (seg)</label>
              <Input type="number" min="1" max="15" step="0.5" value={(config.bot_debounce_ms || 4000) / 1000} onChange={e => update('bot_debounce_ms', Math.round(parseFloat(e.target.value) * 1000) || 4000)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Espera máxima (seg)</label>
              <Input type="number" min="5" max="60" step="1" value={(config.bot_max_espera_ms || 25000) / 1000} onChange={e => update('bot_max_espera_ms', Math.round(parseFloat(e.target.value) * 1000) || 25000)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Espera typing (seg)</label>
              <Input type="number" min="2" max="15" step="0.5" value={(config.bot_typing_espera_ms || 6000) / 1000} onChange={e => update('bot_typing_espera_ms', Math.round(parseFloat(e.target.value) * 1000) || 6000)} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Delay antes de enviar (seg)</label>
              <Input type="number" min="0" max="10" step="0.5" value={(config.bot_delay_respuesta_ms || 2000) / 1000} onChange={e => update('bot_delay_respuesta_ms', Math.round(parseFloat(e.target.value) * 1000) || 0)} className="rounded-xl" />
            </div>
          </div>
          <p className="text-xs text-slate-400">• Espera mínima: segundos sin mensaje nuevo antes de responder. • Espera máxima: límite total. • Espera typing: si sigue escribiendo. • Delay antes de enviar: muestra "escribiendo..." antes de mandar la respuesta (simula humano).</p>
        </div>
      ),
    },
    {
      icon: Bell, iconBg: 'bg-violet-50', iconColor: 'text-violet-600',
      title: 'Recordatorios',
      content: (
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Meses entre recordatorios de mantenimiento</label>
          <Input type="number" min="1" max="24" value={config.meses_recordatorio} onChange={e => update('meses_recordatorio', parseInt(e.target.value) || 6)} className="rounded-xl" />
        </div>
      ),
    },
  ];

  const pushSection = (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-9 w-9 rounded-xl bg-orange-50 flex items-center justify-center">
          <Send className="h-4 w-4 text-orange-600" />
        </div>
        <h3 className="font-semibold text-slate-800">Notificaciones Push</h3>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Envía una notificación de prueba a todos los técnicos que tengan la app instalada en Android. Útil para verificar que las notificaciones push están funcionando correctamente.
        </p>
        <Button
          onClick={enviarPushPrueba}
          disabled={testingPush}
          variant="outline"
          className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50"
        >
          <Send className="h-4 w-4 mr-2" />
          {testingPush ? 'Enviando...' : 'Enviar notificación de prueba a técnicos'}
        </Button>
        <p className="text-xs text-slate-400">
          El técnico debe haber abierto la app en su Android y aceptado los permisos de notificación al menos una vez.
        </p>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Configuración</h1>
          <p className="text-sm text-slate-400 mt-0.5">Ajustes generales del negocio</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="rounded-xl">
          <Save className="h-4 w-4 mr-1.5" />{saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      {sections.map(({ icon: Icon, iconBg, iconColor, title, content }) => (
        <Card key={title} className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <h3 className="font-semibold text-slate-800">{title}</h3>
          </div>
          {content}
        </Card>
      ))}
      {pushSection}
    </div>
  );
};
