import { describe, expect, it } from 'vitest';
import { findTeam, teamColor, TEAMS, textColorOn } from './teams';

describe('TEAMS', () => {
  it('has unique ids and valid colors', () => {
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(TEAMS.length);
    for (const team of TEAMS) {
      expect(team.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(team.secondary).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('teamColor', () => {
  it('uses the team color, then former teams, then a stable fallback', () => {
    expect(teamColor('ferrari')).toBe(findTeam('ferrari')?.color);
    expect(teamColor('sauber')).toBe('#52e252');
    expect(teamColor('new_team')).toMatch(/^hsl\(/);
    expect(teamColor('new_team')).toBe(teamColor('new_team'));
  });
});

describe('textColorOn', () => {
  it('picks white on dark colors and dark text on light ones', () => {
    expect(textColorOn('#e10600')).toBe('#ffffff');
    expect(textColorOn('#3671c6')).toBe('#ffffff');
    expect(textColorOn('#ff8000')).toBe('#15151e');
    expect(textColorOn('#27f4d2')).toBe('#15151e');
  });
});
