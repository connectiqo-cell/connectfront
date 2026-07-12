const CATEGORY_DELIMITER = ', ';

/** Parse stored mentor category field (single or comma-separated) into a unique list. */
export function parseMentorCategories(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map(c => String(c).trim()).filter(Boolean))];
  }
  return [...new Set(String(raw).split(',').map(c => c.trim()).filter(Boolean))];
}

/** Serialize selected categories for mentor_profiles.category storage. */
export function serializeMentorCategories(categories) {
  return parseMentorCategories(categories).join(CATEGORY_DELIMITER);
}

/** Whether a mentor's stored category field includes the given category name. */
export function mentorHasCategory(rawCategory, categoryName) {
  const target = String(categoryName || '').trim().toLowerCase();
  if (!target) return false;
  return parseMentorCategories(rawCategory).some(c => c.toLowerCase() === target);
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

/** PostgREST .or() filter for mentors that include a category (single or multi-value field). */
export function buildCategoryMatchOrFilter(categoryName) {
  const cat = String(categoryName || '').trim();
  if (!cat) return 'category.is.null';
  return [
    `category.eq.${cat}`,
    `category.ilike.${cat},%`,
    `category.ilike.%, ${cat}`,
    `category.ilike.%, ${cat},%`,
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
