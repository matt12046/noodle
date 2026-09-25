import { readCache, writeCache } from './lib/cache';
import { h } from './lib/dom';
import {
  getConstructorStandings,
  getDriverStandings,
  getLatestRace,
  type ConstructorStanding,
  type Driver,
  type DriverStanding,
  type RaceResult,
  type ResultRow,
  type Standings,
} from './lib/f1';
import { formatPoints, formatRaceDate, timeAgo } from './lib/format';
import { getNews, NEWS_SOURCES, type News, type NewsItem } from './lib/news';
import { findTeam, teamColor, TEAMS, textColorOn, type TeamInfo } from './lib/teams';

const MINUTE = 60_000;

interface Resource<T> {
  key: string;
  /** How long cached data counts as fresh before the popup refetches it. */
  maxAge: number;
  load: () => Promise<T>;
}

/** A region of the popup bound to one resource: shows cached data first, then fresh data. */
class DataView<T> {
  updatedAt: number | undefined;
  busy = false;
  private shown: { data: T } | undefined;

  constructor(
    readonly root: HTMLElement,
    private readonly resource: Resource<T>,
    private readonly render: (data: T) => Node,
    private readonly label: string,
    private readonly onStatusChange: () => void,
  ) {}

  async refresh(force = false): Promise<void> {
    if (this.busy) return;
    if (this.updatedAt === undefined) {
      const cached = readCache<T>(this.resource.key);
      if (cached) this.show(cached.data, cached.savedAt);
    }
    const fresh = this.updatedAt !== undefined && Date.now() - this.updatedAt < this.resource.maxAge;
    if (fresh && !force) return;
    if (this.updatedAt === undefined) this.root.replaceChildren(skeleton());
    this.setBusy(true);
    try {
      const data = await this.resource.load();
      this.show(data, writeCache(this.resource.key, data));
    } catch (error) {
      console.error(`Noodle: couldn't load ${this.label}`, error);
      if (this.updatedAt !== undefined) {
        this.root.querySelector(':scope > .notice')?.remove();
        this.root.prepend(notice(`Couldn't refresh ${this.label}. Showing data from ${timeAgo(this.updatedAt)}.`));
      } else {
        this.root.replaceChildren(errorState(`Couldn't load ${this.label}.`, () => void this.refresh(true)));
      }
    } finally {
      this.setBusy(false);
    }
  }

  /** Draws the current data again, e.g. after the favorite team changes. */
  rerender(): void {
    if (this.shown) this.root.replaceChildren(this.render(this.shown.data));
  }

  private show(data: T, savedAt: number): void {
    this.shown = { data };
    this.root.replaceChildren(this.render(data));
    this.updatedAt = savedAt;
    this.onStatusChange();
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.onStatusChange();
  }
}

// ---- Views ----

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

const views = {
  drivers: new DataView(
    byId('view-drivers'),
    { key: 'drivers', maxAge: 10 * MINUTE, load: getDriverStandings },
    renderDriverStandings,
    'driver standings',
    updateStatus,
  ),
  constructors: new DataView(
    byId('view-constructors'),
    { key: 'constructors', maxAge: 10 * MINUTE, load: getConstructorStandings },
    renderConstructorStandings,
    'constructor standings',
    updateStatus,
  ),
  results: new DataView(
    byId('view-results'),
    { key: 'results', maxAge: 10 * MINUTE, load: getLatestRace },
    renderRace,
    'race results',
    updateStatus,
  ),
  news: new DataView(
    byId('view-news'),
    { key: 'news', maxAge: 5 * MINUTE, load: () => getNews() },
    renderNews,
    'news',
    updateStatus,
  ),
};
/** The parts of a DataView that don't depend on its data type. */
interface ViewStatus {
  readonly busy: boolean;
  readonly updatedAt: number | undefined;
  refresh(force?: boolean): Promise<void>;
  rerender(): void;
}
const allViews: ViewStatus[] = Object.values(views);

// ---- Tabs and the standings toggle ----

const TABS = ['standings', 'results', 'news'] as const;
const STANDINGS_KINDS = ['drivers', 'constructors'] as const;
type TabId = (typeof TABS)[number];
type StandingsKind = (typeof STANDINGS_KINDS)[number];

