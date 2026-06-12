import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getServicios } from '@/api/servicios';
import { cambiarPin } from '@/api/auth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EstadoBadge } from '@/components/shared/EstadoBadge';
import { formatDate, especialidadLabel } from '@/utils/helpers';
import { toast } from '@/components/shared/Toast';
import type { Servicio } from '@/types';
import {
  Mail, Phone, Wrench, LogOut, Star,
  CheckCircle2, Settings, TrendingUp, Clock, Key, ChevronDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';

export const PerfilTecnico = () => {
  const { usuario, logout } = useAuthStore();
  const navigate = useNavigate();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [stats, setStats] = useState({ total: 0, completados: 0, pendientes: 0 });
  const [showCambiarPin, setShowCambiarPin] = useState(false);
  const [pinActual, setPinActual] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinConfirmar, setPinConfirmar] = useState('');
  const [cambiandoPin, setCambiandoPin] = useState(false);

  useEffect(() => {
    const fetchServicios = async () => {
      if (!usuario) return;
      try {
        const { data: res } = await getServicios({ tecnico_id: usuario.id, limit: '5', page: '1' });
        const data = res.data;
        setServicios(data);
        setStats({
          total: res.meta?.total || data.length,
          completados: data.filter(s => s.estado === 'completado').length,
          pendientes: data.filter(s => !['completado', 'cancelado'].includes(s.estado)).length,
        });
      } catch {
        // Error al cargar servicios, se mantienen valores por defecto
      }
    };
    fetchServicios();
  }, [usuario]);

  const handleCambiarPin = async () => {
    if (pinNuevo !== pinConfirmar) {
      toast.error('Los PINs nuevos no coinciden');
      return;
    }
    if (pinNuevo.length < 4) {
      toast.error('El PIN debe tener al menos 4 dígitos');
      return;
    }
    setCambiandoPin(true);
    try {
      await cambiarPin(pinActual, pinNuevo);
      toast.success('PIN actualizado correctamente');
      setShowCambiarPin(false);
      setPinActual('');
      setPinNuevo('');
      setPinConfirmar('');
    } catch (err: unknown) {
      const error = err as AxiosError<{ error: string }>;
      toast.error(error.response?.data?.error || 'Error al cambiar PIN');
    } finally {
      setCambiandoPin(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!usuario) return null;

  const calificacion = usuario.estadisticas?.calificacion_promedio || 0;
  const totalServicios = usuario.estadisticas?.total_servicios || stats.total;
  const completados = usuario.estadisticas?.completados || stats.completados;

  return (
    <div className="space-y-5 max-w-lg mx-auto pb-20">
      {/* Profile Header */}
      <Card className="overflow-hidden">
        <div className="bg-linear-to-r from-slate-800 to-slate-700 h-20" />
        <div className="px-5 pb-5 -mt-10">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="h-20 w-20 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center text-2xl font-bold text-slate-700 overflow-hidden">
              {usuario.foto_url ? (
                <img src={usuario.foto_url} alt={usuario.nombre} className="h-full w-full object-cover" />
              ) : (
                <span className="bg-linear-to-br from-blue-100 to-indigo-100 h-full w-full flex items-center justify-center">
                  {usuario.nombre.charAt(0)}
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-slate-800 mt-3">{usuario.nombre}</h2>
            <p className="text-sm text-slate-500">Técnico Especialista</p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0">
                <Wrench className="h-3 w-3 mr-1" />
                {especialidadLabel[usuario.especialidad]}
              </Badge>
              {calificacion > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">
                  <Star className="h-3 w-3 mr-1" />
                  {calificacion.toFixed(1)}
                </Badge>
              )}
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                Activo
              </Badge>
            </div>
          </div>

          {/* Contact */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm">
              <Mail className="h-4 w-4 text-slate-400" />
              <span className="text-slate-700">{usuario.email}</span>
            </div>
            {usuario.telefono && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm">
                <Phone className="h-4 w-4 text-slate-400" />
                <span className="text-slate-700">{usuario.telefono}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-1.5">
            <Settings className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-[10px] text-slate-500 font-medium leading-tight">Total</p>
          <p className="text-xl font-bold text-slate-800">{totalServicios}</p>
        </Card>
        <Card className="p-3 text-center">
          <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-[10px] text-slate-500 font-medium leading-tight">Completados</p>
          <p className="text-xl font-bold text-slate-800">{completados}</p>
        </Card>
        <Card className="p-3 text-center">
          <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-1.5">
            <Star className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-[10px] text-slate-500 font-medium leading-tight">Calificación</p>
          <p className="text-xl font-bold text-slate-800">{calificacion.toFixed(1)}</p>
        </Card>
      </div>

      {/* Completion Rate */}
      {totalServicios > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Tasa de completados
            </span>
            <span className="text-sm font-bold text-slate-800">
              {((completados / totalServicios) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all"
              style={{ width: `${(completados / totalServicios) * 100}%` }}
            />
          </div>
        </Card>
      )}

      {/* Recent Services */}
      {servicios.length > 0 && (
        <Card>
          <div className="p-4 border-b">
            <h3 className="font-semibold text-slate-800 text-sm">Últimos Servicios</h3>
          </div>
          <div className="divide-y">
            {servicios.map((s: Servicio) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <Wrench className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {s.cliente?.nombre || 'Cliente'}
                  </p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {s.fecha_programada ? formatDate(s.fecha_programada) : '-'}
                    {s.hora_inicio && ` · ${s.hora_inicio}`}
                  </p>
                </div>
                <EstadoBadge estado={s.estado} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Change PIN */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setShowCambiarPin(!showCambiarPin)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <Key className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Cambiar PIN</p>
              <p className="text-xs text-slate-400">Actualiza tu PIN de acceso</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showCambiarPin ? 'rotate-180' : ''}`} />
        </button>

        {showCambiarPin && (
          <div className="px-4 pb-4 space-y-3 border-t">
            <div className="pt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">PIN actual</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••"
                  value={pinActual}
                  onChange={e => setPinActual(e.target.value.replace(/\D/g, ''))}
                  className="h-10 rounded-lg bg-slate-50 border-slate-200 text-center text-lg tracking-widest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Nuevo PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••"
                  value={pinNuevo}
                  onChange={e => setPinNuevo(e.target.value.replace(/\D/g, ''))}
                  className="h-10 rounded-lg bg-slate-50 border-slate-200 text-center text-lg tracking-widest"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Confirmar nuevo PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••"
                  value={pinConfirmar}
                  onChange={e => setPinConfirmar(e.target.value.replace(/\D/g, ''))}
                  className="h-10 rounded-lg bg-slate-50 border-slate-200 text-center text-lg tracking-widest"
                />
              </div>
              <Button
                onClick={handleCambiarPin}
                disabled={cambiandoPin || !pinActual || !pinNuevo || !pinConfirmar || pinNuevo !== pinConfirmar}
                className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
              >
                {cambiandoPin ? 'Actualizando...' : 'Actualizar PIN'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Logout */}
      <Button
        variant="destructive"
        className="w-full min-h-12 rounded-xl"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Cerrar sesión
      </Button>
    </div>
  );
};
