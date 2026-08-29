/**
 * Lightweight agronomic profiles for the crops common in Maharashtra. Used to weight
 * outbreak risk by growth stage and to name the dominant threat in the risk reason.
 * These are broad, well-established windows — not a substitute for a full DSS, but
 * defensible domain knowledge for the pitch.
 */
export interface CropProfile {
  aliases: string[];
  /** Typical crop duration, days from sowing/transplant to harvest. */
  durationDays: number;
  /** Growth-stage window (days since sown) of peak disease/pest vulnerability. */
  peakVulnerability: { fromDay: number; toDay: number };
  /** Weather regime this crop's main threats favour. */
  favours: ('humid' | 'warm-wet' | 'dry-warm')[];
  /** Dominant disease/pest pressure, for the human-readable reason string. */
  mainThreats: string[];
}

const PROFILES: CropProfile[] = [
  {
    aliases: ['cotton', 'kapus', 'bt cotton'],
    durationDays: 180,
    peakVulnerability: { fromDay: 45, toDay: 120 },
    favours: ['humid', 'warm-wet'],
    mainThreats: ['pink bollworm', 'jassids', 'bacterial blight', 'grey mildew'],
  },
  {
    aliases: ['soybean', 'soya', 'soyabean'],
    durationDays: 100,
    peakVulnerability: { fromDay: 30, toDay: 75 },
    favours: ['humid', 'warm-wet'],
    mainThreats: ['girdle beetle', 'defoliators', 'rust', 'anthracnose'],
  },
  {
    aliases: ['pigeonpea', 'tur', 'arhar', 'red gram'],
    durationDays: 165,
    peakVulnerability: { fromDay: 60, toDay: 130 },
    favours: ['humid'],
    mainThreats: ['pod borer', 'wilt', 'sterility mosaic'],
  },
  {
    aliases: ['groundnut', 'peanut', 'moongphali', 'nilakadalai', 'verkadalai'],
    durationDays: 110,
    peakVulnerability: { fromDay: 35, toDay: 80 },
    favours: ['humid', 'warm-wet'],
    mainThreats: ['leaf miner', 'tikka leaf spot', 'aphids', 'collar rot'],
  },
  {
    aliases: ['wheat', 'gehu'],
    durationDays: 120,
    peakVulnerability: { fromDay: 40, toDay: 85 },
    favours: ['humid'],
    mainThreats: ['yellow rust', 'brown rust', 'powdery mildew', 'aphids'],
  },
  {
    aliases: ['rice', 'paddy', 'bhat'],
    durationDays: 125,
    peakVulnerability: { fromDay: 30, toDay: 80 },
    favours: ['humid', 'warm-wet'],
    mainThreats: ['blast', 'bacterial leaf blight', 'brown planthopper', 'stem borer'],
  },
  {
    aliases: ['sugarcane', 'us', 'ganna'],
    durationDays: 330,
    peakVulnerability: { fromDay: 60, toDay: 210 },
    favours: ['humid', 'warm-wet'],
    mainThreats: ['early shoot borer', 'woolly aphid', 'red rot', 'smut'],
  },
  {
    aliases: ['onion', 'kanda'],
    durationDays: 130,
    peakVulnerability: { fromDay: 40, toDay: 100 },
    favours: ['humid'],
    mainThreats: ['thrips', 'purple blotch', 'stemphylium blight'],
  },
  {
    aliases: ['tomato', 'tomato crop'],
    durationDays: 120,
    peakVulnerability: { fromDay: 25, toDay: 85 },
    favours: ['humid', 'warm-wet'],
    mainThreats: ['early blight', 'late blight', 'leaf curl virus', 'fruit borer'],
  },
  {
    aliases: ['potato', 'batata', 'aloo'],
    durationDays: 100,
    peakVulnerability: { fromDay: 30, toDay: 75 },
    favours: ['humid'],
    mainThreats: ['late blight', 'early blight', 'aphids'],
  },
  {
    aliases: ['chilli', 'chili', 'mirchi', 'capsicum'],
    durationDays: 150,
    peakVulnerability: { fromDay: 30, toDay: 110 },
    favours: ['humid', 'warm-wet'],
    mainThreats: ['thrips', 'mites', 'anthracnose', 'leaf curl'],
  },
  {
    aliases: ['grape', 'draksha', 'grapes'],
    durationDays: 150,
    peakVulnerability: { fromDay: 20, toDay: 100 },
    favours: ['humid'],
    mainThreats: ['downy mildew', 'powdery mildew', 'anthracnose'],
  },
  {
    aliases: ['maize', 'corn', 'makka'],
    durationDays: 110,
    peakVulnerability: { fromDay: 25, toDay: 70 },
    favours: ['warm-wet'],
    mainThreats: ['fall armyworm', 'turcicum leaf blight'],
  },
];

const GENERIC: CropProfile = {
  aliases: [],
  durationDays: 120,
  peakVulnerability: { fromDay: 30, toDay: 90 },
  favours: ['humid'],
  mainThreats: ['fungal leaf disease', 'sucking pests'],
};

export function cropProfile(crop: string | null | undefined): CropProfile {
  if (!crop) return GENERIC;
  const c = crop.trim().toLowerCase();
  return (
    PROFILES.find((p) => p.aliases.some((a) => c === a || c.includes(a) || a.includes(c))) ??
    GENERIC
  );
}
