import { motion } from 'framer-motion';
import type { CalendarTask } from '../lib/mockData';
import { useState } from 'react';
import { Calendar as CalendarIcon, Droplets, Bug, CheckCircle } from 'lucide-react';

const DAYS = Array.from({length: 30}, (_, i) => i + 1);

export function CropCalendar() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const getDayTasks = (day: number) => {
    // Dummy logic to map mock tasks to days for demo
    if (day === 5 || day === 12 || day === 18) {
      return [{
        id: `t${day}`,
        field_id: 'fd1',
        task_date: `2026-08-${day.toString().padStart(2, '0')}`,
        task_type: day === 5 ? 'spraying' : 'irrigation',
        title: day === 5 ? 'Fungicide Spraying' : 'Deep Irrigation',
        description: 'Required based on recent early blight detection.',
        source: 'scan-derived',
        is_done: false,
        created_at: ''
      } as CalendarTask];
    }
    return [];
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto flex"
    >
      <div className={`flex-1 pr-6 ${selectedDay ? 'border-r w-2/3' : 'w-full'}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2"><CalendarIcon /> August 2026</h2>
          <select className="border rounded-lg px-3 py-2 bg-white">
            <option>All Regions</option>
            <option>Nashik</option>
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="grid grid-cols-7 gap-2 text-center font-medium text-slate-500 mb-4 text-sm">
            <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {/* Empty days for offset */}
            <div className="aspect-square"></div>
            <div className="aspect-square"></div>
            {DAYS.map(day => {
              const tasks = getDayTasks(day);
              const hasTask = tasks.length > 0;
              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square border rounded-lg p-2 flex flex-col cursor-pointer transition-colors ${
                    selectedDay === day ? 'border-agri-primary bg-agri-light/30' : 'hover:border-slate-400'
                  }`}
                >
                  <span className={`text-sm font-medium ${selectedDay === day ? 'text-agri-primary' : 'text-slate-700'}`}>{day}</span>
                  <div className="mt-auto flex gap-1">
                    {hasTask && <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {selectedDay && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-1/3 pl-6"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Aug {selectedDay}, 2026</h3>
            <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          
          <div className="space-y-4">
            {getDayTasks(selectedDay).map(task => (
              <div key={task.id} className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 text-agri-primary font-medium">
                    {task.task_type === 'spraying' ? <Bug size={18} /> : <Droplets size={18} />}
                    {task.title}
                  </div>
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">Field: North Plot</span>
                </div>
                <p className="text-sm text-slate-600 mb-4">{task.description}</p>
                <button className="w-full py-2 border border-agri-primary text-agri-primary rounded-lg font-medium hover:bg-agri-primary hover:text-white transition-colors flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Mark as Complete
                </button>
              </div>
            ))}
            {getDayTasks(selectedDay).length === 0 && (
              <div className="text-center p-8 text-slate-500">No tasks scheduled for this day.</div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
