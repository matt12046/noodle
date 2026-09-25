import { fetchJson } from './http';

// Jolpica F1 is the community-run successor to the Ergast API and serves the
// same response format. Free, no key; rate limited to 4 req/s and 500 req/hour.
export const API_BASE = 'https://api.jolpi.ca/ergast/f1';

// ---- API response shapes (only the fields used here; the API sends numbers as strings) ----

interface ApiDriver {
  driverId: string;
  code?: string;
  givenName: string;
  familyName: string;
}

interface ApiConstructor {
  constructorId: string;
  name: string;
}

interface ApiDriverStanding {
  position?: string;
  positionText?: string;
  points: string;
  wins: string;
  Driver: ApiDriver;
  Constructors?: ApiConstructor[];
}

interface ApiConstructorStanding {
  position?: string;
  positionText?: string;
  points: string;
  wins: string;
  Constructor: ApiConstructor;
}

export interface ApiStandingsTable {
  season?: string;
  StandingsLists: {
    season: string;
    round: string;
    DriverStandings?: ApiDriverStanding[];
    ConstructorStandings?: ApiConstructorStanding[];
  }[];
}

interface ApiResult {
  position: string;
  positionText: string;
  points: string;
  grid: string;
  laps: string;
  status: string;
  Driver: ApiDriver;
  Constructor: ApiConstructor;
  Time?: { time: string };
  FastestLap?: { rank?: string };
}

export interface ApiRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: { circuitName: string; Location?: { locality?: string; country?: string } };
  Results?: ApiResult[];
}

export interface ApiRaceTable {
  season?: string;
  Races: ApiRace[];
}

// ---- Shapes the popup renders. Plain JSON so they can be cached. ----

export interface Team {
  id: string;
  name: string;
}

export interface Driver {
  code?: string;
  firstName: string;
  lastName: string;
}

export interface Standings<T> {
  season: string;
  round: number;
  entries: T[];
}

export interface DriverStanding {
  position: string;
  driver: Driver;
  team?: Team;
  points: number;
  wins: number;
}

export interface ConstructorStanding {
  position: string;
  team: Team;
  points: number;
  wins: number;
}

export interface RaceResult {
  season: string;
  round: number;
  name: string;
  circuit: string;
  location: string;
  startsAt: string;
  results: ResultRow[];
}

export interface ResultRow {
  position: string;
  classified: boolean;
  driver: Driver;
  team: Team;
  /** Starting grid slot; 0 means a pit lane start. */
  grid: number;
  /** Race time for the winner, gap for everyone else, or the retirement reason. */
  gap: string;
  points: number;
  fastestLap: boolean;
}

// ---- Fetching ----

export async function getDriverStandings(): Promise<Standings<DriverStanding>> {
  const table = await currentOrPreviousSeason(
    (season) => fetchStandings(season, 'driverStandings'),
    (t) => t.StandingsLists.length > 0,
  );
  return toDriverStandings(table);
}

export async function getConstructorStandings(): Promise<Standings<ConstructorStanding>> {
  const table = await currentOrPreviousSeason(
    (season) => fetchStandings(season, 'constructorStandings'),
    (t) => t.StandingsLists.length > 0,
  );
  return toConstructorStandings(table);
}

/** The latest race with results, or null if the API has none. */
export async function getLatestRace(): Promise<RaceResult | null> {
  const table = await currentOrPreviousSeason(
    async (season) => {
      const data = await fetchJson<{ MRData: { RaceTable: ApiRaceTable } }>(
        `${API_BASE}/${season}/last/results.json?limit=100`,
      );
      return data.MRData.RaceTable;
    },
    (t) => t.Races.length > 0,
  );
  const race = table.Races[0];
  return race ? toRaceResult(race) : null;
}

async function fetchStandings(season: string, kind: 'driverStandings' | 'constructorStandings') {
  const data = await fetchJson<{ MRData: { StandingsTable: ApiStandingsTable } }>(
    `${API_BASE}/${season}/${kind}.json?limit=100`,
  );
  return data.MRData.StandingsTable;
}