const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
const standingsButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-standings]'));
const scroller = byId('scroller');
const refreshButton = byId<HTMLButtonElement>('refresh');
const updatedLabel = byId('updated');
const attribution = byId('attribution');

let activeTab: TabId = oneOf(readPref('tab'), TABS, 'standings');
let standingsKind: StandingsKind = oneOf(readPref('standings'), STANDINGS_KINDS, 'drivers');

function selectTab(id: TabId, focus = false): void {
  activeTab = id;
  for (const tab of tabButtons) {
    const selected = tab.dataset.tab === id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    byId(`panel-${tab.dataset.tab}`).hidden = !selected;
    if (selected && focus) tab.focus();
  }
  scroller.scrollTop = 0;
  savePref('tab', id);
  updateStatus();
}

function selectStandings(kind: StandingsKind): void {
  standingsKind = kind;
  for (const button of standingsButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.standings === kind));
  }
  views.drivers.root.hidden = kind !== 'drivers';
  views.constructors.root.hidden = kind !== 'constructors';
  savePref('standings', kind);
  updateStatus();
}

function activeView(): ViewStatus {
  return views[activeTab === 'standings' ? standingsKind : activeTab];
}

function updateStatus(): void {
  const view = activeView();
  if (view.busy) {
    updatedLabel.textContent = view.updatedAt === undefined ? 'Loading…' : 'Refreshing…';
  } else {
    updatedLabel.textContent = view.updatedAt === undefined ? '' : `Updated ${timeAgo(view.updatedAt)}`;
  }
  attribution.textContent =
    activeTab === 'news' ? NEWS_SOURCES.map((s) => s.name).join(' · ') : 'Data: Jolpica F1';
  refreshButton.classList.toggle('is-busy', allViews.some((v) => v.busy));
}

// ---- Favorite team: onboarding picker and theme ----

// Saved as the team's constructorId, or "none" if the user chose no team.
// Nothing saved yet means this is the first run, so the picker opens.
const savedTeam = readPref('team');
let favoriteTeam: TeamInfo | undefined = findTeam(savedTeam ?? undefined);

const picker = byId('picker');
const teamGrid = byId('team-grid');
const pickerCancel = byId<HTMLButtonElement>('picker-cancel');
const teamButton = byId<HTMLButtonElement>('team-button');
const teamLabel = byId('team-label');
const mainParts = [byId('tabs'), scroller, byId('statusbar'), teamButton, refreshButton];

function applyTheme(): void {
  const root = document.documentElement;
  const team = favoriteTeam;
  if (team) {
    root.dataset.team = team.id;
    root.style.setProperty('--accent', team.color);
    root.style.setProperty('--accent-2', team.secondary);
    root.style.setProperty('--on-accent', textColorOn(team.color));
  } else {
    delete root.dataset.team;
    for (const name of ['--accent', '--accent-2', '--on-accent']) root.style.removeProperty(name);
  }
  teamLabel.textContent = team?.name ?? 'Pick team';
  teamButton.title = team ? `Your team: ${team.name}. Click to change.` : 'Pick your team';
}

function openPicker(firstRun: boolean): void {
  teamGrid.replaceChildren(...TEAMS.map(teamOption));
  pickerCancel.hidden = firstRun;
  picker.hidden = false;
  for (const el of mainParts) el.hidden = true;
  if (!firstRun) teamGrid.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
}

function closePicker(): void {
  picker.hidden = true;
  for (const el of mainParts) el.hidden = false;
  teamButton.focus();
}

function chooseTeam(team: TeamInfo | undefined): void {
  favoriteTeam = team;
  savePref('team', team?.id ?? 'none');
  applyTheme();
  for (const view of allViews) view.rerender();
  closePicker();
}

function teamOption(team: TeamInfo): HTMLElement {
  const swatch = h('span', { class: 'swatch', 'aria-hidden': 'true' });
  swatch.style.setProperty('--c1', team.color);
  swatch.style.setProperty('--c2', team.secondary);
  const button = h(
    'button',
    { class: 'team-option', type: 'button', 'aria-pressed': String(team.id === favoriteTeam?.id) },
    swatch,
    team.name,
  );
  button.style.setProperty('--c1', team.color);
  button.addEventListener('click', () => chooseTeam(team));
  return button;
}

