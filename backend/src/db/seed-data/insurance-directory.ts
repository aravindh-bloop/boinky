/**
 * Escalation-contact directory for the PMFBY claim tracker.
 *
 * National / state rows are real and verified against public sources (dated
 * 2026-09-08). District rows are scaffolds: the *structure* (who the officer is,
 * which office, the district portal) is public and stable, but the individual
 * name and direct number must be confirmed — they are seeded `verified: false`
 * for an officer to fill in from the dashboard. We never invent a phone number.
 *
 * Sources: pmfby.gov.in/krph, pgportal.gov.in, cioins.co.in (Insurance Ombudsman
 * office list), tnagrisnet.tn.gov.in / india.gov.in agriculture directory, and
 * the individual district *.nic.in crop-insurance pages.
 */

export type DirRung = 'block' | 'district' | 'dgrc' | 'state' | 'ombudsman' | 'krph' | 'cpgrams';

export interface DirRow {
  district: string | null;
  rung: DirRung;
  designation: string;
  name?: string;
  office?: string;
  phone?: string;
  email?: string;
  url?: string;
  note?: string;
  verified: boolean;
  last_verified?: string; // ISO date
}

const VERIFIED = '2026-09-08';

// TN districts with a meaningful PMFBY footprint near the Chennai demo area.
const TN_DISTRICTS: { name: string; slug: string }[] = [
  { name: 'Tiruvallur', slug: 'tiruvallur' },
  { name: 'Chengalpattu', slug: 'chengalpattu' },
  { name: 'Kancheepuram', slug: 'kancheepuram' },
  { name: 'Cuddalore', slug: 'cuddalore' },
  { name: 'Villupuram', slug: 'villupuram' },
  { name: 'Thanjavur', slug: 'thanjavur' },
  { name: 'Thiruvarur', slug: 'thiruvarur' },
  { name: 'Nagapattinam', slug: 'nagapattinam' },
  { name: 'Ariyalur', slug: 'ariyalur' },
  { name: 'Tiruchirappalli', slug: 'tiruchirappalli' },
];

const NATIONAL: DirRow[] = [
  {
    district: null,
    rung: 'krph',
    designation: 'Krishi Rakshak Portal & Helpline',
    phone: '14447',
    url: 'https://pmfby.gov.in/krph/',
    note: 'The official single-window PMFBY grievance channel. Call 14447 (multilingual) or file online; you get a grievance ID to track.',
    verified: true,
    last_verified: VERIFIED,
  },
  {
    district: null,
    rung: 'cpgrams',
    designation: 'Centralised Public Grievance Redress & Monitoring System',
    url: 'https://pgportal.gov.in/',
    note: 'Central government grievance portal. A complaint here is routed to the Department of Agriculture & Farmers Welfare with a registration number.',
    verified: true,
    last_verified: VERIFIED,
  },
  {
    district: null,
    rung: 'ombudsman',
    designation: 'Insurance Ombudsman, Chennai',
    office: 'Fatima Akhtar Court, 4th Floor, 453, Anna Salai, Teynampet, Chennai 600018',
    phone: '044-24333668',
    email: 'oio.chennai@cioins.co.in',
    url: 'https://www.cioins.co.in/Ombudsman',
    note: 'Jurisdiction: Tamil Nadu, Puducherry town and Karaikal. Approach after the insurer’s Grievance Redressal Officer has not resolved it within 30 days. Independent of the government.',
    verified: true,
    last_verified: VERIFIED,
  },
  {
    district: null,
    rung: 'state',
    designation: 'Directorate of Agriculture & Farmers’ Welfare, Tamil Nadu',
    office: 'Chepauk, Chennai 600005',
    phone: '044-28524894',
    email: 'diragri@tn.nic.in',
    url: 'https://www.tnagrisnet.tn.gov.in/',
    note: 'State nodal department for PMFBY and the State Grievance Redressal Committee. Crop insurance is handled by the Additional Director of Agriculture (044-28544730).',
    verified: true,
    last_verified: VERIFIED,
  },
];

function districtRows(name: string, slug: string): DirRow[] {
  const url = `https://${slug}.nic.in/`;
  return [
    {
      district: name,
      rung: 'block',
      designation: `Block Agricultural Officer, ${name}`,
      office: 'Your revenue block’s Agriculture Office',
      note: 'First point of contact. The Agricultural Officer for your block co-signs the joint loss survey and can chase a missing surveyor.',
      verified: false,
    },
    {
      district: name,
      rung: 'district',
      designation: `Joint Director of Agriculture, ${name}`,
      office: `Office of the Joint Director of Agriculture, ${name}`,
      url,
      note: 'The district PMFBY nodal officer and member-secretary of the District Grievance Redressal Committee. Confirm the current officer and direct number with the district agriculture office.',
      verified: false,
    },
    {
      district: name,
      rung: 'dgrc',
      designation: `District Grievance Redressal Committee, ${name}`,
      office: `Office of the District Collector, ${name}`,
      url,
      note: 'Chaired by the District Collector; the Joint Director of Agriculture is member-secretary; the lead bank officer and the insurer’s district manager are members. File through the Collectorate or the Joint Director.',
      verified: false,
    },
  ];
}

export const INSURANCE_DIRECTORY: DirRow[] = [
  ...NATIONAL,
  ...TN_DISTRICTS.flatMap((d) => districtRows(d.name, d.slug)),
];
