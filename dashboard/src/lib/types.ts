export interface Overview {
  region: string | null;
  scans: { total: number; last7d: number; needs_validation: number };
  byStatus: Record<string, number>;
  activeAlerts: number;
  topDiagnoses: { label: string | null; count: number; high: number }[];
  byCrop: { crop: string | null; count: number }[];
  byDistrict: { district: string; count: number; high: number }[];
}

export interface DistrictRow {
  district: string;
  scans: number;
  needs_validation: number;
  high_severity: number;
  farmers: number;
  fields: number;
  top_diagnosis: string | null;
  last_activity: string | null;
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
  district: string | null;
}

export interface ScanMedia {
  id: string;
  kind: string;
  url: string;
  resource: 'image' | 'video';
  duration_s: number | null;
  position: number;
}

export interface OfficerScanDetail {
  id: string;
  image_url: string;
  diagnosis_label: string | null;
  diagnosis_category: string | null;
  affected_part: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  confidence: number | null;
  status: string;
  advisory_text: string | null;
  validation_note: string | null;
  image_quality: 'good' | 'partial' | 'poor' | null;
  coverage_gaps: string[] | null;
  farmer_note: string | null;
  farmer_note_language: string | null;
  risk_score: number | null;
  district: string | null;
  location_accuracy_m: number | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  submitted_at: string | null;
  farmer_name: string;
  farmer_phone: string | null;
  region: string | null;
  crop: string | null;
  variety: string | null;
  field_name: string | null;
  media: ScanMedia[];
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

// ── crop insurance ──
export type ClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'surveyor_assigned'
  | 'approved'
  | 'rejected'
  | 'paid';

export interface InsuranceClaimRow {
  id: string;
  cause: string;
  status: ClaimStatus;
  incident_date: string | null;
  estimated_loss_pct: number | null;
  assessed_loss_pct: number | null;
  approved_amount: number | null;
  district: string | null;
  has_assessment: boolean;
  crop: string;
  season: string;
  sum_insured: number | null;
  farmer_id: string;
  farmer_name: string;
  farmer_phone: string | null;
  region: string | null;
  media_count: number;
  submitted_at: string | null;
  updated_at: string;
}

export interface ClaimAssessment {
  causePlausible: 'consistent' | 'partly_consistent' | 'inconsistent' | 'unclear';
  estimatedLossPct: number | null;
  cropVisible: string | null;
  rationale: string;
  notes: string[];
}

export interface InsuranceClaimDetail {
  claim: {
    id: string;
    cause: string;
    status: ClaimStatus;
    description: string | null;
    incident_date: string | null;
    estimated_loss_pct: number | null;
    assessed_loss_pct: number | null;
    approved_amount: number | null;
    officer_note: string | null;
    ai_assessment: ClaimAssessment | null;
    crop: string;
    season: string;
    sum_insured: number | null;
    premium_paid: number | null;
    field_name: string | null;
    scheme_title: string | null;
    scan_diagnosis: string | null;
    farmer_name: string;
    farmer_phone: string | null;
    region: string | null;
    district: string | null;
    submitted_at: string | null;
    created_at: string;
  };
  media: { id: string; kind: 'photo' | 'video'; url: string; caption: string | null; lat: number | null; lng: number | null }[];
  events: {
    id: string;
    actor_role: 'farmer' | 'official' | 'system';
    kind: string;
    from_status: string | null;
    to_status: string | null;
    body: string | null;
    created_at: string;
  }[];
}

export interface InsuranceSummary {
  byStatus: Record<string, number>;
  byCause: { cause: string; n: number }[];
  totalPaid: number;
  activePolicies: number;
  sumInsured: number;
  pendingReview: number;
  approvedNotPaid: number;
}
