import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { ToastContainer } from '@/components/shared/Toast';
import { SistemaBloqueado } from '@/components/shared/SistemaBloqueado';
import { useSystemLock } from '@/hooks/useSystemLock';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { TecnicoLayout } from '@/components/layout/TecnicoLayout';

import { Login } from '@/pages/auth/Login';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';

import { Dashboard } from '@/pages/admin/Dashboard';
import { Servicios } from '@/pages/admin/Servicios';
import { Clientes } from '@/pages/admin/Clientes';
import { Tecnicos } from '@/pages/admin/Tecnicos';
import { TecnicoDetalle } from '@/pages/admin/TecnicoDetalle';
import { WhatsAppPage } from '@/pages/admin/WhatsApp';
import { Metricas } from '@/pages/admin/Metricas';
import { Entrevistas } from '@/pages/admin/Entrevistas';
import { CalendarioTecnicos } from '@/pages/admin/CalendarioTecnicos';
import { Configuracion } from '@/pages/admin/Configuracion';
import { CatalogoServicios } from '@/pages/admin/CatalogoServicios';

import { AgendaTecnico } from '@/pages/tecnico/AgendaTecnico';
import { CalendarioTecnico } from '@/pages/tecnico/CalendarioTecnico';
import { ServicioActivo } from '@/pages/tecnico/ServicioActivo';
import { PerfilTecnico } from '@/pages/tecnico/PerfilTecnico';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { token, usuario } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && usuario && !roles.includes(usuario.rol)) {
    return <Navigate to={usuario.rol === 'admin' ? '/admin/dashboard' : '/tecnico/agenda'} replace />;
  }
  return <>{children}</>;
};

const AppContent = () => {
  const { token, usuario } = useAuthStore();
  const { inicializar, destruir } = useSocketStore();

  useEffect(() => {
    if (token) {
      inicializar();
      return () => destruir();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const defaultRoute = !token
    ? '/login'
    : usuario?.rol === 'admin'
    ? '/admin/dashboard'
    : '/tecnico/agenda';

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to={defaultRoute} replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="servicios" element={<Servicios />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="tecnicos" element={<Tecnicos />} />
        <Route path="tecnicos/:id" element={<TecnicoDetalle />} />
        <Route path="calendario" element={<CalendarioTecnicos />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
        <Route path="metricas" element={<Metricas />} />
        <Route path="entrevistas" element={<Entrevistas />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="catalogo" element={<CatalogoServicios />} />
      </Route>

      <Route path="/tecnico" element={<ProtectedRoute roles={['tecnico']}><TecnicoLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="agenda" replace />} />
        <Route path="agenda" element={<AgendaTecnico />} />
        <Route path="calendario" element={<CalendarioTecnico />} />
        <Route path="servicio" element={<AgendaTecnico />} />
        <Route path="servicio/:id" element={<ServicioActivo />} />
        <Route path="perfil" element={<PerfilTecnico />} />
      </Route>

      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  );
};

function App() {
  const bloqueado = useSystemLock();
  if (bloqueado) return <SistemaBloqueado />;

  return (
    <BrowserRouter>
      <AppContent />
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
