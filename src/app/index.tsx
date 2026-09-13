import { MenuList } from '@/components/menu-list';

const MENU = [
  { href: '/solitaire' as const, number: '1', label: 'Solitaire' },
  { href: '/stats' as const, number: '2', label: 'Stats' },
];

export default function HomeScreen() {
  return <MenuList items={MENU} />;
}
