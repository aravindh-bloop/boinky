import { motion } from 'framer-motion';
import { Leaf, FileWarning, BellRing, MapPin, Bug } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export function Overview() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-8 space-y-6"
    >
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-agri-dark rounded-[20px] p-6 text-white relative overflow-hidden shadow-md">
          <div className="absolute right-6 top-6 bg-white/10 px-3 py-1 rounded text-xs font-medium backdrop-blur-sm">Last 30 Days</div>
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 mb-6">
            <Leaf size={24} className="text-white" />
          </div>
          <div>
            <p className="text-white/80 font-medium text-xs uppercase tracking-wider">TOTAL SCANS</p>
            <h3 className="text-[40px] font-bold leading-tight mt-1">
              12,480
            </h3>
            <p className="text-sm mt-2 text-green-300 flex items-center gap-1">↑ 12.4% <span className="text-white/60">from last 30 days</span></p>
          </div>
          {/* Decorative leaves */}
          <div className="absolute -bottom-4 -right-2 opacity-50">
            <Leaf size={100} className="text-agri-primary" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-6">
            <FileWarning size={24} className="text-amber-500" />
          </div>
          <div>
            <p className="text-slate-500 font-medium text-xs uppercase tracking-wider">PENDING VALIDATIONS</p>
            <h3 className="text-[40px] font-bold leading-tight mt-1 text-slate-800">
              184
            </h3>
            <p className="text-sm mt-2 text-amber-500 flex items-center gap-1">↑ 8.7% <span className="text-slate-400">from last 30 days</span></p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-6">
            <BellRing size={24} className="text-red-500" />
          </div>
          <div>
            <p className="text-slate-500 font-medium text-xs uppercase tracking-wider">ACTIVE ALERTS</p>
            <h3 className="text-[40px] font-bold leading-tight mt-1 text-slate-800">
              12
            </h3>
            <p className="text-sm mt-2 text-red-500 flex items-center gap-1">↑ 20% <span className="text-slate-400">from last 30 days</span></p>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-6">
            <MapPin size={24} className="text-green-600" />
          </div>
          <div>
            <p className="text-slate-500 font-medium text-xs uppercase tracking-wider">REGIONS COVERED</p>
            <h3 className="text-[40px] font-bold leading-tight mt-1 text-slate-800">
              18
            </h3>
            <p className="text-sm mt-2 text-slate-400 flex items-center gap-1">— No change</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-[15px] uppercase tracking-wider text-slate-800">CROP HEALTH OVERVIEW</h3>
              <p className="text-slate-500 text-sm mt-1">Live disease & pest outbreak hotspots</p>
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">i</div>
            </button>
          </div>
          <div className="h-[350px] bg-slate-50 rounded-xl overflow-hidden relative z-0 border border-slate-100">
            <MapContainer center={[19.75, 75.71]} zoom={6} scrollWheelZoom={false} zoomControl={true} dragging={false} className="h-full w-full rounded-xl">
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <CircleMarker center={[19.99, 73.78]} radius={16} color="transparent" fillColor="#ef4444" fillOpacity={0.4} />
              <CircleMarker center={[19.99, 73.78]} radius={6} color="#ef4444" fillColor="#ef4444" fillOpacity={1} />
              
              <CircleMarker center={[18.52, 73.85]} radius={24} color="transparent" fillColor="#ef4444" fillOpacity={0.4} />
              <CircleMarker center={[18.52, 73.85]} radius={8} color="#ef4444" fillColor="#ef4444" fillOpacity={1} />
              
              <CircleMarker center={[21.14, 79.08]} radius={20} color="transparent" fillColor="#22c55e" fillOpacity={0.4} />
              <CircleMarker center={[21.14, 79.08]} radius={7} color="#22c55e" fillColor="#22c55e" fillOpacity={1} />
              
              <CircleMarker center={[19.87, 75.34]} radius={14} color="transparent" fillColor="#f59e0b" fillOpacity={0.4} />
              <CircleMarker center={[19.87, 75.34]} radius={5} color="#f59e0b" fillColor="#f59e0b" fillOpacity={1} />
            </MapContainer>
            
            <div className="absolute bottom-4 right-4 bg-white p-3 rounded-xl shadow-md border border-slate-100 z-[400] flex flex-col gap-2">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><span className="text-xs font-medium text-slate-700">High</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div><span className="text-xs font-medium text-slate-700">Moderate</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div><span className="text-xs font-medium text-slate-700">Low</span></div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-[15px] uppercase tracking-wider text-slate-800">RECENT ACTIVITY</h3>
            <button className="text-agri-primary text-sm font-medium hover:underline">View all</button>
          </div>
          <div className="space-y-5">
            <div className="flex gap-4 items-center">
              <div className="w-9 h-9 flex items-center justify-center bg-red-100 text-red-600 rounded-full shrink-0"><Leaf size={18}/></div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-800">Tomato • Early Blight detected</p>
                <p className="text-xs text-slate-500">Pune, Maharashtra</p>
              </div>
              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">8 min ago <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div></div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-9 h-9 flex items-center justify-center bg-amber-100 text-amber-500 rounded-full shrink-0"><Bug size={18}/></div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-800">Cotton • Bollworm infestation</p>
                <p className="text-xs text-slate-500">Nashik, Maharashtra</p>
              </div>
              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">21 min ago <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div></div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-9 h-9 flex items-center justify-center bg-green-100 text-green-600 rounded-full shrink-0"><Leaf size={18}/></div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-800">Rice • Healthy</p>
                <p className="text-xs text-slate-500">Amravati, Maharashtra</p>
              </div>
              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">45 min ago <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div></div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-9 h-9 flex items-center justify-center bg-red-100 text-red-600 rounded-full shrink-0"><Leaf size={18}/></div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-800">Soybean • Rust disease detected</p>
                <p className="text-xs text-slate-500">Jalgaon, Maharashtra</p>
              </div>
              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">1 hr ago <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div></div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-9 h-9 flex items-center justify-center bg-amber-100 text-amber-500 rounded-full shrink-0"><Bug size={18}/></div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-slate-800">Maize • Fall Armyworm</p>
                <p className="text-xs text-slate-500">Akola, Maharashtra</p>
              </div>
              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">2 hrs ago <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100 relative overflow-hidden">
         <div className="flex justify-between items-center mb-6 relative z-10">
           <h3 className="font-bold text-[15px] uppercase tracking-wider text-slate-800">SCAN VOLUME TREND (LAST 30 DAYS)</h3>
           <select className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 outline-none">
             <option>Daily</option>
             <option>Weekly</option>
           </select>
         </div>
         <div className="h-[250px] relative z-10 w-full mt-4 bg-gradient-to-t from-agri-primary/10 to-transparent flex items-end">
           <svg viewBox="0 0 1000 200" className="w-full h-full text-agri-primary preserve-3d" preserveAspectRatio="none">
             <path d="M0,150 C100,150 150,80 250,90 C350,100 400,120 500,110 C600,100 650,40 750,50 C850,60 900,140 1000,20 L1000,200 L0,200 Z" fill="currentColor" fillOpacity="0.2" />
             <path d="M0,150 C100,150 150,80 250,90 C350,100 400,120 500,110 C600,100 650,40 750,50 C850,60 900,140 1000,20" fill="none" stroke="currentColor" strokeWidth="3" />
             <circle cx="250" cy="90" r="4" fill="white" stroke="currentColor" strokeWidth="2" />
             <circle cx="500" cy="110" r="4" fill="white" stroke="currentColor" strokeWidth="2" />
             <circle cx="750" cy="50" r="4" fill="white" stroke="currentColor" strokeWidth="2" />
             <circle cx="1000" cy="20" r="4" fill="white" stroke="currentColor" strokeWidth="2" />
           </svg>
           <div className="absolute top-10 right-10 bg-agri-dark text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-md">
             29 Aug 2026<br/>
             <span className="text-[10px] opacity-80">842 Scans</span>
           </div>
         </div>
      </div>
    </motion.div>
  );
}