teamButton.addEventListener('click', () => openPicker(false));
byId('no-team').addEventListener('click', () => chooseTeam(undefined));
pickerCancel.addEventListener('click', closePicker);
picker.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !pickerCancel.hidden) closePicker();
});

// ---- Tab and toggle events ----

for (const tab of tabButtons) {
  tab.addEventListener('click', () => selectTab(tab.dataset.tab as TabId));
}

document.querySelector('[role="tablist"]')?.addEventListener('keydown', (event) => {
  const key = (event as KeyboardEvent).key;
  const index = TABS.indexOf(activeTab);
  const next =
    key === 'ArrowRight' ? TABS[(index + 1) % TABS.length]
    : key === 'ArrowLeft' ? TABS[(index - 1 + TABS.length) % TABS.length]
    : key === 'Home' ? TABS[0]
    : key === 'End' ? TABS[TABS.length - 1]
    : undefined;
  if (next) {
    event.preventDefault();
    selectTab(next, true);
  }
});

for (const button of standingsButtons) {
  button.addEventListener('click', () => selectStandings(button.dataset.standings as StandingsKind));
}

refreshButton.addEventListener('click', () => {
  for (const view of allViews) void view.refresh(true);
});

applyTheme();
selectTab(activeTab);
selectStandings(standingsKind);
if (savedTeam === null) openPicker(true);
// Data loads behind the picker so it's ready once a team is chosen.
for (const view of allViews) void view.refresh();
setInterval(updateStatus, 30_000);

// ---- Rendering ----

function renderDriverStandings(standings: Standings<DriverStanding>): Node {
  if (standings.entries.length === 0) return emptyState('No standings yet this season.');
  return h(
    'div',
    null,
    standingsMeta(standings),
    h(
      'ol',
      { class: 'rows' },
      ...standings.entries.map((s) =>
        h(
          'li',
          { class: rowClass('row', s.team?.id) },
          h('span', { class: 'pos' }, s.position),
          teamBar(s.team?.id),
          h('div', { class: 'who' }, driverName(s.driver), h('div', { class: 'sub' }, s.team?.name ?? '')),
          points(s.points),
        ),
      ),
    ),
  );
}

function renderConstructorStandings(standings: Standings<ConstructorStanding>): Node {
  if (standings.entries.length === 0) return emptyState('No standings yet this season.');
  return h(
    'div',
    null,
    standingsMeta(standings),
    h(
      'ol',
      { class: 'rows' },
      ...standings.entries.map((s) =>
        h(
          'li',
          { class: rowClass('row', s.team.id) },
          h('span', { class: 'pos' }, s.position),
          teamBar(s.team.id),
          h(
            'div',
            { class: 'who' },
            h('div', { class: 'name team-name' }, s.team.name),
            h('div', { class: 'sub' }, `${s.wins} ${s.wins === 1 ? 'win' : 'wins'}`),
          ),
          points(s.points),
        ),
      ),
    ),
  );
}

function standingsMeta(standings: Standings<unknown>): Node {
  return h('p', { class: 'meta' }, `${standings.season} season · after round ${standings.round}`);
}

function renderRace(race: RaceResult | null): Node {
  if (!race || race.results.length === 0) return emptyState('No race results yet.');
  return h(
    'div',
    null,
    h(
      'div',
      { class: 'race-header' },
      h('p', { class: 'kicker' }, `Round ${race.round} · ${race.season}`),
      h('h2', { class: 'race-name' }, race.name),
      h('p', { class: 'race-meta' }, `${race.circuit} · ${formatRaceDate(race.startsAt)}`),
    ),
    h(
      'div',
      { class: 'row result-row col-heads', 'aria-hidden': 'true' },
      h('span', { class: 'pos' }, 'Pos'),
      h('span'),
      h('span', null, 'Driver'),
      h('span', { class: 'gap' }, 'Time'),
      h('span', { class: 'pts' }, 'Pts'),
    ),
    h('ol', { class: 'rows' }, ...race.results.map(resultRow)),
  );
}

