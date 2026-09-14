import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import {
  LayoutDashboard,
  Map,
  ListTodo,
  Users,
  Bell,
  Calendar as CalendarIcon,
  HandCoins,
  Umbrella,
  Leaf,
  Menu,
  X,
  MapPin,
  LogOut,
  Search,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import { AuthProvider, LoginGate, useAuth } from './lib/auth';
import { api } from './lib/api';
import { useBreakpoint } from './lib/useBreakpoint';
import { cn } from './lib/utils';

import { Overview } from './pages/Overview';
import { HotspotMap } from './pages/HotspotMap';
import { ValidationQueue } from './pages/ValidationQueue';
import { FarmersFields } from './pages/FarmersFields';
import { Alerts } from './pages/Alerts';
import { CropCalendar } from './pages/CropCalendar';
import { Subsidies } from './pages/Subsidies';
import { Insurance } from './pages/Insurance';

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
  const color = state === 'ok' && !down.length ? 'bg-emerald-400' : state === 'checking' ? 'bg-slate-400' : 'bg-rose-400';

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-200">
        <div className={`h-2.5 w-2.5 rounded-full ${color} shadow-[0_0_12px_rgba(74,222,128,0.45)]`} />
        {label}
      </div>
    </div>
  );
}

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
  const mode: 'full' | 'rail' | 'drawer' = isLg ? 'full' : isMd ? 'rail' : 'drawer';

  return (
    <>
      {mode === 'drawer' && drawerOpen && <div className="fixed inset-0 z-40 bg-slate-950/40" onClick={toggle} />}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-[#1d4034] bg-[#0e2c22] text-white shadow-[0_30px_80px_rgba(15,45,34,0.28)] transition-all duration-300',
          mode === 'full' && 'w-72',
          mode === 'rail' && 'w-24',
          mode === 'drawer' && cn('w-72', drawerOpen ? 'translate-x-0' : '-translate-x-full'),
        )}
      >
        <div className={cn('flex items-center gap-3 border-b border-white/10 px-5 py-5', mode === 'rail' && 'justify-center px-2')}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ebfff1] via-[#d8f4df] to-[#b8ecd0] text-[#0f2d22] shadow-inner">
            <Leaf size={22} />
          </div>
          {mode !== 'rail' && (
            <div className="min-w-0">
              <h2 className="text-[1.7rem] font-black tracking-tight">Agrian</h2>
              <p className="text-[9px] uppercase tracking-[0.22em] text-emerald-100/70">Crop Health Intelligence</p>
            </div>
          )}
          {mode === 'drawer' && (
            <button onClick={toggle} className="ml-auto rounded-full p-1.5 text-emerald-100/70 hover:bg-white/5 hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => mode === 'drawer' && toggle()}
                title={mode === 'rail' ? item.label : undefined}
                className={cn(
                  'group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 transition-all duration-200',
                  mode === 'rail' && 'justify-center px-0',
                  isActive ? 'bg-[#ebfff1] text-[#0f2d22]' : 'text-emerald-50/80 hover:bg-white/5 hover:text-white',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="absolute inset-0 rounded-2xl bg-[#ebfff1]"
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  />
                )}
                <item.icon size={19} className={cn('relative z-10 shrink-0', isActive ? 'text-[#0f2d22]' : 'text-emerald-100/80')} />
                {mode !== 'rail' && <span className="relative z-10 text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!mode || mode === 'drawer' ? <SystemStatus /> : null}
        <OfficerFooter compact={mode === 'rail'} />
      </aside>
    </>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function OfficerFooter({ compact = false }: { compact?: boolean }) {
  const { officer, logout } = useAuth();

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-3 border-t border-white/10 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ebfff1] text-sm font-bold text-[#0f2d22]">
          {initials(officer?.name ?? 'Officer')}
        </div>
        <button onClick={logout} title="Sign out" className="rounded-full p-2 text-emerald-100/70 hover:bg-white/5 hover:text-white">
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ebfff1] text-sm font-bold text-[#0f2d22]">
          {initials(officer?.name ?? 'Officer')}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{officer?.name ?? 'Officer'}</div>
          <div className="truncate text-[11px] text-emerald-100/70">
            {officer?.region ? `${officer.region} • Agriculture Officer` : 'Agriculture Officer'}
          </div>
        </div>
      </div>
      <button onClick={logout} title="Sign out" className="rounded-full p-2 text-emerald-100/70 hover:bg-white/5 hover:text-white">
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
    <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/75 px-4 py-4 backdrop-blur-xl md:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {!isMd && (
            <button
              onClick={toggle}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              <Menu size={17} />
            </button>
          )}

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1d6b46]">Operations dashboard</p>
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {greeting()}, {first} <span className="text-2xl">👋</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm xl:flex">
            <MapPin size={16} className="text-[#1d6b46]" />
            <span className="font-medium">{officer?.region ?? 'All regions'}</span>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm md:flex">
            <Search size={14} />
            <span>Search</span>
          </div>

          <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900">
            <Bell size={18} />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f2d22] text-sm font-bold text-white">
              {initials(officer?.name ?? 'Officer')}
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-semibold text-slate-800">{officer?.name ?? 'Officer'}</div>
              <div className="text-[11px] text-slate-500">Agriculture Officer</div>
            </div>
            <ChevronRight size={15} className="hidden text-slate-400 md:block" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[#dfece3] bg-[#f5fbf7] px-4 py-3 md:px-5">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Sparkles size={14} className="text-[#1d6b46]" />
          <span>Field intelligence refreshed 4 minutes ago</span>
        </div>
        <button className="hidden rounded-full bg-[#0f2d22] px-3 py-1.5 text-xs font-semibold text-white shadow-sm md:inline-flex">
          View briefing
        </button>
      </div>
    </header>
  );
}

function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isLg = useBreakpoint(1024);
  const isMd = useBreakpoint(768);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  const contentMargin = isLg ? 'ml-72' : isMd ? 'ml-24' : 'ml-0';

  return (
    <Router>
      <div className="flex min-h-screen bg-[#f4f7f2] font-sans">
        <Sidebar />
        <main className={cn('flex min-h-screen flex-1 flex-col transition-[margin]', contentMargin)}>
          <TopBar />
          <div className="flex-1 overflow-auto">
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
