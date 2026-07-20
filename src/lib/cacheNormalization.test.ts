import { describe, expect, it } from 'vitest';
import { cleanLists, cleanReports, cleanStringArray, cleanSwipeSession } from './cacheNormalization';

describe('cache normalization', () => {
  it('drops malformed lists and repairs fields', () => {
    expect(cleanLists([null, 'bad', { id: 'one', title: 'One', vendorIds: ['a', 2, 'a'], fetches: Infinity }]))
      .toEqual([{ id: 'one', title: 'One', description: '', vendorIds: ['a'], visibility: 'private', fetches: 0 }]);
  });
  it('sorts, caps, and validates reports', () => {
    const reports = Array.from({ length: 12 }, (_, index) => ({ status: 'Short', at: index+1, photo: null }));
    const result = cleanReports({ vendor: [...reports, { status: 'INVALID', at: 100 }] });
    expect(result.vendor).toHaveLength(10);
    expect(result.vendor[0].at).toBe(12);
  });
  it('normalizes saved swipe progress', () => {
    expect(cleanStringArray(['a', 'a', 1, '', 'b'])).toEqual(['a', 'b']);
    expect(cleanSwipeSession({ ids: ['a', 'b'], liked: ['b', 'missing'], at: 99, savedAt: 10 }))
      .toEqual({ ids: ['a', 'b'], liked: ['b'], at: 2, savedAt: 10 });
  });
});
