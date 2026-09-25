import { describe, expect, it } from 'vitest';
import { formatPoints, timeAgo } from './format';

describe('timeAgo', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');

  it('says "just now" for recent and future times', () => {
    expect(timeAgo(now - 20_000, now)).toBe('just now');
    expect(timeAgo(now + 60_000, now)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(timeAgo(now - 5 * 60_000, now)).toMatch(/5/);
    expect(timeAgo(now - 3 * 3_600_000, now)).toMatch(/3/);
    expect(timeAgo(now - 2 * 86_400_000, now)).toMatch(/2/);
  });
});

describe('formatPoints', () => {
  it('shows half points with one decimal', () => {
    expect(formatPoints(25)).toBe('25');
    expect(formatPoints(12.5)).toBe('12.5');
  });
});
