import { Platform, Share, Clipboard } from 'react-native';

/** Production web portal (same host as ShareProfileModal in production). */
export const MENTOR_SHARE_WEB_ORIGIN = 'https://app.connectiqo.com';
export const MENTOR_SHARE_APP_PREFIX = 'connectiqo://';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMentorShareUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function mentorShareSlug(username, mentorId) {
  const handle = typeof username === 'string' ? username.trim() : '';
  if (handle) return handle;
  return mentorId ? String(mentorId).trim() : '';
}

export function buildMentorShareUrls(username, mentorId) {
  // Match web: ROUTES.mentorProfile(username || mentorId) → /mentor/<slug>
  const slug = mentorShareSlug(username, mentorId);
  if (!slug) return { app: '', web: '', slug: '' };
  const path = `mentor/${slug}`;
  return {
    slug,
    app: `${MENTOR_SHARE_APP_PREFIX}${path}`,
    web: `${MENTOR_SHARE_WEB_ORIGIN}/${path}`,
  };
}

/**
 * Extract mentor UUID/username from a shared QR/deeplink payload.
 * Accepts https://app.connectiqo.com/mentor/x, connectiqo.com, connectiqo://, or bare slug.
 */
export function parseMentorShareIdentifier(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const linkMatch = text.match(
    /(?:connectiqo:\/\/|https?:\/\/(?:www\.|app\.)?connectiqo\.com\/?)mentor\/([^/?#\s]+)/i,
  );
  if (linkMatch?.[1]) {
    try {
      return decodeURIComponent(linkMatch[1]).trim() || null;
    } catch {
      return linkMatch[1].trim() || null;
    }
  }

  const pathMatch = text.match(/(?:^|\/)mentor\/([^/?#\s]+)/i);
  if (pathMatch?.[1]) {
    try {
      return decodeURIComponent(pathMatch[1]).trim() || null;
    } catch {
      return pathMatch[1].trim() || null;
    }
  }

  if (/^[a-zA-Z0-9._-]{2,64}$/.test(text) || isMentorShareUuid(text)) {
    return text;
  }

  return null;
}

/**
 * Prefer https so QR/link works outside the app (camera scan, WhatsApp, etc.).
 * In-app scanner still parses https and opens MentorProfile.
 */
export function getMentorShareLink(username, mentorId) {
  const { app, web } = buildMentorShareUrls(username, mentorId);
  return web || app || '';
}

export async function copyMentorShareUrl(url) {
  if (!url) return false;
  try {
    Clipboard.setString(url);
    return true;
  } catch {
    return false;
  }
}

/** Share text + https profile link. */
export async function shareMentorProfile({ name, username, mentorId }) {
  const displayName = (name && String(name).trim()) || 'this creator';
  const url = getMentorShareLink(username, mentorId);
  if (!url) return;

  const title = `${displayName} on Connectiqo`;
  const message = `Check out ${displayName}'s profile on Connectiqo\n${url}`;
  await Share.share(
    Platform.select({
      ios: { title, url, message },
      default: { title, message },
    }),
  );
}

/**
 * Share the QR card image (WhatsApp / Instagram / etc.) plus the profile link.
 * @param {{ name?: string, username?: string|null, mentorId?: string, imageUri: string }} opts
 *   imageUri — file:// path or data:image/png;base64,... from view-shot
 */
export async function shareMentorQrImage({ name, username, mentorId, imageUri }) {
  const displayName = (name && String(name).trim()) || 'this creator';
  const url = getMentorShareLink(username, mentorId);
  if (!imageUri) {
    await shareMentorProfile({ name: displayName, username, mentorId });
    return;
  }

  const title = `${displayName} on Connectiqo`;
  const message = url
    ? `Scan this QR or open ${displayName}'s profile on Connectiqo\n${url}`
    : `Scan this QR to open ${displayName}'s profile on Connectiqo`;

  const normalizedUri = imageUri.startsWith('data:') || imageUri.startsWith('file:')
    ? imageUri
    : `file://${imageUri}`;

  try {
    const RNShare = require('react-native-share').default;
    await RNShare.open({
      title,
      message,
      url: normalizedUri,
      type: 'image/png',
      failOnCancel: false,
    });
  } catch (err) {
    // User cancelled, or share lib unavailable — fall back to link share.
    if (err?.message === 'User did not share') return;
    await shareMentorProfile({ name: displayName, username, mentorId });
  }
}
