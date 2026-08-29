import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Map, ListTodo, Users, Bell, Calendar as CalendarIcon, HandCoins, Leaf, ChevronRight, MapPin, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AuthProvider, LoginGate, useAuth } from './lib/auth';
import { api } from './lib/api';

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
// Removed placeholders

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/map', label: 'Hotspot Map', icon: Map },
  { path: '/queue', label: 'Validation Queue', icon: ListTodo },
  { path: '/farmers', label: 'Farmers & Fields', icon: Users },
  { path: '/subsidies', label: 'Subsidies', icon: HandCoins },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/calendar', label: 'Crop Calendar', icon: CalendarIcon },
];

function Sidebar() {
  const location = useLocation();
  
  return (
    <aside className="w-64 bg-agri-dark text-white flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6">
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-agri-primary/40 border border-agri-primary flex items-center justify-center">
             <Leaf size={22} className="text-agri-light" />
          </div>
          <span className="text-white">AgriPod</span>
        </h2>
        <p className="text-[10px] text-agri-light/60 uppercase tracking-widest mt-1 ml-[52px]">
          Crop Health Intelligence
        </p>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-colors ${
                isActive ? 'text-agri-dark font-semibold' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-agri-light rounded-xl shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <item.icon size={20} className="relative z-10" />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <SystemStatus />

      <OfficerFooter />
    </aside>
  );
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function OfficerFooter() {
  const { officer, logout } = useAuth();
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
  const first = officer?.name?.split(' ')[0] ?? 'Officer';
  return (
    <header className="h-20 border-b bg-white flex items-center justify-between px-8 sticky top-0 z-20 shadow-sm">
      <div className="flex gap-4 items-center">
        <button className="w-8 h-8 rounded-full bg-agri-dark text-white flex items-center justify-center">
          <ChevronRight size={16} className="rotate-180" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {greeting()}, {first} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            What's happening across {officer?.region ?? 'your region'} today.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <MapPin size={16} className="text-green-600" />
          <span className="text-sm font-medium">{officer?.region ?? 'All regions'}</span>
        </div>
        <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600">
          <Bell size={20} />
        </button>
        <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full bg-agri-dark text-white flex items-center justify-center font-bold text-sm shadow-sm">
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

function Shell() {
  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50 font-sans">
        <Sidebar />
        <main className="flex-1 ml-64 flex flex-col min-h-screen">
          <TopBar />
          <div className="flex-1 overflow-auto relative">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/map" element={<HotspotMap />} />
                <Route path="/queue" element={<ValidationQueue />} />
                <Route path="/farmers" element={<FarmersFields />} />
                <Route path="/subsidies" element={<Subsidies />} />
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
        <Shell />
      </LoginGate>
    </AuthProvider>
  );
}

export default App;
