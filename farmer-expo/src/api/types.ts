export type Role = 'farmer' | 'official';

export interface User {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  preferred_language: string;
  region: string | null;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Field {
  id: string;
  farmer_id: string;
  name: string | null;
  crop: string;
  variety: string | null;
  sown_date: string | null;
  lat: number | null;
  lng: number | null;
  area_acres: number | null;
  created_at: string;
  days_since_sown: number | null;
}

export type ScanStatus =
  | 'pending'
  | 'auto_confirmed'
  | 'needs_validation'
  | 'validated'
  | 'corrected'
  | 'rejected';

export interface Scan {
  id: string;
  field_id: string | null;
  image_url: string;
  diagnosis_label: string | null;
  diagnosis_category: string | null;
  affected_part: string | null;
  confidence: number | null;
  severity: string | null;
  advisory_text: string | null;
  advisory_language: string | null;
  status: ScanStatus;
  validation_note: string | null;
  risk_score: number | null;
  lat: number | null;
  lng: number | null;
  farmer_note: string | null;
  farmer_note_language: string | null;
  created_at: string;
}

export interface RiskSnapshot {
  date: string;
  temperature: number | null;
  humidity: number | null;
  rainfall_mm: number | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  risk_score: number | null;
  risk_reason: string | null;
}

export interface OutlookDay {
  date: string;
  isForecast: boolean;
  score: number;
  level: 'low' | 'medium' | 'high';
  reason: string;
  tempMeanC: number | null;
  humidityMeanPct: number | null;
  rainfallMm: number | null;
}

export interface FieldRisk {
  fieldId: string;
  crop: string;
  today: RiskSnapshot;
  outlook: OutlookDay[];
}

export type AlertSource = 'office' | 'weather' | 'forewarning' | 'outbreak';

export type ReasonKind = 'humidity' | 'weather' | 'stage' | 'pest' | 'history' | 'score';

export interface AlertReason {
  kind: ReasonKind;
  text: string;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  region?: string | null;
  crop?: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  created_at: string;
  match_reason?: string | null;
  official_name?: string | null;
  /** present on the farmer feed — which detector produced this alert */
  source?: AlertSource;
  field_id?: string | null;
  /** computed alerts: the evidence behind the flag */
  reasons?: AlertReason[];
  /** forewarning only: 0-100 risk score */
  score?: number;
}

export interface CalendarTask {
  id: string;
  field_id: string;
  task_date: string;
  task_type: string | null;
  title: string;
  description: string | null;
  source: string;
  is_done: boolean;
}

export interface Scheme {
  id: string;
  title: string;
  description: string | null;
  benefit_amount: string | null;
  apply_link: string | null;
  relevant?: boolean;
  match_reasons?: string[];
}

export type SchemeAppStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed';

export interface SchemeApplication {
  id: string;
  scheme_id: string;
  scheme_title: string;
  status: SchemeAppStatus;
  farmer_note: string | null;
  officer_note: string | null;
  amount: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchemeThreadSummary {
  id: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  scheme_id: string | null;
  scheme_title: string | null;
  last_message: string | null;
  last_message_at: string;
}

export interface SchemeThreadDetail {
  thread: {
    id: string;
    subject: string;
    status: 'open' | 'answered' | 'closed';
    scheme_title: string | null;
    created_at: string;
  };
  messages: { id: string; sender_role: 'farmer' | 'official'; body: string; created_at: string }[];
}

export interface InventoryItem {
  id: string;
  item_name: string;
  item_type: string | null;
  quantity: number | null;
  unit: string | null;
  low_stock_at: number | null;
  expiry_date: string | null;
  low_stock: boolean;
  expired: boolean;
  expiring_soon: boolean;
}

export interface SafetyReport {
  crop: string | null;
  expectedHarvestDate: string | null;
  daysToHarvest: number | null;
  overall: 'safe' | 'caution' | 'unsafe' | 'unknown';
  items: {
    input: string;
    matched: string;
    phiDays: number | null;
    source: string;
    verdict: 'safe' | 'caution' | 'unsafe' | 'unknown';
    note: string;
  }[];
  disclaimer: string;
}

// ── Hardware pod ──

export interface PodReading {
  id: string;
  field_id: string;
  temperature: number | null;
  soil_moisture: number | null;
  soil_ph: number | null;
  air_humidity: number | null;
  battery_pct: number | null;
  created_at: string;
}

export interface PodDevice {
  id: string;
  field_id: string;
  field_name: string | null;
  label: string;
  last_seen_at: string | null;
  online: boolean;
  created_at: string;
}

export interface PodHealth {
  state: 'healthy' | 'attention' | 'offline' | 'no_device';
  message: string;
  notes: string[];
}

export interface PodLatest {
  device: PodDevice | null;
  reading: PodReading | null;
  history: PodReading[];
  health: PodHealth;
}

export interface NearbyOutbreaks {
  radiusKm: number;
  days: number;
  count: number;
  nearestKm: number | null;
  topDiagnoses: { label: string | null; count: number }[];
}

// ── Weather ──

export interface CurrentWeather {
  time: string;
  tempC: number | null;
  feelsLikeC: number | null;
  humidityPct: number | null;
  windKph: number | null;
  windDir: number | null;
  precipMm: number | null;
  cloudPct: number | null;
  isDay: boolean;
  code: number | null;
  condition: string;
}

export interface HourPoint {
  time: string;
  tempC: number | null;
  precipMm: number | null;
  precipProbPct: number | null;
  windKph: number | null;
  code: number | null;
  condition: string;
  isDay: boolean;
}

export interface DayPoint {
  date: string;
  tempMinC: number | null;
  tempMaxC: number | null;
  precipMm: number | null;
  precipProbPct: number | null;
  windMaxKph: number | null;
  uvMax: number | null;
  sunrise: string | null;
  sunset: string | null;
  code: number | null;
  condition: string;
}

export interface AgroAdvisory {
  key: string;
  severity: 'info' | 'watch' | 'warning';
  title: string;
  detail: string;
}

export interface Weather {
  place: { lat: number; lng: number; label: string | null };
  current: CurrentWeather;
  hourly: HourPoint[];
  daily: DayPoint[];
  advisories: AgroAdvisory[];
  sprayWindow: { start: string; end: string; hours: number } | null;
}

// ── Farm management ──

export interface Activity {
  id: string;
  field_id: string | null;
  field_name: string | null;
  kind: string;
  title: string;
  note: string | null;
  input_name: string | null;
  quantity: number | null;
  unit: string | null;
  cost: number | null;
  activity_date: string;
  created_at: string;
}

export interface Expense {
  id: string;
  field_id: string | null;
  field_name: string | null;
  category: string;
  description: string | null;
  amount: number;
  spent_on: string;
  created_at: string;
}

export interface Harvest {
  id: string;
  field_id: string | null;
  field_name: string | null;
  harvested_on: string;
  crop: string | null;
  quantity: number;
  unit: string;
  unit_price: number | null;
  revenue: number | null;
  buyer: string | null;
  note: string | null;
}

export interface FinanceSummary {
  since: string;
  totalSpent: number;
  totalRevenue: number;
  net: number;
  byCategory: { category: string; amount: number }[];
  byField: { fieldId: string | null; fieldName: string | null; spent: number; revenue: number }[];
  harvestQty: { unit: string; quantity: number }[];
}

export interface AggTask {
  id: string;
  field_id: string;
  field_name: string | null;
  crop: string | null;
  task_date: string;
  task_type: string | null;
  title: string;
  description: string | null;
  source: string;
  is_done: boolean;
}

export interface TasksResponse {
  today: AggTask[];
  overdue: AggTask[];
  upcoming: AggTask[];
  counts: { today: number; overdue: number; upcoming: number };
}

// ── Home dashboard ──

export interface HomeData {
  user: { name: string; region: string | null; language: string };
  fieldCount: number;
  weather: {
    place: string | null;
    current: CurrentWeather;
    today: DayPoint | null;
    topAdvisory: AgroAdvisory | null;
    advisoryCount: number;
    sprayWindow: { start: string; end: string; hours: number } | null;
  } | null;
  tasks: { today: AggTask[]; overdueCount: number; upcomingCount: number };
  alerts: { count: number; latest: Alert[] };
  nearbyOutbreaks: NearbyOutbreaks | null;
  fieldRisk: {
    id: string;
    name: string;
    crop: string;
    daysSinceSown: number | null;
    hasLocation: boolean;
    riskLevel: 'low' | 'medium' | 'high' | null;
    riskScore: number | null;
  }[];
  highestRisk: HomeData['fieldRisk'][number] | null;
  recentScans: {
    id: string;
    diagnosis_label: string | null;
    severity: string | null;
    status: string;
    image_url: string;
    created_at: string;
  }[];
  lowStockCount: number;
  finance: { spent: number; revenue: number; net: number } | null;
}

// ── AI daily brief (GET /api/insights/daily) ──

export type InsightUrgency = 'critical' | 'action' | 'watch' | 'info';
export type InsightCategory =
  | 'disease'
  | 'weather'
  | 'task'
  | 'risk'
  | 'outbreak'
  | 'stock'
  | 'finance'
  | 'general';
export type InsightAction =
  | 'open_field'
  | 'open_tasks'
  | 'open_weather'
  | 'open_scan'
  | 'open_stock'
  | 'open_alerts'
  | 'open_schemes'
  | 'none';

export interface InsightCard {
  title: string;
  body: string;
  urgency: InsightUrgency;
  category: InsightCategory;
  /** Always a real field of this farmer's, or null. Verified server-side. */
  fieldName: string | null;
  action: InsightAction;
  actionLabel: string | null;
  /** The specific fact this card rests on — shown behind "Why this?". */
  basis: string;
}

export interface DailyBrief {
  status: 'ready' | 'generating' | 'unavailable';
  reason?: 'no_fields' | 'ai_unavailable';
  forDate?: string;
  headline?: string;
  cards?: InsightCard[];
  language?: string;
  generatedAt?: string;
  /** A newer brief is being generated; what you see is the previous one. */
  stale?: boolean;
}
