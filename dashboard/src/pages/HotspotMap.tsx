import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MOCK_SCANS } from '../lib/mockData';

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export function HotspotMap() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-[calc(100vh-80px)] flex flex-col"
    >
      <div className="p-4 bg-white border-b flex gap-4 items-center">
        <select className="border rounded-md px-3 py-1.5 text-sm">
          <option>All Crops</option>
          <option>Tomato</option>
          <option>Cotton</option>
        </select>
        <select className="border rounded-md px-3 py-1.5 text-sm">
          <option>All Severities</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <input type="date" className="border rounded-md px-3 py-1.5 text-sm" />
      </div>
      <div className="flex-1 relative z-0">
        <MapContainer center={[19.75, 75.71]} zoom={7} scrollWheelZoom={true} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {MOCK_SCANS.map(scan => (
            <Marker key={scan.id} position={[scan.location.lat, scan.location.lng]} icon={scan.severity === 'high' ? redIcon : undefined}>
              <Popup>
                <strong>{scan.diagnosis_label}</strong><br/>
                Confidence: {scan.confidence * 100}%
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </motion.div>
  );
}
