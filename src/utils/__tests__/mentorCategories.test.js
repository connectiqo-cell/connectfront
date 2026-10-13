import {
  buildCategoryMatchOrFilter,
  mentorHasCategory,
  matchCategoryInterests,
  needsCategoryInterestOnboarding,
  normalizeCategoryBucket,
  orderCategoriesByInterests,
  quotePostgrestFilterValue,
  rankVideosByInterests,
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

  it('needs onboarding only when interests were never set', () => {
    expect(needsCategoryInterestOnboarding(null)).toBe(true);
    expect(needsCategoryInterestOnboarding('')).toBe(true);
    expect(needsCategoryInterestOnboarding([])).toBe(true);
    // Already picked once — do not re-block if admin renamed/removed categories.
    expect(needsCategoryInterestOnboarding(['Technology', 'Business'])).toBe(false);
    expect(
      needsCategoryInterestOnboarding([
        'Technology',
        'Business',
        'Design & UX',
        'Sales',
        'Legal',
      ]),
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

describe('rankVideosByInterests', () => {
  const v = (id, category) => ({ id, mentor_profiles: { category } });
  const feed = [v(1, 'Other'), v(2, ''), v(3, 'Celebrities'), v(4, 'Content & Media, Technology & AI')];
  const ids = list => list.map(x => x.id);

  it('keeps feed order when there are no interests', () => {
    expect(ids(rankVideosByInterests(feed, []))).toEqual([1, 2, 3, 4]);
  });

  it('puts named-interest matches first and keeps the rest', () => {
    expect(ids(rankVideosByInterests(feed, ['Technology & AI']))).toEqual([4, 1, 2, 3]);
  });

  it('ranks named interests above Other matches', () => {
    expect(ids(rankVideosByInterests(feed, ['Other', 'Celebrities']))).toEqual([3, 1, 2, 4]);
  });
});