function resultRow(r: ResultRow): Node {
  return h(
    'li',
    { class: rowClass(r.classified ? 'row result-row' : 'row result-row is-out', r.team.id) },
    h('span', { class: 'pos' }, r.position),
    teamBar(r.team.id),
    h(
      'div',
      { class: 'who' },
      driverName(r.driver),
      h(
        'div',
        { class: 'sub' },
        r.team.name,
        r.fastestLap && h('span', { class: 'badge-fastest', title: 'Fastest lap' }, 'FL'),
      ),
    ),
    h('div', { class: 'gap' }, h('div', { class: 'gap-time' }, r.gap), positionChange(r)),
    h('span', { class: r.points > 0 ? 'pts' : 'pts is-zero' }, formatPoints(r.points)),
  );
}

function positionChange(r: ResultRow): Node | null {
  if (!r.classified) return null;
  if (r.grid === 0) return h('div', { class: 'delta' }, 'from pit lane');
  const change = r.grid - Number(r.position);
  if (change === 0) return null;
  return h(
    'div',
    { class: change > 0 ? 'delta up' : 'delta down', title: `Started P${r.grid}` },
    `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}`,
  );
}

function renderNews(news: News): Node {
  const failed = news.failed.length > 0 && notice(`Couldn't load ${news.failed.join(' or ')}.`);
  if (news.items.length === 0) return h('div', null, failed, emptyState('No headlines right now.'));
  return h('div', null, failed, h('ul', { class: 'news' }, ...news.items.map(newsItem)));
}

function newsItem(item: NewsItem): Node {
  const thumb = item.image
    ? h('img', { class: 'thumb', src: item.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' })
    : null;
  thumb?.addEventListener('error', () => thumb.remove(), { once: true });
  const meta = [item.source, item.publishedAt !== undefined && timeAgo(item.publishedAt)]
    .filter(Boolean)
    .join(' · ');
  return h(
    'li',
    null,
    h(
      'a',
      { class: 'news-item', href: item.url, target: '_blank', rel: 'noopener noreferrer' },
      thumb,
      h('div', { class: 'news-text' }, h('span', { class: 'headline' }, item.title), h('span', { class: 'news-meta' }, meta)),
    ),
  );
}

// ---- Small building blocks ----

function rowClass(base: string, teamId: string | undefined): string {
  return teamId !== undefined && teamId === favoriteTeam?.id ? `${base} is-favorite` : base;
}

function driverName(driver: Driver): Node {
  return h(
    'div',
    { class: 'name' },
    h('span', { class: 'first' }, driver.firstName),
    ' ',
    h('span', { class: 'last' }, driver.lastName),
  );
}

function teamBar(teamId: string | undefined): Node {
  const bar = h('span', { class: 'team-bar', 'aria-hidden': 'true' });
  bar.style.setProperty('--team', teamColor(teamId));
  return bar;
}

function points(value: number): Node {
  return h('div', { class: 'pts' }, formatPoints(value), h('span', { class: 'unit' }, 'pts'));
}

function skeleton(): Node {
  return h(
    'div',
    { class: 'skeleton', role: 'status', 'aria-label': 'Loading' },
    ...Array.from({ length: 9 }, () => h('div', { class: 'skeleton-row' })),
  );
}

function notice(message: string): HTMLElement {
  return h('p', { class: 'notice', role: 'status' }, message);
}

function emptyState(message: string): Node {
  return h('div', { class: 'state' }, h('p', { class: 'state-title' }, message));
}

function errorState(message: string, retry: () => void): Node {
  const button = h('button', { class: 'button', type: 'button' }, 'Try again');
  button.addEventListener('click', retry);
  return h(
    'div',
    { class: 'state', role: 'alert' },
    h('p', { class: 'state-title' }, message),
    h('p', { class: 'state-detail' }, 'Check your connection and try again.'),
    button,
  );
}

// ---- Remembered choices (a convenience, so failures are ignored) ----

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(`noodle:pref:${key}`);
  } catch {
    return null;
  }
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback;
}

function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(`noodle:pref:${key}`, value);
  } catch {
    // Storage unavailable: the choice just won't be remembered.
  }
}
