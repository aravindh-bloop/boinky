import React from 'react';
import {
  ArrowRightIcon,
  BankIcon,
  BasketIcon,
  BellIcon,
  BroomIcon,
  BugIcon,
  CalendarBlankIcon,
  CalendarCheckIcon,
  CameraIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  CloudIcon,
  CloudFogIcon,
  CloudLightningIcon,
  CloudRainIcon,
  CloudSunIcon,
  CurrencyInrIcon,
  DropIcon,
  DropHalfIcon,
  EyeIcon,
  FireIcon,
  FirstAidIcon,
  FlaskIcon,
  GearIcon,
  HandCoinsIcon,
  HouseIcon,
  LeafIcon,
  LightningIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MoneyIcon,
  PackageIcon,
  PathIcon,
  PlantIcon,
  PlusIcon,
  ScrollIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SnowflakeIcon,
  SparkleIcon,
  StorefrontIcon,
  SunIcon,
  SunDimIcon,
  SunHorizonIcon,
  ThermometerIcon,
  TractorIcon,
  TrendDownIcon,
  TrendUpIcon,
  TrashIcon,
  UmbrellaIcon,
  UserCircleIcon,
  WalletIcon,
  WarningIcon,
  WarningCircleIcon,
  WindIcon,
  XIcon,
  type Icon as PhIcon,
  type IconWeight,
} from 'phosphor-react-native';
import { palette } from './tokens';

const MAP = {
  home: HouseIcon,
  fields: PlantIcon,
  scan: CameraIcon,
  schemes: BankIcon,
  stock: PackageIcon,

  weather: CloudSunIcon,
  tasks: ListChecksIcon,
  calendar: CalendarBlankIcon,
  taskDone: CalendarCheckIcon,
  activity: PathIcon,
  alerts: BellIcon,
  hotspot: MapPinIcon,
  harvest: BasketIcon,
  expense: WalletIcon,
  money: CurrencyInrIcon,
  revenue: HandCoinsIcon,
  market: StorefrontIcon,
  tractor: TractorIcon,

  leaf: LeafIcon,
  bug: BugIcon,
  disease: FirstAidIcon,
  spray: FlaskIcon,
  irrigate: DropIcon,
  fertilize: SparkleIcon,
  weeding: BroomIcon,
  scout: EyeIcon,
  shield: ShieldCheckIcon,

  sun: SunIcon,
  sunDim: SunDimIcon,
  cloud: CloudIcon,
  cloudSun: CloudSunIcon,
  cloudRain: CloudRainIcon,
  cloudFog: CloudFogIcon,
  storm: CloudLightningIcon,
  lightning: LightningIcon,
  wind: WindIcon,
  snow: SnowflakeIcon,
  umbrella: UmbrellaIcon,
  thermometer: ThermometerIcon,
  sunrise: SunHorizonIcon,
  humidity: DropHalfIcon,

  right: CaretRightIcon,
  left: CaretLeftIcon,
  arrowRight: ArrowRightIcon,
  plus: PlusIcon,
  close: XIcon,
  trash: TrashIcon,
  check: CheckCircleIcon,
  circle: CircleIcon,
  clock: ClockIcon,
  warning: WarningIcon,
  warningCircle: WarningCircleIcon,
  search: MagnifyingGlassIcon,
  gear: GearIcon,
  signOut: SignOutIcon,
  user: UserCircleIcon,
  trendUp: TrendUpIcon,
  trendDown: TrendDownIcon,
  chart: ChartBarIcon,
  chartLine: ChartLineUpIcon,
  scroll: ScrollIcon,
  fire: FireIcon,
  money2: MoneyIcon,
} satisfies Record<string, PhIcon>;

export type IconName = keyof typeof MAP;

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
}

export function Icon({ name, size = 22, color = palette.text, weight = 'regular' }: Props) {
  const Cmp = MAP[name];
  return <Cmp size={size} color={color} weight={weight} />;
}

/** WMO weather-code → icon name. */
export function weatherIcon(code: number | null | undefined, isDay = true): IconName {
  if (code == null) return 'cloud';
  if (code <= 1) return isDay ? 'sun' : 'sunDim';
  if (code === 2) return 'cloudSun';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'cloudFog';
  if (code >= 51 && code <= 67) return 'cloudRain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'cloudRain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloud';
}
