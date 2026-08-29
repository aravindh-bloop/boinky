import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'src');

const dirs = [
  'components',
  'components/ui',
  'pages',
  'lib',
  'assets'
];

dirs.forEach(d => fs.mkdirSync(path.join(srcDir, d), { recursive: true }));

const mockData = `export type User = {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: "farmer" | "official";
  preferred_language: string;
  region: string;
  created_at: string;
};

export type Field = {
  id: string;
  farmer_id: string;
  name: string;
  crop: string;
  variety: string;
  sown_date: string;
  location: { lat: number; lng: number };
  area_acres: number;
  created_at: string;
};

export type Scan = {
  id: string;
  field_id: string;
  farmer_id: string;
  image_url: string;
  diagnosis_label: string;
  confidence: number;
  severity: "low" | "medium" | "high";
  advisory_text: string;
  advisory_language: string;
  status: "pending" | "validated" | "corrected" | "rejected";
  validated_by?: string;
  validated_at?: string;
  risk_score: number;
  location: { lat: number; lng: number };
  created_at: string;
};

export type RiskSnapshot = {
  id: string;
  field_id: string;
  date: string;
  temperature: number;
  humidity: number;
  rainfall_mm: number;
  risk_level: "low" | "medium" | "high";
  risk_reason: string;
  created_at: string;
};

export type Alert = {
  id: string;
  official_id: string;
  region: string;
  crop: string;
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  created_at: string;
};

export type CalendarTask = {
  id: string;
  field_id: string;
  task_date: string;
  task_type: "irrigation" | "spraying" | "fertilizing" | "scouting" | "harvest";
  title: string;
  description: string;
  source: "system" | "official" | "scan-derived";
  is_done: boolean;
  created_at: string;
};

export const MOCK_FARMERS: User[] = [
  { id: "f1", name: "Ramesh Patil", phone: "9876543210", email: "ramesh@example.com", role: "farmer", preferred_language: "mr", region: "Nashik", created_at: "2026-01-10T10:00:00Z" },
  { id: "f2", name: "Suresh Deshmukh", phone: "9876543211", email: "suresh@example.com", role: "farmer", preferred_language: "mr", region: "Pune", created_at: "2026-02-15T11:00:00Z" }
];

export const MOCK_FIELDS: Field[] = [
  { id: "fd1", farmer_id: "f1", name: "North Plot", crop: "Tomato", variety: "Hybrid", sown_date: "2026-06-01", location: { lat: 20.0, lng: 73.78 }, area_acres: 2.5, created_at: "2026-06-01T08:00:00Z" }
];

export const MOCK_SCANS: Scan[] = [
  { id: "s1", field_id: "fd1", farmer_id: "f1", image_url: "https://via.placeholder.com/150", diagnosis_label: "Early Blight", confidence: 0.85, severity: "high", advisory_text: "Spray fungicide immediately.", advisory_language: "en", status: "pending", risk_score: 80, location: { lat: 20.001, lng: 73.781 }, created_at: new Date().toISOString() }
];

export const MOCK_ALERTS: Alert[] = [];
export const MOCK_TASKS: CalendarTask[] = [];
`;

fs.writeFileSync(path.join(srcDir, 'lib', 'mockData.ts'), mockData);

const indexCss = \`@import "tailwindcss";

@theme {
  --color-agri-dark: #0d3a24;
  --color-agri-primary: #1b5e20;
  --color-agri-light: #e8f5e9;
  --color-agri-alert: #d32f2f;
  --color-agri-warn: #f57c00;
  --color-agri-info: #1976d2;
}

@custom-variant dark (&:is(.dark *));

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 142.1 76.2% 36.3%;
  --primary-foreground: 355.7 100% 97.3%;
  --secondary: 142.1 10% 90%;
  --secondary-foreground: 142.1 76.2% 36.3%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 142.1 76.2% 36.3%;
  --radius: 0.5rem;
}

body {
  @apply bg-slate-50 text-slate-900 font-sans;
}
\`;

fs.writeFileSync(path.join(srcDir, 'index.css'), indexCss);

console.log("Basic scaffold created.");
