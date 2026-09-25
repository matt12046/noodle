export interface TeamInfo {
  /** The API's constructorId. */
  id: string;
  name: string;
  /** Main livery color: used for row accents and as the theme's accent. */
  color: string;
  /** Second livery color, paired with the main one in the theme. */
  secondary: string;
}

// The 2026 grid, alphabetically. Audi and Cadillac are new this year, so their
// ids and colors are best guesses until the API confirms them.
export const TEAMS: readonly TeamInfo[] = [
  { id: 'alpine', name: 'Alpine', color: '#00a1e8', secondary: '#ff87bc' },
  { id: 'aston_martin', name: 'Aston Martin', color: '#229971', secondary: '#cedc00' },
  { id: 'audi', name: 'Audi', color: '#f50537', secondary: '#c4c6cc' },
  { id: 'cadillac', name: 'Cadillac', color: '#a7a9ac', secondary: '#1b1b1b' },
  { id: 'ferrari', name: 'Ferrari', color: '#e8002d', secondary: '#fff200' },
  { id: 'haas', name: 'Haas', color: '#b6babd', secondary: '#e6002b' },
  { id: 'mclaren', name: 'McLaren', color: '#ff8000', secondary: '#47c7fc' },
  { id: 'mercedes', name: 'Mercedes', color: '#27f4d2', secondary: '#c8ccce' },
  { id: 'rb', name: 'Racing Bulls', color: '#6692ff', secondary: '#ffffff' },
  { id: 'red_bull', name: 'Red Bull Racing', color: '#3671c6', secondary: '#e30118' },
  { id: 'williams', name: 'Williams', color: '#64c4ff', secondary: '#1868db' },
];

// Teams that have left the grid but still show up in last season's data.
const FORMER_TEAM_COLORS: Record<string, string> = {
  sauber: '#52e252',
};

export function findTeam(id: string | undefined): TeamInfo | undefined {
  return TEAMS.find((team) => team.id === id);
}

/** Row accent for a team. Unknown teams get a stable color derived from their id. */
export function teamColor(constructorId: string | undefined): string {
  if (!constructorId) return 'var(--faint)';
  const known = findTeam(constructorId)?.color ?? FORMER_TEAM_COLORS[constructorId];
  if (known) return known;
  let hash = 0;
  for (const char of constructorId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 60% 55%)`;
}

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#15151e';

/** Whichever of white or near-black text has more contrast on a #rrggbb background. */
export function textColorOn(background: string): string {
  const bg = luminance(background);
  const onLight = (luminance(LIGHT_TEXT) + 0.05) / (bg + 0.05);
  const onDark = (bg + 0.05) / (luminance(DARK_TEXT) + 0.05);
  return onLight >= onDark ? LIGHT_TEXT : DARK_TEXT;
}

// WCAG relative luminance.
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
