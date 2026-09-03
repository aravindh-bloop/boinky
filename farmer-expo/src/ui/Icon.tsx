import React from 'react';
// type-only: erased at compile, does not pull the barrel into the bundle
import type { Icon as PhIcon, IconWeight } from 'phosphor-react-native';
// Deep per-icon imports. Importing from the 'phosphor-react-native' barrel pulls
// ALL ~1500 icons into the bundle (Metro doesn't tree-shake); this keeps only
// the ~60 we use — several MB smaller.
import { ArrowRightIcon } from 'phosphor-react-native/src/icons/ArrowRight';
import { BankIcon } from 'phosphor-react-native/src/icons/Bank';
import { BasketIcon } from 'phosphor-react-native/src/icons/Basket';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { BroomIcon } from 'phosphor-react-native/src/icons/Broom';
import { BugIcon } from 'phosphor-react-native/src/icons/Bug';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CalendarCheckIcon } from 'phosphor-react-native/src/icons/CalendarCheck';
import { ArrowsCounterClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowsCounterClockwise';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { VideoCameraIcon } from 'phosphor-react-native/src/icons/VideoCamera';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp';
import { ChartBarIcon } from 'phosphor-react-native/src/icons/ChartBar';
import { ChartLineUpIcon } from 'phosphor-react-native/src/icons/ChartLineUp';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CircleIcon } from 'phosphor-react-native/src/icons/Circle';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { CloudIcon } from 'phosphor-react-native/src/icons/Cloud';
import { CloudFogIcon } from 'phosphor-react-native/src/icons/CloudFog';
import { CloudLightningIcon } from 'phosphor-react-native/src/icons/CloudLightning';
import { CloudRainIcon } from 'phosphor-react-native/src/icons/CloudRain';
import { CloudSunIcon } from 'phosphor-react-native/src/icons/CloudSun';
import { CurrencyInrIcon } from 'phosphor-react-native/src/icons/CurrencyInr';
import { DropIcon } from 'phosphor-react-native/src/icons/Drop';
import { DropHalfIcon } from 'phosphor-react-native/src/icons/DropHalf';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { FireIcon } from 'phosphor-react-native/src/icons/Fire';
import { FirstAidIcon } from 'phosphor-react-native/src/icons/FirstAid';
import { FlaskIcon } from 'phosphor-react-native/src/icons/Flask';
import { GearIcon } from 'phosphor-react-native/src/icons/Gear';
import { HandCoinsIcon } from 'phosphor-react-native/src/icons/HandCoins';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { LeafIcon } from 'phosphor-react-native/src/icons/Leaf';
import { LightbulbIcon } from 'phosphor-react-native/src/icons/Lightbulb';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { ListChecksIcon } from 'phosphor-react-native/src/icons/ListChecks';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MicrophoneIcon } from 'phosphor-react-native/src/icons/Microphone';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { MoneyIcon } from 'phosphor-react-native/src/icons/Money';
import { PackageIcon } from 'phosphor-react-native/src/icons/Package';
import { PathIcon } from 'phosphor-react-native/src/icons/Path';
import { PlantIcon } from 'phosphor-react-native/src/icons/Plant';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { ScrollIcon } from 'phosphor-react-native/src/icons/Scroll';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { SnowflakeIcon } from 'phosphor-react-native/src/icons/Snowflake';
import { StopCircleIcon } from 'phosphor-react-native/src/icons/StopCircle';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { StorefrontIcon } from 'phosphor-react-native/src/icons/Storefront';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { SunDimIcon } from 'phosphor-react-native/src/icons/SunDim';
import { SunHorizonIcon } from 'phosphor-react-native/src/icons/SunHorizon';
import { ThermometerIcon } from 'phosphor-react-native/src/icons/Thermometer';
import { TractorIcon } from 'phosphor-react-native/src/icons/Tractor';
import { TrendDownIcon } from 'phosphor-react-native/src/icons/TrendDown';
import { TrendUpIcon } from 'phosphor-react-native/src/icons/TrendUp';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { UmbrellaIcon } from 'phosphor-react-native/src/icons/Umbrella';
import { UserCircleIcon } from 'phosphor-react-native/src/icons/UserCircle';
import { WalletIcon } from 'phosphor-react-native/src/icons/Wallet';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { WindIcon } from 'phosphor-react-native/src/icons/Wind';
import { XIcon } from 'phosphor-react-native/src/icons/X';
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

  mic: MicrophoneIcon,
  camera: CameraIcon,
  video: VideoCameraIcon,
  retry: ArrowsCounterClockwiseIcon,
  stop: StopCircleIcon,
  ai: SparkleIcon,
  insight: LightbulbIcon,
  up: CaretUpIcon,
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
