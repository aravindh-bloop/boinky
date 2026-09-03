/**
 * Onboarding tutorial content — the single English source. Titles and bodies are
 * run through the translation cache (`localizeMany`) before being served, so the
 * farmer hears and reads it in their own language. Bodies are written to be read
 * aloud: short sentences, spoken style, no jargon.
 */

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** Semantic icon name the app maps to a phosphor icon. */
  icon: string;
}

export type TutorialTopic = 'app' | 'pod';

const APP: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to AgriPod',
    body: 'AgriPod helps you keep your crops healthy. It checks your plants for disease, watches the weather for you, and tells you what to do each day. Let me show you around. Tap next, or press play to hear each step.',
    icon: 'leaf',
  },
  {
    id: 'home',
    title: 'Your daily brief',
    body: 'When you open the app, the first thing you see is today\'s brief. It reads your fields, the weather and your tasks, and tells you the most important thing to do today. Every point says why, using your own farm\'s numbers.',
    icon: 'insight',
  },
  {
    id: 'scan',
    title: 'Scan a sick plant',
    body: 'If a plant looks unwell, open Scan. The app guides you to photograph it from every side — the whole plant, a close-up of the problem, the underside of a leaf, the stem. More photos means a more certain answer. You can also speak, in your own language, and describe what you see.',
    icon: 'camera',
  },
  {
    id: 'result',
    title: 'The diagnosis and advice',
    body: 'In a few seconds you get the name of the problem, how serious it is, and clear steps to fix it — starting with the safe, low-cost ones. Before you spray anything, run the pesticide safety check so you do not leave residue at harvest.',
    icon: 'disease',
  },
  {
    id: 'weather',
    title: 'Weather and risk',
    body: 'AgriPod watches the forecast for your exact location. It warns you before heavy rain, a heat spell or a dry stretch, and it works out when disease pressure is building on your crop — often before you can see anything wrong.',
    icon: 'weather',
  },
  {
    id: 'calendar',
    title: 'Your crop calendar',
    body: 'Add your field with its sowing date and AgriPod builds a full calendar — when to irrigate, when to feed the crop, when to scout for pests, when to expect harvest. Tick each task off as you do it.',
    icon: 'calendar',
  },
  {
    id: 'alerts',
    title: 'Alerts from your area',
    body: 'The Alerts screen shows warnings from the farm office and outbreaks reported by other farmers near you. If a disease is spreading in your district, you will know early.',
    icon: 'alerts',
  },
  {
    id: 'benefits',
    title: 'Schemes and insurance',
    body: 'AgriPod lists the government schemes you are eligible for and lets you apply from your phone. If a storm or pest damages your crop, you can file a crop-insurance claim here with photos, and track it until the money comes.',
    icon: 'schemes',
  },
  {
    id: 'assistant',
    title: 'Ask AgriPod anything',
    body: 'Whenever you are unsure, open Ask AgriPod and type or speak your question. It knows your fields, your crops and your recent scans, and it answers in your language. It will never make up a number it does not have.',
    icon: 'ai',
  },
];

const POD: TutorialStep[] = [
  {
    id: 'what',
    title: 'What the AgriPod sensor does',
    body: 'The AgriPod sensor is a small box you push into the soil in your field. It measures how wet the soil is, its temperature, and how acid or alkaline it is, and sends the readings to this app every few minutes.',
    icon: 'stock',
  },
  {
    id: 'place',
    title: 'Where to place it',
    body: 'Choose a spot that represents most of the field — not the wettest corner, not right next to the channel. Push the probe fully into the soil near the root zone of the crop. Keep the top of the box above the ground.',
    icon: 'hotspot',
  },
  {
    id: 'power',
    title: 'Power it on',
    body: 'Switch the sensor on. A light will blink while it starts up. If it runs on a battery, make sure it is charged; if it has a small solar panel, face that toward the sky.',
    icon: 'lightning',
  },
  {
    id: 'pair',
    title: 'Pair it with the app',
    body: 'Open a field in AgriPod and choose Connect a sensor. The app gives you a short key. Enter that key into the sensor once, using the setup card that came with it. You only do this the first time.',
    icon: 'gear',
  },
  {
    id: 'firstreading',
    title: 'Wait for the first reading',
    body: 'Within a few minutes the field screen will show live soil moisture, temperature and pH, with a small green dot when the sensor is online. If nothing appears after ten minutes, check the sensor is powered and the key was entered correctly.',
    icon: 'check',
  },
  {
    id: 'daily',
    title: 'Using it day to day',
    body: 'Watch the soil-moisture line. When it drops toward the dry mark, it is time to irrigate — the app will also remind you. The readings feed into your daily brief and your risk score automatically.',
    icon: 'irrigate',
  },
];

export function tutorialSteps(topic: TutorialTopic): TutorialStep[] {
  return topic === 'pod' ? POD : APP;
}
