import { motion } from 'framer-motion';
import { MOCK_ALERTS } from '../lib/mockData';
import type { Alert } from '../lib/mockData';
import { useState } from 'react';
import { Plus, BellRing } from 'lucide-react';

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [showModal, setShowModal] = useState(false);
  const [newAlert, setNewAlert] = useState<Partial<Alert>>({ severity: 'medium', region: 'All' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const created: Alert = {
      id: Math.random().toString(),
      official_id: 'MV',
      region: newAlert.region || 'All',
      crop: newAlert.crop || 'All',
      title: newAlert.title || '',
      message: newAlert.message || '',
      severity: (newAlert.severity as any) || 'medium',
      created_at: new Date().toISOString()
    };
    setAlerts([created, ...alerts]);
    setShowModal(false);
    // Ideally use sonner toast here
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Broadcast Alerts</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-agri-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-agri-dark"
        >
          <Plus size={18} /> New Alert
        </button>
      </div>

      <div className="space-y-4">
        {alerts.map(alert => (
          <div key={alert.id} className="bg-white p-6 rounded-xl border flex gap-4 items-start shadow-sm">
            <div className={`p-3 rounded-xl ${
              alert.severity === 'high' ? 'bg-red-100 text-red-600' :
              alert.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
            }`}>
              <BellRing size={24} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg">{alert.title}</h3>
                <span className="text-xs text-slate-500">{new Date(alert.created_at).toLocaleString()}</span>
              </div>
              <div className="flex gap-2 mt-1 mb-3">
                <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-600">{alert.region}</span>
                <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 rounded text-slate-600">{alert.crop}</span>
              </div>
              <p className="text-slate-600 text-sm">{alert.message}</p>
            </div>
          </div>
        ))}
        {alerts.length === 0 && (
          <div className="p-12 text-center text-slate-500 bg-white border border-dashed rounded-xl">
            No alerts broadcasted yet.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl"
          >
            <h3 className="text-xl font-bold mb-4">Create New Alert</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                  <select 
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                    onChange={e => setNewAlert({...newAlert, region: e.target.value})}
                  >
                    <option>All Regions</option>
                    <option>Nashik</option>
                    <option>Pune</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Crop</label>
                  <select 
                    className="w-full border rounded-lg px-3 py-2 bg-white"
                    onChange={e => setNewAlert({...newAlert, crop: e.target.value})}
                  >
                    <option>All Crops</option>
                    <option>Tomato</option>
                    <option>Cotton</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                <div className="flex gap-4">
                  {['low', 'medium', 'high'].map(sev => (
                    <label key={sev} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="severity" 
                        value={sev} 
                        checked={newAlert.severity === sev}
                        onChange={e => setNewAlert({...newAlert, severity: e.target.value as any})}
                      />
                      <span className="capitalize text-sm">{sev}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alert Title</label>
                <input 
                  type="text" 
                  required
                  className="w-full border rounded-lg px-3 py-2"
                  onChange={e => setNewAlert({...newAlert, title: e.target.value})}
                  placeholder="e.g. High Risk of Early Blight"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea 
                  required
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2"
                  onChange={e => setNewAlert({...newAlert, message: e.target.value})}
                  placeholder="Provide actionable advice for farmers..."
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-agri-primary text-white font-medium rounded-lg hover:bg-agri-dark">Broadcast Alert</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
