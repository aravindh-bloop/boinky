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

export interface CropsList {
  known: string[];
  inRegion: string[];
}

export type AppStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'disbursed';

export interface SchemeApplication {
  id: string;
  status: AppStatus;
  farmer_note: string | null;
  officer_note: string | null;
  amount: number | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  scheme_id: string;
  scheme_title: string;
  benefit_amount: string | null;
  farmer_id: string;
  farmer_name: string;
  farmer_phone: string | null;
  region: string | null;
}

export interface SchemeSummary {
  byStatus: Record<string, number>;
  totalDisbursed: number;
  pendingReview: number;
  approvedNotDisbursed: number;
  openQueries: number;
  byScheme: { scheme_id: string; title: string; applications: number; disbursed: number; amount: number }[];
}

export interface SchemeThread {
  id: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  scheme_id: string | null;
  scheme_title: string | null;
  last_message_at: string;
  created_at: string;
  farmer_name: string;
  farmer_phone?: string | null;
  last_message: string | null;
  last_sender?: 'farmer' | 'official' | null;
}

export interface SchemeMessage {
  id: string;
  sender_role: 'farmer' | 'official';
  body: string;
  created_at: string;
}

export interface CalendarTemplateTask {
  offsetDays: number;
  task_type: string | null;
  title: string;
  description: string | null;
}
