import {
  buildMentorShareUrls,
  getMentorShareLink,
  parseMentorShareIdentifier,
} from '../shareProfile';

describe('shareProfile', () => {
  it('builds web and app urls from username', () => {
    expect(buildMentorShareUrls('priya', 'uuid-1')).toEqual({
      slug: 'priya',
      app: 'connectiqo://mentor/priya',
      web: 'https://app.connectiqo.com/mentor/priya',
    });
  });

  it('prefers https share link for external sharing', () => {
    expect(getMentorShareLink('priya', 'uuid-1')).toBe(
      'https://app.connectiqo.com/mentor/priya',
    );
  });

  it('falls back to mentorId when username missing', () => {
    expect(buildMentorShareUrls(null, 'abc-id').web).toBe(
      'https://app.connectiqo.com/mentor/abc-id',
    );
  });

  it('parses https and custom-scheme mentor links', () => {
    expect(
      parseMentorShareIdentifier('https://app.connectiqo.com/mentor/priya'),
    ).toBe('priya');
    expect(
      parseMentorShareIdentifier('https://connectiqo.com/mentor/priya'),
    ).toBe('priya');
    expect(parseMentorShareIdentifier('connectiqo://mentor/priya')).toBe('priya');
    expect(
      parseMentorShareIdentifier('https://www.connectiqo.com/mentor/john_doe?x=1'),
    ).toBe('john_doe');
    expect(
      parseMentorShareIdentifier('connectiqo://mentor/abc-def-uuid'),
    ).toBe('abc-def-uuid');
  });

  it('rejects unrelated qr payloads', () => {
    expect(parseMentorShareIdentifier('https://example.com/foo')).toBeNull();
    expect(parseMentorShareIdentifier('hello world')).toBeNull();
  });
});
