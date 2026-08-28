import { cropProfile } from '../risk/crop-profiles.js';

export type TaskType = 'irrigation' | 'spraying' | 'fertilizing' | 'scouting' | 'harvest' | 'other';

export interface GeneratedTask {
  offsetDays: number; // days after sowing
  taskType: TaskType;
  title: string;
  description: string;
}

/** Crop-specific extras layered on top of the generic phenology schedule. */
const CROP_EXTRAS: Record<string, GeneratedTask[]> = {
  cotton: [
    { offsetDays: 45, taskType: 'scouting', title: 'Install pheromone traps', description: 'Put up 5 pink bollworm pheromone traps per acre and check them twice a week.' },
    { offsetDays: 60, taskType: 'fertilizing', title: 'Top-dress nitrogen + potassium', description: 'Apply the second dose of N and K at squaring stage.' },
    { offsetDays: 90, taskType: 'scouting', title: 'Boll damage check', description: 'Open 20 green bolls across the field and check for pink bollworm larvae.' },
  ],
  soybean: [
    { offsetDays: 30, taskType: 'scouting', title: 'Girdle beetle & defoliator check', description: 'Look for ringed stems and leaf-eating caterpillars; treat if 2-3 larvae per metre row.' },
  ],
  rice: [
    { offsetDays: 21, taskType: 'other', title: 'Transplanting', description: 'Transplant 25-30 day old seedlings, 2-3 per hill.' },
    { offsetDays: 35, taskType: 'fertilizing', title: 'Top-dress nitrogen (tillering)', description: 'Apply nitrogen at active tillering and keep 2-3 cm water.' },
    { offsetDays: 55, taskType: 'scouting', title: 'Stem borer / leaf folder check', description: 'Check for dead hearts and folded leaves; use light traps at night.' },
  ],
  wheat: [
    { offsetDays: 21, taskType: 'irrigation', title: 'Crown root irrigation', description: 'The most critical irrigation for wheat - do not delay past 21-25 days.' },
    { offsetDays: 45, taskType: 'scouting', title: 'Yellow rust watch', description: 'Inspect lower leaves for yellow stripes, especially in cool humid weather.' },
  ],
  sugarcane: [
    { offsetDays: 45, taskType: 'other', title: 'Earthing up (partial)', description: 'Do partial earthing up and remove water shoots.' },
    { offsetDays: 60, taskType: 'scouting', title: 'Early shoot borer check', description: 'Look for dead hearts that pull out easily with a rotten-fish smell.' },
  ],
  onion: [
    { offsetDays: 40, taskType: 'scouting', title: 'Thrips check', description: 'Look for silvery streaks on leaves; thrips thrive in dry warm spells.' },
  ],
  tomato: [
    { offsetDays: 25, taskType: 'scouting', title: 'Leaf curl virus / whitefly check', description: 'Rogue out curled stunted plants; manage whitefly early.' },
  ],
  grape: [
    { offsetDays: 20, taskType: 'spraying', title: 'Downy mildew preventive spray', description: 'Begin protective sprays before rain; grape has a long pre-harvest interval so plan chemicals early.' },
  ],
};

/**
 * Rule-based crop calendar. Places standard operations proportionally along the
 * crop's duration (from crop-profiles) and layers on crop-specific extras. This is
 * a deterministic template — the "calendar", not the "management agent".
 */
export function generateTasks(crop: string, options: { rainfed?: boolean } = {}): GeneratedTask[] {
  const p = cropProfile(crop);
  const D = p.durationDays;
  const tasks: GeneratedTask[] = [];

  tasks.push({
    offsetDays: 0,
    taskType: 'other',
    title: 'Sowing complete — record the date',
    description: 'Confirm sowing/planting is done. Do gap filling within the first week.',
  });

  if (!options.rainfed) {
    tasks.push({
      offsetDays: 4,
      taskType: 'irrigation',
      title: 'First irrigation',
      description: 'Light irrigation to help establishment, if there has been no rain.',
    });
  }

  // Fertiliser top-dressings at ~18% and ~40% of duration
  tasks.push({
    offsetDays: Math.round(D * 0.18),
    taskType: 'fertilizing',
    title: 'First top-dressing of fertiliser',
    description: 'Apply the first split of nitrogen based on your soil test / state recommendation.',
  });
  tasks.push({
    offsetDays: Math.round(D * 0.4),
    taskType: 'fertilizing',
    title: 'Second top-dressing of fertiliser',
    description: 'Apply the second nitrogen split around peak vegetative growth.',
  });

  // Weekly scouting from day 14 to D-10
  for (let day = 14; day <= D - 10; day += 7) {
    const inPeak =
      day >= p.peakVulnerability.fromDay && day <= p.peakVulnerability.toDay;
    tasks.push({
      offsetDays: day,
      taskType: 'scouting',
      title: inPeak ? 'Scout the field (high-risk stage)' : 'Scout the field',
      description: inPeak
        ? `Walk a "W" path and inspect 20+ plants. This is the crop's vulnerable stage — watch for ${p.mainThreats.slice(0, 2).join(' and ')}. Use the app to scan anything suspicious.`
        : 'Walk a "W" path across the field and inspect 20+ plants for pests and disease. Scan anything unusual.',
    });
  }

  // Preventive spray suggestion at the start of the vulnerable window
  tasks.push({
    offsetDays: p.peakVulnerability.fromDay,
    taskType: 'spraying',
    title: 'Consider a preventive spray',
    description: `The vulnerable stage for ${crop} starts around now. If weather is favourable for disease, a protective (not curative) spray can help. Check the risk screen first.`,
  });

  // Pre-harvest interval reminder + expected harvest
  tasks.push({
    offsetDays: Math.max(D - 10, 0),
    taskType: 'spraying',
    title: 'Stop spraying soon — pre-harvest interval',
    description: 'From about now, stop using pesticides so residues fall below safe limits by harvest. Check each product\'s waiting period.',
  });
  tasks.push({
    offsetDays: D,
    taskType: 'harvest',
    title: 'Expected harvest window',
    description: 'Approximate harvest time based on typical crop duration. Adjust to actual maturity and weather.',
  });

  for (const extra of CROP_EXTRAS[p.aliases[0] ?? ''] ?? []) {
    tasks.push(extra);
  }

  return tasks.sort((a, b) => a.offsetDays - b.offsetDays);
}
