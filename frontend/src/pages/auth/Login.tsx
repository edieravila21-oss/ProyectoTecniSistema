import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { verificarEmailApi, loginApi } from '@/api/auth';
import { toast } from '@/components/shared/Toast';
import { Zap, Mail, ArrowLeft, Delete } from 'lucide-react';

export const Login = () => {
  const [paso, setPaso] = useState<'email' | 'pin'>('email');
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleVerificarEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error('Ingresa tu correo');
    setLoading(true);
    try {
      const { data: res } = await verificarEmailApi(email);
      setNombre(res.data.nombre);
      setPaso('pin');
    } catch {
      toast.error('No se encontró una cuenta con ese correo');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (pinCompleto: string) => {
    setLoading(true);
    try {
      const { data: res } = await loginApi(email, pinCompleto);
      login(res.data.token, res.data.usuario);
      toast.success(`Bienvenido, ${res.data.usuario.nombre}`);
      navigate(res.data.usuario.rol === 'admin' ? '/admin/dashboard' : '/tecnico/agenda');
    } catch {
      toast.error('PIN incorrecto');
      setPin('');
      setLoading(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length >= 6 || loading) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length >= 4) {
      handleLogin(newPin);
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setPin(pin.slice(0, -1));
  };

  const handleBack = () => {
    setPaso('email');
    setPin('');
    setNombre('');
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/bg-login.png)' }} />
      <div className="absolute inset-0 backdrop-blur-md bg-slate-950/70" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-5">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">RefriElectri Pro</h1>
          <p className="text-slate-500 text-sm mt-1.5">Gestión de servicios técnicos</p>
        </div>

        {paso === 'email' ? (
          <form onSubmit={handleVerificarEmail} className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-lg font-semibold text-white">Iniciar sesión</h2>
              <p className="text-sm text-slate-500 mt-1">Ingresa tu correo electrónico</p>
            </div>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-blue-600/25"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Continuar'
              )}
            </button>
          </form>
        ) : (
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="text-center">
              <button onClick={handleBack} className="absolute left-6 top-6 text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <p className="text-sm text-slate-400">Hola,</p>
              <h2 className="text-lg font-semibold text-white">{nombre}</h2>
              <p className="text-sm text-slate-500 mt-1">Ingresa tu PIN</p>
            </div>

            <div className="flex justify-center gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    i < pin.length
                      ? 'bg-blue-500 scale-110 shadow-lg shadow-blue-500/50'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {loading && (
              <div className="flex justify-center">
                <div className="h-5 w-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  disabled={loading}
                  className="h-16 rounded-2xl bg-slate-800/80 border border-slate-700 text-white text-2xl font-semibold hover:bg-slate-700 active:scale-95 transition-all duration-150 disabled:opacity-50"
                >
                  {d}
                </button>
              ))}
              <div />
              <button
                onClick={() => handleDigit('0')}
                disabled={loading}
                className="h-16 rounded-2xl bg-slate-800/80 border border-slate-700 text-white text-2xl font-semibold hover:bg-slate-700 active:scale-95 transition-all duration-150 disabled:opacity-50"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="h-16 rounded-2xl bg-slate-800/50 border border-slate-700 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white active:scale-95 transition-all duration-150 disabled:opacity-50"
              >
                <Delete className="h-6 w-6" />
              </button>
            </div>

            <button
              onClick={handleBack}
              className="w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Usar otro correo
            </button>
          </div>
        )}

        <p className="text-center text-slate-600 text-xs mt-8">
          Aires acondicionados & neveras
        </p>
      </div>
    </div>
  );
};
