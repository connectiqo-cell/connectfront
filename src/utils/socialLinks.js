/**
 * Mentor social profile helpers — normalize URLs and build display rows.
 */

const SOCIAL_PLATFORMS = [
  {
    key: 'youtube',
    label: 'YouTube',
    icon: 'youtube',
    color: '#FF0000',
    urlKey: 'youtube_url',
    hosts: ['youtube.com', 'youtu.be', 'www.youtube.com', 'm.youtube.com'],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'instagram',
    color: '#E4405F',
    urlKey: 'instagram_url',
    hosts: ['instagram.com', 'www.instagram.com'],
  },
  {
    key: 'x',
    label: 'X',
    icon: 'twitter',
    color: '#1D9BF0',
    urlKey: 'x_url',
    hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: 'linkedin',
    color: '#0A66C2',
    urlKey: 'linkedin_url',
    hosts: ['linkedin.com', 'www.linkedin.com'],
  },
];

/** Ensure a string is a usable https URL, or return empty. */
export function normalizeSocialUrl(raw) {
  if (raw == null) return '';
  let value = String(raw).trim();
  if (!value) return '';
  // Strip accidental whitespace / trailing punctuation
  value = value.replace(/[.,;]+$/, '');
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, '')}`;
  }
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

/** Platforms that have a saved URL on a mentor profile row. */
export function getMentorSocialLinks(mentor) {
  if (!mentor) return [];
  return SOCIAL_PLATFORMS.map(p => {
    const url = normalizeSocialUrl(mentor[p.urlKey]);
    if (!url) return null;
    return { ...p, url };
  }).filter(Boolean);
}

export { SOCIAL_PLATFORMS };
