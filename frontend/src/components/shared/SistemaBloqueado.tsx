import { ServerCrash } from 'lucide-react';

export const SistemaBloqueado = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/95 p-4">
    <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl p-6 text-center">
      <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
        <ServerCrash className="h-7 w-7 text-red-600" />
      </div>
      <h1 className="text-lg font-bold text-slate-800 mb-2">Servicio no disponible</h1>
      <p className="text-sm text-slate-500 leading-relaxed">
        Tu servidor alcanzó el límite gratuito de uso permitido. El sistema no estará disponible hasta que se actualice el plan.
      </p>
    </div>
  </div>
);
