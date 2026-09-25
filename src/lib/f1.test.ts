import { describe, expect, it } from 'vitest';
import { toConstructorStandings, toDriverStandings, toRaceResult, type ApiRace } from './f1';

const verstappen = { driverId: 'max_verstappen', code: 'VER', givenName: 'Max', familyName: 'Verstappen' };
const norris = { driverId: 'norris', code: 'NOR', givenName: 'Lando', familyName: 'Norris' };
const alonso = { driverId: 'alonso', code: 'ALO', givenName: 'Fernando', familyName: 'Alonso' };
const redBull = { constructorId: 'red_bull', name: 'Red Bull' };
const mclaren = { constructorId: 'mclaren', name: 'McLaren' };
const astonMartin = { constructorId: 'aston_martin', name: 'Aston Martin' };

describe('toDriverStandings', () => {
  it('maps standings and uses the most recent team', () => {
    const standings = toDriverStandings({
      season: '2024',
      StandingsLists: [
        {
          season: '2024',
          round: '24',
          DriverStandings: [
            { position: '1', positionText: '1', points: '437', wins: '9', Driver: verstappen, Constructors: [redBull] },
            { position: '2', positionText: '2', points: '374', wins: '4', Driver: norris, Constructors: [mclaren] },
            // Jolpica omits position for unclassified drivers.
            { positionText: '-', points: '0', wins: '0', Driver: alonso, Constructors: [redBull, astonMartin] },
          ],
        },
      ],
    });

    expect(standings.season).toBe('2024');
    expect(standings.round).toBe(24);
    expect(standings.entries[0]).toEqual({
      position: '1',
      driver: { code: 'VER', firstName: 'Max', lastName: 'Verstappen' },
      team: { id: 'red_bull', name: 'Red Bull' },
      points: 437,
      wins: 9,
    });
    expect(standings.entries[2]?.position).toBe('-');
    expect(standings.entries[2]?.team?.id).toBe('aston_martin');
  });

  it('returns no entries before the season starts', () => {
    expect(toDriverStandings({ season: '2027', StandingsLists: [] })).toEqual({
      season: '2027',
      round: 0,
      entries: [],
    });
  });
});

describe('toConstructorStandings', () => {
  it('maps points, wins and fractional points', () => {
    const standings = toConstructorStandings({
      StandingsLists: [
        {
          season: '2024',
          round: '24',
          ConstructorStandings: [
            { position: '1', positionText: '1', points: '666', wins: '6', Constructor: mclaren },
            { position: '2', positionText: '2', points: '12.5', wins: '0', Constructor: redBull },
          ],
        },
      ],
    });

    expect(standings.entries.map((e) => [e.position, e.team.name, e.points, e.wins])).toEqual([
      ['1', 'McLaren', 666, 6],
      ['2', 'Red Bull', 12.5, 0],
    ]);
  });
});

describe('toRaceResult', () => {
  const race: ApiRace = {
    season: '2024',
    round: '24',
    raceName: 'Abu Dhabi Grand Prix',
    date: '2024-12-08',
    time: '13:00:00Z',
    Circuit: { circuitName: 'Yas Marina Circuit', Location: { locality: 'Abu Dhabi', country: 'UAE' } },
    Results: [
      {
        position: '1', positionText: '1', points: '25', grid: '1', laps: '58', status: 'Finished',
        Driver: norris, Constructor: mclaren, Time: { time: '1:26:33.291' },
      },
      {
        position: '2', positionText: '2', points: '18', grid: '4', laps: '58', status: 'Finished',
        Driver: verstappen, Constructor: redBull, Time: { time: '+5.832' }, FastestLap: { rank: '1' },
      },
      {
        // Current API data gives lapped cars a time too; the gap should still read in laps.
        position: '3', positionText: '3', points: '0', grid: '0', laps: '57', status: 'Lapped',
        Driver: alonso, Constructor: astonMartin, Time: { time: '+24.633' },
      },
      {
        position: '4', positionText: '4', points: '0', grid: '2', laps: '56', status: '+2 Laps',
        Driver: { ...alonso, givenName: 'Test' }, Constructor: astonMartin,
      },
      {
        position: '5', positionText: 'R', points: '0', grid: '3', laps: '30', status: 'Engine',
        Driver: { ...norris, givenName: 'Other' }, Constructor: mclaren,
      },
    ],
  };

  it('maps the race details', () => {
    const result = toRaceResult(race);
    expect(result).toMatchObject({
      season: '2024',
      round: 24,
      name: 'Abu Dhabi Grand Prix',
      circuit: 'Yas Marina Circuit',
      location: 'Abu Dhabi, UAE',
      startsAt: '2024-12-08T13:00:00Z',
    });
  });

  it('shows times, lapped gaps and retirement reasons', () => {
    const rows = toRaceResult(race).results;
    expect(rows.map((r) => [r.position, r.classified, r.gap])).toEqual([
      ['1', true, '1:26:33.291'],
      ['2', true, '+5.832'],
      ['3', true, '+1 lap'],
      ['4', true, '+2 laps'],
      ['DNF', false, 'Engine'],
    ]);
  });

  it('flags the fastest lap and keeps the grid slot', () => {
    const rows = toRaceResult(race).results;
    expect(rows.filter((r) => r.fastestLap).map((r) => r.driver.lastName)).toEqual(['Verstappen']);
    expect(rows.map((r) => r.grid)).toEqual([1, 4, 0, 2, 3]);
  });

  it('uses midday UTC when the start time is unknown', () => {
    expect(toRaceResult({ ...race, time: undefined }).startsAt).toBe('2024-12-08T12:00:00Z');
  });
});
