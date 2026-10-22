export const categoryIconGroups = [
  {
    label: 'Tiền bạc & tài chính',
    icons: ['banknote', 'coins', 'wallet-cards', 'credit-card', 'piggy-bank', 'landmark', 'vault', 'hand-coins', 'circle-dollar-sign', 'badge-dollar-sign', 'badge-cent', 'badge-euro', 'badge-pound-sterling', 'badge-japanese-yen', 'bitcoin', 'percent', 'calculator', 'chart-no-axes-combined', 'trending-up', 'trending-down', 'receipt'] as const,
  },
  {
    label: 'Ăn uống & mua sắm',
    icons: ['utensils', 'cooking-pot', 'coffee', 'pizza', 'apple', 'beer', 'shopping-bag', 'shopping-cart', 'shirt', 'gift', 'cake'] as const,
  },
  {
    label: 'Gia đình & đời sống',
    icons: ['house', 'users', 'heart', 'hand-heart', 'baby', 'paw-print', 'bath', 'key-round', 'flower-2', 'sprout', 'leaf', 'sparkles'] as const,
  },
  {
    label: 'Đi lại & du lịch',
    icons: ['car', 'bus', 'bike', 'train', 'plane', 'fuel', 'map-pin', 'hotel', 'ticket'] as const,
  },
  {
    label: 'Công việc & học tập',
    icons: ['briefcase-business', 'building-2', 'laptop', 'smartphone', 'wifi', 'book-open', 'graduation-cap', 'school', 'lightbulb', 'wrench'] as const,
  },
  {
    label: 'Sức khỏe & giải trí',
    icons: ['dumbbell', 'stethoscope', 'hospital', 'pill', 'glasses', 'scissors', 'music', 'headphones', 'film', 'camera', 'palette', 'gamepad-2', 'party-popper', 'trophy', 'smile', 'church', 'zap', 'circle-ellipsis'] as const,
  },
] as const;

export const categoryIcons = categoryIconGroups.flatMap(group => [...group.icons]);

// A compact set of calm theme-friendly pastels. Any other colour remains available
// through the custom colour control in the category editor.
export const categoryColors = [
  '#FFB4A2', '#FFC6A5', '#FFD6A5', '#FDE68A', '#FFF1A8', '#D9ED92',
  '#B7E4C7', '#A7F3D0', '#99E2E2', '#A5F3FC', '#A8DADC', '#BFDBFE',
  '#C7D2FE', '#D8B4FE', '#E9D5FF', '#F5C2E7', '#FBCFE8', '#E7D8C9',
] as const;

export type CategoryIconName = typeof categoryIconGroups[number]['icons'][number];

export type FinanceCategory = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: CategoryIconName;
  color: string;
  usageCount?: number;
};
