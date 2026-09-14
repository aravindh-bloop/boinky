import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { LayoutDashboard, Map, ListTodo, Users, Bell, Calendar as CalendarIcon, HandCoins, Umbrella, Leaf, Menu, X, MapPin, LogOut } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import { AuthProvider, LoginGate, useAuth } from './lib/auth';
import { api } from './lib/api';
import { useBreakpoint } from './lib/useBreakpoint';
import { cn } from './lib/utils';

/** Sidebar collapse state, shared between the sidebar itself and the topbar's toggle. */
const SidebarCtx = createContext<{ isLg: boolean; isMd: boolean; drawerOpen: boolean; toggle: () => void }>({
  isLg: true,
  isMd: true,
  drawerOpen: false,
  toggle: () => {},
});

function SystemStatus() {
  const [state, setState] = useState<'checking' | 'ok' | 'down'>('checking');
  const [integrations, setIntegrations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    const check = () =>
      api
        .get<{ status: string; integrations?: Record<string, boolean> }>('/health')
        .then((r) => {
          if (!alive) return;
          setState(r.status === 'ok' ? 'ok' : 'down');
          setIntegrations(r.integrations ?? {});
        })
        .catch(() => alive && setState('down'));
    check();
    const t = setInterval(check, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const down = Object.entries(integrations).filter(([, v]) => !v).map(([k]) => k);
  const label =
    state === 'checking'
      ? 'Checking backend…'
      : state === 'down'
        ? 'Backend unreachable'
        : down.length
          ? `${down.join(', ')} offline`
          : 'All systems operational';
  const color = state === 'ok' && !down.length ? 'bg-green-400' : state === 'checking' ? 'bg-slate-400' : 'bg-red-400';

  return (
    <div className="p-4 m-4 bg-[#114b30] rounded-xl border border-white/5 shadow-inner">
      <div className="flex items-center gap-2 text-xs font-medium">
        <div className={`w-2 h-2 rounded-full ${color} shadow-[0_0_8px_rgba(74,222,128,0.6)]`} />
        {label}
      </div>
    </div>
  );
}

import { Overview } from './pages/Overview';
import { HotspotMap } from './pages/HotspotMap';
import { ValidationQueue } from './pages/ValidationQueue';
import { FarmersFields } from './pages/FarmersFields';
import { Alerts } from './pages/Alerts';
import { CropCalendar } from './pages/CropCalendar';
import { Subsidies } from './pages/Subsidies';
import { Insurance } from './pages/Insurance';
// Removed placeholders

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/map', label: 'Hotspot Map', icon: Map },
  { path: '/queue', label: 'Validation Queue', icon: ListTodo },
  { path: '/farmers', label: 'Farmers & Fields', icon: Users },
  { path: '/subsidies', label: 'Subsidies', icon: HandCoins },
  { path: '/insurance', label: 'Crop Insurance', icon: Umbrella },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/calendar', label: 'Crop Calendar', icon: CalendarIcon },
];

function Sidebar() {
  const location = useLocation();
  const { isLg, isMd, drawerOpen, toggle } = useContext(SidebarCtx);
  // full labelled rail on desktop, icon-only rail on tablet, off-canvas drawer on phone
  const mode: 'full' | 'rail' | 'drawer' = isLg ? 'full' : isMd ? 'rail' : 'drawer';

  return (
    <>
      {mode === 'drawer' && drawerOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={toggle} />
      )}
      <aside
        className={cn(
          'bg-agri-dark text-white flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform',
          mode === 'full' && 'w-64',
          mode === 'rail' && 'w-20',
          mode === 'drawer' && cn('w-64', drawerOpen ? 'translate-x-0' : '-translate-x-full'),
        )}
      >
        <div className={cn('p-6 flex items-center gap-3', mode === 'rail' && 'px-0 justify-center')}>
          <div className="w-10 h-10 rounded-full bg-agri-primary/40 border border-agri-primary flex items-center justify-center shrink-0">
            <Leaf size={22} className="text-agri-light" />
          </div>
          {mode !== 'rail' && (
            <div>
              <h2 className="text-2xl font-bold text-white leading-tight">Agrian</h2>
              <p className="text-[10px] text-agri-light/60 uppercase tracking-widest">Crop Health Intelligence</p>
            </div>
          )}
          {mode === 'drawer' && (
            <button onClick={toggle} className="ml-auto text-white/60 hover:text-white">
              <X size={18} />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => mode === 'drawer' && toggle()}
                title={mode === 'rail' ? item.label : undefined}
                className={cn(
                  'relative flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-colors',
                  mode === 'rail' && 'justify-center px-0 mx-2',
                  isActive ? 'text-agri-dark font-semibold' : 'text-white/80 hover:bg-white/10',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 bg-agri-light rounded-xl shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <item.icon size={20} className="relative z-10 shrink-0" />
                {mode !== 'rail' && <span className="relative z-10">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {mode !== 'rail' && <SystemStatus />}
        <OfficerFooter compact={mode === 'rail'} />
      </aside>
    </>
  );
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function OfficerFooter({ compact = false }: { compact?: boolean }) {
  const { officer, logout } = useAuth();
  if (compact) {
    return (
      <div className="p-4 border-t border-white/10 flex flex-col items-center gap-3">
        <div
          title={officer?.name ?? 'Officer'}
          className="w-9 h-9 rounded-full bg-agri-light text-agri-dark flex items-center justify-center font-bold text-xs shadow-sm shrink-0"
        >
          {initials(officer?.name ?? 'Officer')}
        </div>
        <button onClick={logout} title="Sign out" className="text-agri-light/60 hover:text-white shrink-0">
          <LogOut size={16} />
        </button>
      </div>
    );
  }
  return (
    <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-agri-light text-agri-dark flex items-center justify-center font-bold shadow-sm shrink-0">
          {initials(officer?.name ?? 'Officer')}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{officer?.name ?? 'Officer'}</div>
          <div className="text-[11px] text-agri-light/60 truncate">
            {officer?.region ? `${officer.region} • Agriculture Officer` : 'Agriculture Officer'}
          </div>
        </div>
      </div>
      <button onClick={logout} title="Sign out" className="text-agri-light/60 hover:text-white shrink-0">
        <LogOut size={16} />
      </button>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function TopBar() {
  const { officer } = useAuth();
  const { isMd, toggle } = useContext(SidebarCtx);
  const first = officer?.name?.split(' ')[0] ?? 'Officer';
  return (
    <header className="h-20 border-b bg-white flex items-center justify-between px-4 md:px-8 sticky top-0 z-20 shadow-sm">
      <div className="flex gap-4 items-center min-w-0">
        {!isMd && (
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-full bg-agri-dark text-white flex items-center justify-center shrink-0"
          >
            <Menu size={16} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 truncate">
            {greeting()}, {first} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 truncate hidden sm:block">
            What's happening across {officer?.region ?? 'your region'} today.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 shrink-0">
        <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <MapPin size={16} className="text-green-600" />
          <span className="text-sm font-medium">{officer?.region ?? 'All regions'}</span>
        </div>
        <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600">
          <Bell size={20} />
        </button>
        <div className="flex items-center gap-3 pl-3 md:pl-6 md:border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-agri-dark text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            {initials(officer?.name ?? 'Officer')}
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-semibold text-slate-800">{officer?.name ?? 'Officer'}</div>
            <div className="text-[11px] text-slate-500">Agriculture Officer</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isLg = useBreakpoint(1024);
  const isMd = useBreakpoint(768);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // a manual toggle only matters below the `lg` tier — auto-close the drawer if the
  // viewport grows back past it so it doesn't stay "open" behind a now-visible rail
  useEffect(() => {
    if (isLg) setDrawerOpen(false);
  }, [isLg]);
  return (
    <SidebarCtx.Provider value={{ isLg, isMd, drawerOpen, toggle: () => setDrawerOpen((v) => !v) }}>
      {children}
    </SidebarCtx.Provider>
  );
}

function Shell() {
  const { isLg, isMd } = useContext(SidebarCtx);
  const contentMargin = isLg ? 'ml-64' : isMd ? 'ml-20' : 'ml-0';
  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50 font-sans">
        <Sidebar />
        <main className={cn('flex-1 flex flex-col min-h-screen transition-[margin]', contentMargin)}>
          <TopBar />
          <div className="flex-1 overflow-auto relative">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/map" element={<HotspotMap />} />
                <Route path="/queue" element={<ValidationQueue />} />
                <Route path="/farmers" element={<FarmersFields />} />
                <Route path="/subsidies" element={<Subsidies />} />
                <Route path="/insurance" element={<Insurance />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/calendar" element={<CropCalendar />} />
              </Routes>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <LoginGate>
        <SidebarProvider>
          <Shell />
        </SidebarProvider>
      </LoginGate>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}

export default App;
