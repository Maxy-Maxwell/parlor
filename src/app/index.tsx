import { MenuList } from '@/components/menu-list';

const MENU = [
  { href: '/solitaire' as const, label: 'Solitaire' },
  { href: '/stats' as const, label: 'Stats' },
];

export default function HomeScreen() {
  return <MenuList items={MENU} />;
}
