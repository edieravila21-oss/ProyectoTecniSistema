import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { loginApi } from '@/api/auth';
import { toast } from '@/components/shared/Toast';
import { Zap, ShieldCheck, Wrench, ArrowRight } from 'lucide-react';

export const Login = () => {
  const [loading, setLoading] = useState<'admin' | 'tecnico' | null>(null);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const ingresarComo = async (rol: 'admin' | 'tecnico') => {
    setLoading(rol);
    try {
      const email = rol === 'admin' ? 'admin@techserv.com' : 'luis@techserv.com';
      const pin = rol === 'admin' ? '1234' : '5678';
      const { data: res } = await loginApi(email, pin);
      login(res.data.token, res.data.usuario);
      toast.success(`Bienvenido, ${res.data.usuario.nombre}`);
      navigate(rol === 'admin' ? '/admin/dashboard' : '/tecnico/agenda');
    } catch {
      toast.error('Error al conectar con el servidor');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-5">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TechServ Pro</h1>
          <p className="text-slate-500 text-sm mt-1.5">Gestión de servicios técnicos</p>
        </div>

        {/* Selector de rol */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
          <div className="text-center mb-2">
            <h2 className="text-lg font-semibold text-white">Selecciona tu perfil</h2>
            <p className="text-sm text-slate-500 mt-1">Acceso directo — modo desarrollo</p>
          </div>

          <button
            onClick={() => ingresarComo('admin')}
            disabled={loading !== null}
            className="w-full p-5 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/30 hover:border-blue-400/60 hover:from-blue-600/30 hover:to-indigo-600/20 transition-all duration-200 group text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/25 shrink-0">
                {loading === 'admin' ? (
                  <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ShieldCheck className="h-7 w-7 text-white" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-base">Administrador</p>
                <p className="text-slate-400 text-sm mt-0.5">Gestión completa del negocio</p>
              </div>
              <div className="text-blue-400 group-hover:translate-x-1 transition-transform">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
          </button>

          <button
            onClick={() => ingresarComo('tecnico')}
            disabled={loading !== null}
            className="w-full p-5 rounded-2xl bg-gradient-to-br from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 hover:border-emerald-400/60 hover:from-emerald-600/30 hover:to-teal-600/20 transition-all duration-200 group text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-600/25 shrink-0">
                {loading === 'tecnico' ? (
                  <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Wrench className="h-7 w-7 text-white" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-base">Técnico</p>
                <p className="text-slate-400 text-sm mt-0.5">Agenda y servicios asignados</p>
              </div>
              <div className="text-emerald-400 group-hover:translate-x-1 transition-transform">
                <ArrowRight className="h-5 w-5" />
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          Aires acondicionados & neveras
        </p>
      </div>
    </div>
  );
};
