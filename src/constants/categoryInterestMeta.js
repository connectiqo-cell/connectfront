const MaterialIconsGlyphMap = require('react-native-vector-icons/glyphmaps/MaterialIcons.json');

/**
 * Presentation metadata for interest onboarding cards.
 * Icon names must be MaterialIcons glyph ids (hyphenated).
 */
export const CATEGORY_INTEREST_META = {
  technology: {
    icon: 'memory',
    description: 'Developers, AI, products & more',
  },
  software: {
    icon: 'code',
    description: 'Apps, systems & engineering',
  },
  'ai & machine learning': {
    icon: 'psychology',
    description: 'ML, AI products & research',
  },
  'data science': {
    icon: 'bar-chart',
    description: 'Analytics, data & insights',
  },
  cybersecurity: {
    icon: 'security',
    description: 'Security, privacy & defense',
  },
  cloud: {
    icon: 'cloud',
    description: 'Cloud, DevOps & infra',
  },
  business: {
    icon: 'business-center',
    description: 'Strategy, growth & leadership',
  },
  entrepreneurship: {
    icon: 'flight-takeoff',
    description: 'Startups, founders & scale',
  },
  'product management': {
    icon: 'dashboard',
    description: 'Roadmaps, discovery & delivery',
  },
  finance: {
    icon: 'account-balance',
    description: 'Money, markets & investing',
  },
  marketing: {
    icon: 'campaign',
    description: 'Growth, brands & campaigns',
  },
  'digital marketing': {
    icon: 'campaign',
    description: 'Growth, brands & campaigns',
  },
  'content creation': {
    icon: 'movie-filter',
    description: 'Creators, media & storytelling',
  },
  design: {
    icon: 'palette',
    description: 'UI, UX & visual systems',
  },
  photography: {
    icon: 'camera-alt',
    description: 'Photo, video & production',
  },
  'personal development': {
    icon: 'self-improvement',
    description: 'Mindset, habits & coaching',
  },
  health: {
    icon: 'favorite',
    description: 'Wellness, fitness & lifestyle',
  },
  education: {
    icon: 'school',
    description: 'Learning, teaching & mentoring',
  },
  legal: {
    icon: 'gavel',
    description: 'Law, compliance & contracts',
  },
  sales: {
    icon: 'point-of-sale',
    description: 'Closing, pipeline & outreach',
  },
  other: {
    icon: 'auto-awesome',
    description: 'Something else entirely',
  },
};

/** MaterialIcons expects hyphenated names: account_balance → account-balance */
export function normalizeMaterialIconName(icon = '') {
  return String(icon || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

/** Returns a glyph that exists in MaterialIcons, otherwise a safe fallback. */
export function resolveMaterialIconName(icon, fallback = 'category') {
  const name = normalizeMaterialIconName(icon);
  if (name && MaterialIconsGlyphMap[name] != null) return name;
  const safeFallback = normalizeMaterialIconName(fallback);
  if (safeFallback && MaterialIconsGlyphMap[safeFallback] != null) return safeFallback;
  return 'category';
}

export function getCategoryInterestMeta(categoryName = '', dbIcon) {
  const name = String(categoryName || '').trim();
  const lower = name.toLowerCase();

  let meta = CATEGORY_INTEREST_META[lower] || null;
  if (!meta) {
    for (const [key, value] of Object.entries(CATEGORY_INTEREST_META)) {
      if (lower.includes(key) || key.includes(lower)) {
        meta = value;
        break;
      }
    }
  }

  // Prefer curated icons so onboarding never shows "?" from bad DB icon names.
  return {
    icon: resolveMaterialIconName(meta?.icon || dbIcon, 'category'),
    description: meta?.description || 'Mentors in this space',
  };
}
