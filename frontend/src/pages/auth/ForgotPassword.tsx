import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/shared/Toast';
import { Zap, ArrowLeft, Mail } from 'lucide-react';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
      toast.success('Si el correo existe, recibirás instrucciones');
    } catch { toast.error('Error enviando correo'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-5">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">RefriElectri Pro</h1>
          <p className="text-slate-500 text-sm mt-1.5">Gestión de servicios técnicos</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-emerald-500/10 mb-2">
                <Mail className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Correo enviado</h2>
              <p className="text-sm text-slate-400">Si el correo está registrado, recibirás instrucciones para restablecer tu PIN.</p>
              <Link to="/login" className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors mt-4">
                <ArrowLeft className="h-4 w-4" />Volver al login
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-500/10 mb-3">
                  <Mail className="h-6 w-6 text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Recuperar PIN</h2>
                <p className="text-sm text-slate-500 mt-1">Ingresa tu correo para restablecer tu PIN de acceso</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="pl-11 h-12 rounded-xl bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-600/25 transition-all duration-200"
                >
                  {loading ? 'Enviando...' : 'Enviar instrucciones'}
                </Button>
              </form>

              <div className="text-center pt-2">
                <Link to="/login" className="text-sm text-slate-500 hover:text-blue-400 transition-colors inline-flex items-center gap-1">
                  <ArrowLeft className="h-4 w-4" />Volver al login
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-8">
          Aires acondicionados & neveras
        </p>
      </div>
    </div>
  );
};
