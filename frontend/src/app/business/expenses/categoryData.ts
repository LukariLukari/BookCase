export const categoryIcons = [
  'heart', 'utensils', 'house', 'users', 'wallet-cards', 'shopping-bag',
  'dumbbell', 'car', 'bus', 'plane', 'graduation-cap', 'briefcase-business',
  'gift', 'gamepad-2', 'music', 'film', 'coffee', 'paw-print', 'baby',
  'shirt', 'smartphone', 'wifi', 'pill', 'stethoscope', 'sparkles', 'leaf',
  'banknote', 'piggy-bank', 'landmark', 'chart-no-axes-combined', 'circle-ellipsis',
] as const;

export const categoryColors = [
  '#E65332', '#EF7C3B', '#F4B740', '#8FAF52', '#45A36D', '#2F9E9B',
  '#258BD2', '#5470C6', '#7657B5', '#B455A0', '#E15B84', '#7C6F64',
] as const;

export type CategoryIconName = typeof categoryIcons[number];

export type FinanceCategory = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: CategoryIconName;
  color: string;
};
