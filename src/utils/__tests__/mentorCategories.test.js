import {
  buildCategoryMatchOrFilter,
  mentorHasCategory,
  matchCategoryInterests,
  needsCategoryInterestOnboarding,
  normalizeCategoryBucket,
  orderCategoriesByInterests,
  quotePostgrestFilterValue,
} from '../mentorCategories';


describe('quotePostgrestFilterValue', () => {
  it('wraps values in double quotes', () => {
    expect(quotePostgrestFilterValue('Technology')).toBe('"Technology"');
  });

  it('escapes quotes inside values', () => {
    expect(quotePostgrestFilterValue('Say "hi"')).toBe('"Say \\"hi\\""');
  });
});

describe('buildCategoryMatchOrFilter', () => {
  it('returns null check for empty category', () => {
    expect(buildCategoryMatchOrFilter('')).toBe('category.is.null');
  });

  it('quotes patterns so commas are not OR separators', () => {
    const filter = buildCategoryMatchOrFilter('Technology');
    expect(filter).toBe(
      [
        'category.eq."Technology"',
        'category.ilike."Technology,%"',
        'category.ilike."%, Technology"',
        'category.ilike."%, Technology,%"',
      ].join(','),
    );
    // Unquoted `Technology,%` would split into two broken OR clauses.
    expect(filter).not.toMatch(/ilike\.Technology,%/);
  });

  it('handles categories with & and spaces', () => {
    const filter = buildCategoryMatchOrFilter('AI & Machine Learning');
    expect(filter).toContain('category.eq."AI & Machine Learning"');
    expect(filter).toContain('category.ilike."AI & Machine Learning,%"');
  });
});

describe('normalizeCategoryBucket', () => {
  it('merges Other / Others / empty into a single Other label', () => {
    expect(normalizeCategoryBucket('')).toBe('Other');
    expect(normalizeCategoryBucket('Others')).toBe('Other');
    expect(normalizeCategoryBucket('other')).toBe('Other');
    expect(normalizeCategoryBucket('Technology')).toBe('Technology');
  });
});

describe('mentorHasCategory', () => {
  it('matches multi-value category fields', () => {
    expect(mentorHasCategory('Technology, Design & UX', 'Technology')).toBe(true);
    expect(mentorHasCategory('Technology, Design & UX', 'Design & UX')).toBe(true);
    expect(mentorHasCategory('Technology, Design & UX', 'Business')).toBe(false);
  });

  it('treats empty and Others as Other', () => {
    expect(mentorHasCategory('', 'Other')).toBe(true);
    expect(mentorHasCategory(null, 'Others')).toBe(true);
    expect(mentorHasCategory('Others', 'Other')).toBe(true);
    expect(mentorHasCategory('Technology', 'Other')).toBe(false);
  });
});

describe('matchCategoryInterests', () => {
  const known = ['Technology', 'Business', 'Design & UX', 'Sales'];

  it('returns canonical names for matching interests', () => {
    expect(matchCategoryInterests(['technology', 'Sales', 'React'], known)).toEqual([
      'Technology',
      'Sales',
    ]);
  });

  it('needs onboarding when fewer than 5 matched categories', () => {
    expect(needsCategoryInterestOnboarding(['Technology', 'Business'], known)).toBe(true);
    expect(
      needsCategoryInterestOnboarding(
        ['Technology', 'Business', 'Design & UX', 'Sales'],
        known,
      ),
    ).toBe(true);
    expect(
      needsCategoryInterestOnboarding(
        ['Technology', 'Business', 'Design & UX', 'Sales', 'Technology'],
        [...known, 'Legal'],
      ),
    ).toBe(true);
    expect(
      needsCategoryInterestOnboarding(
        ['Technology', 'Business', 'Design & UX', 'Sales', 'Legal'],
        [...known, 'Legal'],
      ),
    ).toBe(false);
  });
});

describe('orderCategoriesByInterests', () => {
  it('puts interested categories first in selection order', () => {
    expect(
      orderCategoriesByInterests(
        ['Sales', 'Business', 'Technology', 'Legal'],
        ['Technology', 'Sales'],
      ),
    ).toEqual(['Technology', 'Sales', 'Business', 'Legal']);
  });
});
