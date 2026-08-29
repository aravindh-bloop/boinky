import { motion } from 'framer-motion';
import { MOCK_SCANS } from '../lib/mockData';
import type { Scan } from '../lib/mockData';
import { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export function ValidationQueue() {
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  const pendingScans = MOCK_SCANS.filter(s => s.status === 'pending');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-8 flex h-[calc(100vh-80px)]"
    >
      <div className={`flex-1 pr-4 ${selectedScan ? 'w-2/3 border-r' : 'w-full'}`}>
        <h2 className="text-2xl font-bold mb-6">Validation Queue</h2>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-sm font-medium text-slate-500">Scan</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-500">Diagnosis</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-500">Confidence</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-500">Severity</th>
                <th className="px-4 py-3 text-sm font-medium text-slate-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {pendingScans.map((scan, i) => (
                <motion.tr 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={scan.id} 
                  className={`border-b hover:bg-slate-50 cursor-pointer ${scan.confidence < 0.6 ? 'border-l-4 border-l-amber-500' : ''}`}
                  onClick={() => setSelectedScan(scan)}
                >
                  <td className="px-4 py-3">
                    <img src={scan.image_url} alt="scan" className="w-12 h-12 rounded object-cover" />
                  </td>
                  <td className="px-4 py-3 font-medium">{scan.diagnosis_label}</td>
                  <td className="px-4 py-3">
                    {scan.confidence < 0.6 && <AlertCircle size={14} className="inline text-amber-500 mr-1" />}
                    {(scan.confidence * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                      scan.severity === 'high' ? 'bg-red-100 text-red-700' : 
                      scan.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {scan.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{new Date(scan.created_at).toLocaleDateString()}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {pendingScans.length === 0 && (
            <div className="p-8 text-center text-slate-500">No pending scans in the queue!</div>
          )}
        </div>
      </div>

      {selectedScan && (
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-1/3 pl-6 flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Scan Details</h3>
            <button onClick={() => setSelectedScan(null)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          
          <img src={selectedScan.image_url} alt="scan detail" className="w-full h-48 object-cover rounded-xl mb-4" />
          
          <div className="space-y-4 flex-1">
            <div>
              <p className="text-sm text-slate-500 mb-1">AI Diagnosis</p>
              <div className="text-lg font-bold flex justify-between items-center">
                {selectedScan.diagnosis_label}
                <span className="text-sm font-normal px-2 py-1 bg-green-100 text-green-800 rounded">
                  {(selectedScan.confidence * 100).toFixed(0)}% Match
                </span>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-xl border">
              <p className="text-sm font-medium mb-2">Generated Advisory (Farmer will see this)</p>
              <p className="text-sm text-slate-600">{selectedScan.advisory_text}</p>
            </div>
          </div>
          
          <div className="mt-auto grid grid-cols-2 gap-3">
            <button className="py-3 px-4 bg-white border border-red-200 text-red-600 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-red-50">
              <XCircle size={18} /> Reject
            </button>
            <button className="py-3 px-4 bg-agri-primary text-white rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-agri-dark">
              <CheckCircle size={18} /> Confirm
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
