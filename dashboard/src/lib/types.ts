export interface Overview {
  region: string | null;
  scans: { total: number; last7d: number; needs_validation: number };
  byStatus: Record<string, number>;
  activeAlerts: number;
  topDiagnoses: { label: string | null; count: number; high: number }[];
  byCrop: { crop: string | null; count: number }[];
}

export interface QueueItem {
  id: string;
  field_id: string | null;
  farmer_id: string;
  image_url: string;
  diagnosis_label: string | null;
  diagnosis_category: string | null;
  confidence: number | null;
  severity: 'low' | 'medium' | 'high' | null;
  advisory_text: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  crop: string | null;
  created_at: string;
  farmer_name: string;
  farmer_phone: string | null;
}

export interface HotspotPoint {
  id: string;
  lat: number;
  lng: number;
  diagnosis_label: string | null;
  diagnosis_category: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  status: string;
  crop: string | null;
  created_at: string;
}

export interface HotspotSummary {
  diagnosis_label: string | null;
  count: number;
  high_count: number;
  last_seen: string;
}

export interface DirectoryFarmer {
  id: string;
  name: string;
  phone: string | null;
  region: string | null;
  preferred_language: string | null;
  created_at: string;
  field_count: number;
  scan_count: number;
  crops: string[];
}

export interface AlertRow {
  id: string;
  region: string | null;
  crop: string | null;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | null;
  created_at: string;
  official_name?: string | null;
}

export interface Trends {
  weekly: { week: string; category: string | null; count: number }[];
  byDiagnosis: { label: string | null; count: number; high: number }[];
}

export interface CalendarTemplateTask {
  offsetDays: number;
  task_type: string | null;
  title: string;
  description: string | null;
}
