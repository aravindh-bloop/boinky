import { motion } from 'framer-motion';
import { MOCK_FARMERS, MOCK_FIELDS } from '../lib/mockData';
import { useState, Fragment } from 'react';
import { Search, ChevronDown, ChevronRight, Phone } from 'lucide-react';

export function FarmersFields() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');

  const filteredFarmers = MOCK_FARMERS.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const toggleRow = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-[calc(100vh-80px)] overflow-auto"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Farmers & Fields</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search farmers..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg bg-white w-full"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3 text-sm font-medium text-slate-500">Name</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-500">Region</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-500">Contact</th>
              <th className="px-4 py-3 text-sm font-medium text-slate-500">Fields Count</th>
            </tr>
          </thead>
          <tbody>
            {filteredFarmers.map(farmer => {
              const isExpanded = expanded[farmer.id];
              const fields = MOCK_FIELDS.filter(f => f.farmer_id === farmer.id);
              
              return (
                <Fragment key={farmer.id}>
                  <tr className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => toggleRow(farmer.id)}>
                    <td className="px-4 py-3 text-slate-400">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </td>
                    <td className="px-4 py-3 font-medium">{farmer.name}</td>
                    <td className="px-4 py-3">{farmer.region}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                      <Phone size={14} /> {farmer.phone}
                    </td>
                    <td className="px-4 py-3">{fields.length} Fields</td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-50 border-b">
                      <td colSpan={5} className="px-10 py-4">
                        <div className="bg-white border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100/50">
                              <tr>
                                <th className="px-4 py-2 font-medium text-slate-500">Field Name</th>
                                <th className="px-4 py-2 font-medium text-slate-500">Crop</th>
                                <th className="px-4 py-2 font-medium text-slate-500">Variety</th>
                                <th className="px-4 py-2 font-medium text-slate-500">Area (Acres)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fields.map(field => (
                                <tr key={field.id} className="border-t">
                                  <td className="px-4 py-2">{field.name}</td>
                                  <td className="px-4 py-2">{field.crop}</td>
                                  <td className="px-4 py-2">{field.variety}</td>
                                  <td className="px-4 py-2">{field.area_acres}</td>
                                </tr>
                              ))}
                              {fields.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-4 text-center text-slate-500">No fields registered.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