/**
 * Between the new year and the first race the current season has no data yet,
 * so fall back to the previous season rather than showing an empty tab.
 */
async function currentOrPreviousSeason<T extends { season?: string }>(
  load: (season: string) => Promise<T>,
  hasData: (table: T) => boolean,
): Promise<T> {
  const current = await load('current');
  if (hasData(current)) return current;
  const season = Number(current.season) || new Date().getFullYear();
  return load(String(season - 1));
}

// ---- Mapping API responses to what the popup renders ----

export function toDriverStandings(table: ApiStandingsTable): Standings<DriverStanding> {
  const list = table.StandingsLists[0];
  return {
    season: list?.season ?? table.season ?? '',
    round: Number(list?.round ?? 0),
    entries: (list?.DriverStandings ?? []).map((s) => {
      // Drivers who changed teams mid-season list every team; the last is the current one.
      const team = s.Constructors?.at(-1);
      return {
        position: s.position ?? s.positionText ?? '–',
        driver: toDriver(s.Driver),
        team: team && toTeam(team),
        points: Number(s.points),
        wins: Number(s.wins),
      };
    }),
  };
}

export function toConstructorStandings(table: ApiStandingsTable): Standings<ConstructorStanding> {
  const list = table.StandingsLists[0];
  return {
    season: list?.season ?? table.season ?? '',
    round: Number(list?.round ?? 0),
    entries: (list?.ConstructorStandings ?? []).map((s) => ({
      position: s.position ?? s.positionText ?? '–',
      team: toTeam(s.Constructor),
      points: Number(s.points),
      wins: Number(s.wins),
    })),
  };
}

// Letters the API uses in positionText for drivers without a finishing position.
const POSITION_LABELS: Record<string, string> = {
  R: 'DNF', // retired
  D: 'DSQ', // disqualified
  E: 'EX', // excluded
  W: 'DNS', // withdrawn
  F: 'DNQ', // failed to qualify
  N: 'NC', // not classified
};

export function toRaceResult(race: ApiRace): RaceResult {
  const results = race.Results ?? [];
  const winnerLaps = Number(results[0]?.laps ?? 0);
  const location = race.Circuit.Location;
  return {
    season: race.season,
    round: Number(race.round),
    name: race.raceName,
    circuit: race.Circuit.circuitName,
    location: [location?.locality, location?.country].filter(Boolean).join(', '),
    // Without a start time, use midday UTC so the date reads the same in every time zone.
    startsAt: `${race.date}T${race.time ?? '12:00:00Z'}`,
    results: results.map((r) => {
      const classified = /^\d+$/.test(r.positionText);
      return {
        position: classified ? r.positionText : (POSITION_LABELS[r.positionText] ?? r.positionText),
        classified,
        driver: toDriver(r.Driver),
        team: toTeam(r.Constructor),
        grid: Number(r.grid),
        gap: gapText(r, winnerLaps, classified),
        points: Number(r.points),
        fastestLap: r.FastestLap?.rank === '1',
      };
    }),
  };
}

function gapText(result: ApiResult, winnerLaps: number, classified: boolean): string {
  const lapsDown = winnerLaps - Number(result.laps);
  // Lapped finishers come through as "+1 Lap" (older data) or "Lapped" / "Finished" (newer data).
  // Newer data also gives lapped cars a time, but the official classification shows laps down.
  const isLappedFinisher =
    result.status === 'Lapped' || result.status === 'Finished' || /^\+\d+ Laps?$/.test(result.status);
  if (classified && isLappedFinisher && lapsDown > 0) {
    return `+${lapsDown} ${lapsDown === 1 ? 'lap' : 'laps'}`;
  }
  return result.Time?.time ?? result.status;
}

function toDriver(driver: ApiDriver): Driver {
  return { code: driver.code, firstName: driver.givenName, lastName: driver.familyName };
}

function toTeam(constructor: ApiConstructor): Team {
  return { id: constructor.constructorId, name: constructor.name };
}
