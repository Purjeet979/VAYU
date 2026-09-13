export interface CityTheme {
  name: string;
  hex: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  cardBorder: string;
  glow: string;
}

export const NCR_CITIES = [
  'Delhi',
  'Gurugram',
  'Noida',
  'Ghaziabad',
  'Faridabad',
  'Greater Noida',
] as const;

export const CITY_THEMES: Record<string, CityTheme> = {
  'Delhi': {
    name: 'Delhi',
    hex: '#00f0ff', // Vibrant Cyan
    badgeBg: 'bg-cyan-500/15',
    badgeText: 'text-cyan-500 dark:text-cyan-400',
    badgeBorder: 'border-cyan-500/30',
    cardBorder: 'hover:border-cyan-500/50',
    glow: 'rgba(0, 240, 255, 0.25)',
  },
  'Gurugram': {
    name: 'Gurugram',
    hex: '#a855f7', // Purple
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-600 dark:text-purple-400',
    badgeBorder: 'border-purple-500/30',
    cardBorder: 'hover:border-purple-500/50',
    glow: 'rgba(168, 85, 247, 0.25)',
  },
  'Noida': {
    name: 'Noida',
    hex: '#3b82f6', // Electric Blue
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-600 dark:text-blue-400',
    badgeBorder: 'border-blue-500/30',
    cardBorder: 'hover:border-blue-500/50',
    glow: 'rgba(59, 130, 246, 0.25)',
  },
  'Ghaziabad': {
    name: 'Ghaziabad',
    hex: '#f97316', // Sunset Orange
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-600 dark:text-orange-400',
    badgeBorder: 'border-orange-500/30',
    cardBorder: 'hover:border-orange-500/50',
    glow: 'rgba(249, 115, 22, 0.25)',
  },
  'Faridabad': {
    name: 'Faridabad',
    hex: '#10b981', // Emerald Green
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    cardBorder: 'hover:border-emerald-500/50',
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  'Greater Noida': {
    name: 'Greater Noida',
    hex: '#ec4899', // Rose Pink
    badgeBg: 'bg-pink-500/15',
    badgeText: 'text-pink-600 dark:text-pink-400',
    badgeBorder: 'border-pink-500/30',
    cardBorder: 'hover:border-pink-500/50',
    glow: 'rgba(236, 72, 153, 0.25)',
  },
};

export function getCityTheme(city: string): CityTheme {
  return CITY_THEMES[city] || {
    name: city,
    hex: '#94a3b8',
    badgeBg: 'bg-gray-500/15',
    badgeText: 'text-gray-600 dark:text-gray-400',
    badgeBorder: 'border-gray-500/30',
    cardBorder: 'hover:border-gray-500/40',
    glow: 'rgba(148, 163, 184, 0.2)',
  };
}
