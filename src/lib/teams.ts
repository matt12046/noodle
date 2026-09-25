// Accent colours keyed by the API's constructorId. The 2026 newcomers are best
// guesses; any team missing here gets a stable colour derived from its id.
const TEAM_COLORS: Record<string, string> = {
  red_bull: '#3671c6',
  ferrari: '#e8002d',
  mercedes: '#27f4d2',
  mclaren: '#ff8000',
  aston_martin: '#229971',
  alpine: '#0093cc',
  williams: '#64c4ff',
  rb: '#6692ff',
  sauber: '#52e252',
  haas: '#b6babd',
  audi: '#bb0a30',
  cadillac: '#909090',
};

export function teamColor(constructorId: string | undefined): string {
  if (!constructorId) return 'var(--faint)';
  const known = TEAM_COLORS[constructorId];
  if (known) return known;
  let hash = 0;
  for (const char of constructorId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 60% 55%)`;
}
