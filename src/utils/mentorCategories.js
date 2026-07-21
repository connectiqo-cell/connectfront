const CATEGORY_DELIMITER = ', ';
export const OTHER_CATEGORY_LABEL = 'Other';

/** Parse stored mentor category field (single or comma-separated) into a unique list. */
export function parseMentorCategories(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(c => String(c).trim()).filter(Boolean))];
  }
  return [...new Set(String(raw).split(',').map(c => c.trim()).filter(Boolean))];
}

/** True for empty / Other / Others-style labels. */
export function isOtherCategoryLabel(name) {
  const lower = String(name || '').trim().toLowerCase();
  return !lower || lower === 'other' || lower === 'others';
}

/**
 * Canonical Discover bucket label.
 * Merges empty categories and Other/Others into a single "Other" section.
 */
export function normalizeCategoryBucket(name) {
  const trimmed = String(name || '').trim();
  if (isOtherCategoryLabel(trimmed)) return OTHER_CATEGORY_LABEL;
  return trimmed;
}

/** Serialize selected categories for mentor_profiles.category storage. */
export function serializeMentorCategories(categories) {
  return parseMentorCategories(categories).join(CATEGORY_DELIMITER);
}

/** Whether a mentor's stored category field includes the given category name. */
export function mentorHasCategory(rawCategory, categoryName) {
  const target = String(categoryName || '').trim().toLowerCase();
  if (!target) return false;

  const parsed = parseMentorCategories(rawCategory);
  if (isOtherCategoryLabel(categoryName)) {
    return parsed.length === 0 || parsed.some(c => isOtherCategoryLabel(c));
  }

  return parsed.some(c => c.toLowerCase() === target);
}

/** Toggle a category in a multi-select list. */
export function toggleMentorCategory(selected, categoryName) {
  const cat = String(categoryName || '').trim();
  if (!cat) return parseMentorCategories(selected);
  const list = parseMentorCategories(selected);
  const lower = cat.toLowerCase();
  const exists = list.some(c => c.toLowerCase() === lower);
  if (exists) return list.filter(c => c.toLowerCase() !== lower);
  return [...list, cat];
}

/**
 * Quote a PostgREST filter value so commas / reserved chars don't break `.or()`.
 * @see https://postgrest.org/en/stable/references/api/tables_views.html#operators
 */
export function quotePostgrestFilterValue(value) {
  const escaped = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** PostgREST .or() filter for mentors that include a category (single or multi-value field). */
export function buildCategoryMatchOrFilter(categoryName) {
  const cat = String(categoryName || '').trim();
  if (!cat) return 'category.is.null';

  if (isOtherCategoryLabel(cat)) {
    // Prefer simple equality / null checks. Avoid empty-string eq which can
    // break PostgREST `.or()` parsing in some clients.
    return [
      'category.is.null',
      `category.eq.${quotePostgrestFilterValue('Other')}`,
      `category.eq.${quotePostgrestFilterValue('Others')}`,
      `category.ilike.${quotePostgrestFilterValue('other')}`,
      `category.ilike.${quotePostgrestFilterValue('others')}`,
    ].join(',');
  }

  // Patterns contain commas; they MUST be quoted or PostgREST treats them as OR separators.
  return [
    `category.eq.${quotePostgrestFilterValue(cat)}`,
    `category.ilike.${quotePostgrestFilterValue(`${cat},%`)}`,
    `category.ilike.${quotePostgrestFilterValue(`%, ${cat}`)}`,
    `category.ilike.${quotePostgrestFilterValue(`%, ${cat},%`)}`,
  ].join(',');
}

/** Short label for category picker summary. */
export function formatSelectedCategoriesLabel(categories, maxShown = 2) {
  const list = parseMentorCategories(categories);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length <= maxShown) return list.join(', ');
  return `${list.slice(0, maxShown).join(', ')} +${list.length - maxShown}`;
}

const MIN_LEARNER_INTERESTS = 5;
const MAX_LEARNER_INTERESTS = 5;

export { MIN_LEARNER_INTERESTS, MAX_LEARNER_INTERESTS };

/** Interests that match known mentor category names (case-insensitive). */
export function matchCategoryInterests(interests, knownCategories = []) {
  const knownByLower = new Map(
    (knownCategories || [])
      .map(c => String(c).trim())
      .filter(Boolean)
      .map(c => [c.toLowerCase(), c]),
  );
  if (!knownByLower.size) return [];

  const seen = new Set();
  const matched = [];
  for (const raw of parseMentorCategories(interests)) {
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    const canonical = knownByLower.get(key);
    if (!canonical) continue;
    seen.add(key);
    matched.push(canonical);
  }
  return matched;
}

/** True when the learner still needs first-run category interest selection. */
export function needsCategoryInterestOnboarding(interests, knownCategories = []) {
  return matchCategoryInterests(interests, knownCategories).length < MIN_LEARNER_INTERESTS;
}

/**
 * Order category names so selected interests come first (selection order),
 * then remaining categories alphabetically.
 */
export function orderCategoriesByInterests(categories, interests) {
  const list = [...(categories || [])];
  if (!list.length) return [];

  const interestOrder = parseMentorCategories(interests).map(c => c.toLowerCase());
  if (!interestOrder.length) return list.sort((a, b) => a.localeCompare(b));

  const rank = new Map(interestOrder.map((key, i) => [key, i]));
  return list.sort((a, b) => {
    const ra = rank.has(a.toLowerCase()) ? rank.get(a.toLowerCase()) : Number.POSITIVE_INFINITY;
    const rb = rank.has(b.toLowerCase()) ? rank.get(b.toLowerCase()) : Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}
