import {
  Baby, Banknote, BriefcaseBusiness, Bus, Car, ChartNoAxesCombined, CircleEllipsis,
  Coffee, Dumbbell, Film, Gamepad2, Gift, GraduationCap, Heart, House, Landmark,
  Leaf, Music, PawPrint, PiggyBank, Pill, Shirt, ShoppingBag, Smartphone, Sparkles,
  Stethoscope, Utensils, Users, WalletCards, Wifi, Plane,
} from 'lucide-react';
import type { CategoryIconName } from './categoryData';

const icons = {
  heart: Heart,
  utensils: Utensils,
  house: House,
  users: Users,
  'wallet-cards': WalletCards,
  'shopping-bag': ShoppingBag,
  dumbbell: Dumbbell,
  car: Car,
  bus: Bus,
  plane: Plane,
  'graduation-cap': GraduationCap,
  'briefcase-business': BriefcaseBusiness,
  gift: Gift,
  'gamepad-2': Gamepad2,
  music: Music,
  film: Film,
  coffee: Coffee,
  'paw-print': PawPrint,
  baby: Baby,
  shirt: Shirt,
  smartphone: Smartphone,
  wifi: Wifi,
  pill: Pill,
  stethoscope: Stethoscope,
  sparkles: Sparkles,
  leaf: Leaf,
  banknote: Banknote,
  'piggy-bank': PiggyBank,
  landmark: Landmark,
  'chart-no-axes-combined': ChartNoAxesCombined,
  'circle-ellipsis': CircleEllipsis,
} satisfies Record<CategoryIconName, typeof Heart>;

export default function FinanceCategoryIcon({ name, color, className = '' }: { name?: string; color?: string; className?: string }) {
  const Icon = icons[name as CategoryIconName] || CircleEllipsis;
  return <span className={`finance-category-icon ${className}`} style={{ backgroundColor: color || '#7C6F64' }}><Icon aria-hidden="true" /></span>;
}
