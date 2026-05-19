import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { useNotificacionesStore } from '@/store/notificacionesStore';
import {
  LayoutGrid, Briefcase, UsersRound,
  HardHat, MessageCircleMore, ChartNoAxesCombined,
  SlidersHorizontal, LogOut, Menu, X, Bell, Zap,
  ClipboardCheck, CalendarClock,
} from 'lucide-react';

const navItems = [
  { to: '/admin/dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { to: '/admin/servicios', icon: Briefcase, label: 'Servicios' },
  { to: '/admin/clientes', icon: UsersRound, label: 'Clientes' },
  { to: '/admin/tecnicos', icon: HardHat, label: 'Técnicos' },
  { to: '/admin/calendario', icon: CalendarClock, label: 'Calendario' },
  { to: '/admin/entrevistas', icon: ClipboardCheck, label: 'Entrevistas' },
  { to: '/admin/whatsapp', icon: MessageCircleMore, label: 'WhatsApp' },
  { to: '/admin/metricas', icon: ChartNoAxesCombined, label: 'Métricas' },
  { to: '/admin/configuracion', icon: SlidersHorizontal, label: 'Config' },
];

export const AdminLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { usuario, logout } = useAuthStore();
  const { whatsappConectado } = useSocketStore();
  const { mensajesNuevos } = useNotificacionesStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-dvh bg-[#f0f2f5]">

      {/* ── Top floating bar ── */}
      <header className="sticky top-0 z-50 px-4 pt-4 pb-2">
        <div className="max-w-6xl mx-auto flex items-center gap-3">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/25">
              <Zap className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="hidden sm:block font-bold text-sm tracking-tight text-slate-800">
              Tech<span className="text-blue-600">Serv</span>
            </span>
          </div>

          {/* ── Floating pill navbar (desktop) ── */}
          <nav className="hidden lg:flex items-center mx-auto bg-white rounded-full px-2 py-1.5 shadow-lg shadow-black/[0.04] border border-slate-100/80">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-300 whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4 shrink-0" />
                    {isActive && <span>{label}</span>}
                    {label === 'WhatsApp' && mensajesNuevos > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                        {mensajesNuevos}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-slate-100 shadow-sm">
              <span className={`h-1.5 w-1.5 rounded-full ${whatsappConectado ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-[11px] text-slate-400 font-medium">
                {whatsappConectado ? 'Online' : 'Offline'}
              </span>
            </div>
            <button className="h-9 w-9 rounded-full flex items-center justify-center bg-white border border-slate-100 shadow-sm hover:bg-slate-50 transition-colors">
              <Bell className="h-4 w-4 text-slate-400" />
            </button>
            <button
              onClick={handleLogout}
              className="hidden lg:flex h-9 w-9 rounded-full items-center justify-center bg-white border border-slate-100 shadow-sm hover:bg-red-50 hover:border-red-100 hover:text-red-500 transition-colors text-slate-400"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold shadow-md shadow-blue-600/20 cursor-pointer">
              {usuario?.nombre?.charAt(0) || 'A'}
            </div>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden h-9 w-9 rounded-full flex items-center justify-center bg-white border border-slate-100 shadow-sm"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile menu overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute top-4 left-4 right-4 bg-white rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-sm text-slate-800">TechServ <span className="text-blue-600">Pro</span></span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2">
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-3 rounded-xl text-[13px] font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                  {usuario?.nombre?.charAt(0) || 'A'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">{usuario?.nombre}</p>
                  <p className="text-[11px] text-slate-400">Administrador</p>
                </div>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 text-xs font-medium flex items-center gap-1">
                <LogOut className="h-3.5 w-3.5" /> Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ── */}
      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-4 lg:py-6">
        <Outlet />
      </main>
    </div>
  );
};
