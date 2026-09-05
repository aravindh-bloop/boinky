/**
 * Curated catalogue of real central- and Maharashtra-government agriculture schemes.
 * Benefit amounts and apply links are indicative (as of 2025-26) and MUST be verified
 * against the official portal before any real-world use. `eligibility_criteria` is a
 * loose JSON matcher consumed by schemes.service.ts.
 */
export interface SchemeSeed {
  title: string;
  description: string;
  eligibility_criteria: Record<string, unknown>;
  benefit_amount: string;
  apply_link: string;
  /** 'subsidy' (default) | 'insurance' | 'credit' */
  kind?: 'subsidy' | 'insurance' | 'credit';
}

export const SCHEMES: SchemeSeed[] = [
  {
    title: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    description:
      'Income support of Rs 6,000 per year in three equal instalments to all landholding farmer families, credited directly to the bank account.',
    eligibility_criteria: { country: 'India', landholder: true },
    benefit_amount: 'Rs 6,000 / year (3 x Rs 2,000)',
    apply_link: 'https://pmkisan.gov.in',
  },
  {
    title: 'Namo Shetkari Mahasamman Nidhi Yojana',
    description:
      'Maharashtra state top-up to PM-KISAN. Eligible PM-KISAN beneficiaries in Maharashtra get an additional Rs 6,000 per year, effectively doubling the central benefit.',
    eligibility_criteria: { state: 'Maharashtra', requires: 'PM-KISAN enrolment' },
    benefit_amount: 'Rs 6,000 / year (state) + Rs 6,000 (centre)',
    apply_link: 'https://nsmny.mahait.org',
  },
  {
    title: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    description:
      'Crop insurance against natural calamities, pests and diseases. Farmer premium capped at 2% for kharif food/oilseed crops, 1.5% for rabi, and 5% for commercial/horticultural crops.',
    eligibility_criteria: { country: 'India', has_crop: true },
    benefit_amount: 'Sum insured = scale of finance; low farmer premium',
    apply_link: 'https://pmfby.gov.in',
    kind: 'insurance',
  },
  {
    title: 'Restructured Weather Based Crop Insurance Scheme (RWBCIS)',
    description:
      'Insurance that pays out on adverse weather — deficit or excess rainfall, high or low temperature, humidity — measured at a reference weather station, without a field survey. Available for notified crops in notified areas.',
    eligibility_criteria: { country: 'India', has_crop: true },
    benefit_amount: 'Payout by weather index vs the notified term sheet',
    apply_link: 'https://pmfby.gov.in',
    kind: 'insurance',
  },
  {
    title: 'Tamil Nadu State Crop Insurance Top-up',
    description:
      'State supplement to PMFBY for Tamil Nadu farmers — covers a share of the farmer premium for notified crops including paddy, groundnut and sugarcane, and speeds up claim settlement for localised calamities.',
    eligibility_criteria: { state: 'Tamil Nadu', has_crop: true },
    benefit_amount: 'Farmer premium share borne by the state',
    apply_link: 'https://www.tn.gov.in/scheme/data_view/6811',
    kind: 'insurance',
  },
  {
    title: 'Kisan Credit Card (KCC)',
    description:
      'Short-term crop loans up to Rs 3 lakh at a subsidised effective interest rate of 4% per year with timely repayment. Also covers post-harvest and consumption needs.',
    eligibility_criteria: { country: 'India', landholder: true },
    benefit_amount: 'Up to Rs 3 lakh at 4% effective interest',
    apply_link: 'https://www.myscheme.gov.in/schemes/kcc',
    kind: 'credit',
  },
  {
    title: 'Dr. Panjabrao Deshmukh Vyaj Sanwlat Yojana (Interest Subvention)',
    description:
      'Maharashtra scheme giving 0% effective interest on crop loans up to Rs 3 lakh for farmers who repay on time, over and above the central interest subvention.',
    eligibility_criteria: { state: 'Maharashtra', requires: 'timely loan repayment' },
    benefit_amount: '0% interest on crop loans up to Rs 3 lakh',
    apply_link: 'https://krishi.maharashtra.gov.in',
    kind: 'credit',
  },
  {
    title: 'Pradhan Mantri Krishi Sinchayee Yojana - Per Drop More Crop (Micro Irrigation)',
    description:
      'Subsidy on drip and sprinkler irrigation systems. Small and marginal farmers get 55% subsidy, other farmers 45%, on the indicative unit cost.',
    eligibility_criteria: { country: 'India', purpose: 'micro-irrigation' },
    benefit_amount: '45-55% subsidy on drip / sprinkler systems',
    apply_link: 'https://pmksy.gov.in',
  },
  {
    title: 'Sub-Mission on Agricultural Mechanization (SMAM)',
    description:
      'Financial assistance of 40-50% for buying tractors, power tillers, self-propelled machinery, and for setting up Custom Hiring Centres and Farm Machinery Banks.',
    eligibility_criteria: { country: 'India', purpose: 'farm equipment' },
    benefit_amount: '40-50% subsidy on farm machinery',
    apply_link: 'https://agrimachinery.nic.in',
  },
  {
    title: 'Paramparagat Krishi Vikas Yojana (PKVY) - Organic Farming',
    description:
      'Support for cluster-based organic farming: Rs 31,000 per hectare over 3 years for inputs, certification and marketing, plus training and PGS certification.',
    eligibility_criteria: { country: 'India', practice: 'organic' },
    benefit_amount: 'Rs 31,000 / hectare over 3 years',
    apply_link: 'https://darpan.nic.in/pkvy',
  },
  {
    title: 'Soil Health Card Scheme',
    description:
      'Free soil testing every 2 years with a card showing nutrient status and crop-wise fertiliser and amendment recommendations for your field.',
    eligibility_criteria: { country: 'India', landholder: true },
    benefit_amount: 'Free soil testing + recommendations',
    apply_link: 'https://soilhealth.dac.gov.in',
  },
  {
    title: 'Nanaji Deshmukh Krishi Sanjivani Prakalp (PoCRA)',
    description:
      'Climate-resilient agriculture project for rain-fed and salinity-affected districts of Maharashtra (Vidarbha, Marathwada). Support for protected cultivation, farm ponds, sprinklers, and FPO development.',
    eligibility_criteria: {
      state: 'Maharashtra',
      districts: [
        'Amravati',
        'Akola',
        'Buldhana',
        'Washim',
        'Yavatmal',
        'Wardha',
        'Nagpur',
        'Jalna',
        'Aurangabad',
        'Beed',
        'Latur',
        'Osmanabad',
        'Nanded',
        'Parbhani',
        'Hingoli',
      ],
    },
    benefit_amount: 'Up to 65% subsidy on climate-resilient interventions',
    apply_link: 'https://dbt.mahapocra.gov.in',
  },
  {
    title: 'Gopinath Munde Shetkari Apghat Suraksha Sanugrah Anudan Yojana',
    description:
      'Maharashtra accident cover for farmers: Rs 2 lakh to the family on accidental death or permanent disability, Rs 1 lakh for partial disability. Premium paid by the state.',
    eligibility_criteria: { state: 'Maharashtra', age_min: 10, age_max: 75 },
    benefit_amount: 'Rs 1-2 lakh accident compensation',
    apply_link: 'https://krishi.maharashtra.gov.in',
  },
  {
    title: 'Dr. Babasaheb Ambedkar Krishi Swavalamban Yojana',
    description:
      'Irrigation support for Scheduled Caste and Navbaudha farmers in Maharashtra: subsidy for new wells, old well repair, farm ponds, pump sets, and drip/sprinkler sets.',
    eligibility_criteria: { state: 'Maharashtra', category: ['SC', 'Navbaudha'] },
    benefit_amount: 'Up to Rs 2.5 lakh for a new well',
    apply_link: 'https://mahadbt.maharashtra.gov.in',
  },
  {
    title: 'Birsa Munda Krishi Kranti Yojana',
    description:
      'Irrigation and land-development support for Scheduled Tribe farmers in Maharashtra: new wells, well repair, farm ponds, electric/diesel pump sets and micro-irrigation.',
    eligibility_criteria: { state: 'Maharashtra', category: ['ST'] },
    benefit_amount: 'Up to Rs 2.5 lakh for a new well',
    apply_link: 'https://mahadbt.maharashtra.gov.in',
  },
  {
    title: 'National Food Security Mission (NFSM)',
    description:
      'Assistance for certified seed, seed minikits, INM/IPM inputs, farm machinery and cluster demonstrations for pulses, wheat, rice, coarse cereals, nutri-cereals, oilseeds and cotton.',
    eligibility_criteria: {
      country: 'India',
      crop: ['pulses', 'tur', 'gram', 'wheat', 'rice', 'maize', 'cotton', 'soybean', 'groundnut'],
    },
    benefit_amount: 'Input subsidy + free minikits + demo support',
    apply_link: 'https://nfsm.gov.in',
  },
  {
    title: 'National Mission on Edible Oils - Oilseeds (NMEO-OS)',
    description:
      'Support to raise oilseed production: subsidised certified seed of soybean, groundnut, sunflower and sesame, seed hubs, and cluster demonstrations.',
    eligibility_criteria: {
      country: 'India',
      crop: ['soybean', 'groundnut', 'sunflower', 'sesame', 'mustard', 'oilseeds'],
    },
    benefit_amount: 'Subsidised seed + demonstration support',
    apply_link: 'https://nmeo.dac.gov.in',
  },
  {
    title: 'Agriculture Infrastructure Fund (AIF)',
    description:
      'Medium/long-term debt financing for post-harvest management and community farming assets - warehouses, cold stores, grading units, primary processing - with 3% interest subvention on loans up to Rs 2 crore.',
    eligibility_criteria: { country: 'India', purpose: 'post-harvest infrastructure' },
    benefit_amount: '3% interest subvention; credit guarantee',
    apply_link: 'https://agriinfra.dac.gov.in',
  },
  {
    title: 'e-NAM (National Agriculture Market)',
    description:
      'Online trading platform linking APMC mandis across India so farmers can discover better prices and sell to buyers beyond their local mandi.',
    eligibility_criteria: { country: 'India' },
    benefit_amount: 'Wider market access; transparent price discovery',
    apply_link: 'https://enam.gov.in',
  },
  {
    title: 'PM Kisan Maandhan Yojana (Farmer Pension)',
    description:
      'Voluntary contributory pension for small and marginal farmers aged 18-40. A monthly contribution (matched by the government) secures a pension of Rs 3,000 per month after age 60.',
    eligibility_criteria: { country: 'India', age_min: 18, age_max: 40, landholding_max_ha: 2 },
    benefit_amount: 'Rs 3,000 / month pension after age 60',
    apply_link: 'https://maandhan.in',
  },
  {
    title: 'Mahatma Jyotirao Phule Shetkari Karjmukti Yojana',
    description:
      'Maharashtra crop-loan relief scheme: waiver / incentive for farmers with outstanding or regularly repaid short-term crop loans within the notified limit and period.',
    eligibility_criteria: { state: 'Maharashtra', requires: 'eligible crop loan account' },
    benefit_amount: 'Loan waiver up to Rs 2 lakh / incentive up to Rs 50,000',
    apply_link: 'https://krishi.maharashtra.gov.in',
  },
  {
    title: 'MahaDBT Farmer Schemes Portal',
    description:
      'Single "Aaple Sarkar" DBT window to apply for most Maharashtra agriculture subsidies - seeds, machinery, horticulture, irrigation, godowns - with a lottery-based selection.',
    eligibility_criteria: { state: 'Maharashtra' },
    benefit_amount: 'Varies by component',
    apply_link: 'https://mahadbt.maharashtra.gov.in/farmer',
  },
];
