export const categoryIcons = [
  'heart', 'utensils', 'house', 'users', 'wallet-cards', 'shopping-bag',
  'dumbbell', 'car', 'bus', 'plane', 'graduation-cap', 'briefcase-business',
  'gift', 'gamepad-2', 'music', 'film', 'coffee', 'paw-print', 'baby',
  'shirt', 'smartphone', 'wifi', 'pill', 'stethoscope', 'sparkles', 'leaf',
  'banknote', 'piggy-bank', 'landmark', 'chart-no-axes-combined', 'circle-ellipsis',
  'apple', 'badge-dollar-sign', 'bath', 'beer', 'bike', 'book-open', 'building-2',
  'cake', 'camera', 'church', 'coins', 'cooking-pot', 'flower-2', 'fuel', 'glasses',
  'hand-heart', 'headphones', 'hospital', 'hotel', 'key-round', 'laptop', 'lightbulb',
  'map-pin', 'palette', 'party-popper', 'pizza', 'receipt', 'school', 'scissors',
  'shopping-cart', 'smile', 'sprout', 'ticket', 'train', 'trophy', 'wrench', 'zap',
] as const;

export const categoryColors = [
  '#7F1D1D', '#991B1B', '#B91C1C', '#DC2626', '#EF4444', '#F87171',
  '#9A3412', '#C2410C', '#EA580C', '#F97316', '#FB923C', '#FDBA74',
  '#854D0E', '#A16207', '#CA8A04', '#EAB308', '#FACC15', '#FDE047',
  '#365314', '#4D7C0F', '#65A30D', '#84CC16', '#8FAF52', '#BEF264',
  '#14532D', '#166534', '#15803D', '#16A34A', '#22C55E', '#4ADE80',
  '#134E4A', '#0F766E', '#0D9488', '#14B8A6', '#2DD4BF', '#5EEAD4',
  '#164E63', '#0E7490', '#0891B2', '#06B6D4', '#22D3EE', '#67E8F9',
  '#1E3A8A', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD',
  '#312E81', '#4338CA', '#4F46E5', '#6366F1', '#818CF8', '#A5B4FC',
  '#581C87', '#7E22CE', '#9333EA', '#A855F7', '#C084FC', '#D8B4FE',
  '#831843', '#BE185D', '#DB2777', '#EC4899', '#F472B6', '#F9A8D4',
  '#3F3F46', '#52525B', '#71717A', '#7C6F64', '#A1A1AA', '#D4D4D8',
] as const;

export type CategoryIconName = typeof categoryIcons[number];

export type FinanceCategory = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: CategoryIconName;
  color: string;
};
