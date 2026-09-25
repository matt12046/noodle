import { fetchText } from './http';

export interface NewsSource {
  name: string;
  url: string;
}

// To add a feed, list it here, then add its site to host_permissions and to
// connect-src in the content security policy, both in public/manifest.json.
// src/manifest.test.ts fails until they all match.
export const NEWS_SOURCES: NewsSource[] = [
  { name: 'Formula1.com', url: 'https://www.formula1.com/en/latest/all.xml' },
  { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml' },
  { name: 'Autosport', url: 'https://www.autosport.com/rss/f1/news/' },
];

const MAX_ITEMS = 30;

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt?: number;
  image?: string;
}

export interface News {
  items: NewsItem[];
  /** Names of sources that couldn't be loaded. */
  failed: string[];
}

/** Latest headlines from every source, newest first. Fails only if every source fails. */
export async function getNews(sources = NEWS_SOURCES): Promise<News> {
  const settled = await Promise.allSettled(
    sources.map(async (source) => parseFeed(await fetchText(source.url), source)),
  );
  const failed = sources.filter((_, i) => settled[i]?.status === 'rejected').map((s) => s.name);
  if (failed.length === sources.length) {
    throw new Error(`Couldn't load any news feeds (${failed.join(', ')})`);
  }
  return { items: mergeItems(settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))), failed };
}

export function mergeItems(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items
    .filter((item) => !seen.has(item.url) && seen.add(item.url))
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, MAX_ITEMS);
}

const ATOM_NS = 'http://www.w3.org/2005/Atom';
const MEDIA_NS = 'http://search.yahoo.com/mrss/';
const DC_NS = 'http://purl.org/dc/elements/1.1/';

/** Parses an RSS 2.0 or Atom feed. Items without a title or a web link are skipped. */
export function parseFeed(xml: string, source: NewsSource): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`${source.name} feed isn't valid XML`);
  }
  const rssItems = Array.from(doc.getElementsByTagName('item'));
  const items = rssItems.length > 0
    ? rssItems.map((item) => parseRssItem(item, source))
    : Array.from(doc.getElementsByTagNameNS(ATOM_NS, 'entry')).map((entry) => parseAtomEntry(entry, source));
  return items.filter((item): item is NewsItem => item !== undefined);
}

function parseRssItem(item: Element, source: NewsSource): NewsItem | undefined {
  const guid = child(item, 'guid', null);
  const link =
    text(child(item, 'link', null)) ??
    (guid?.getAttribute('isPermaLink') !== 'false' ? text(guid) : undefined);
  const date = text(child(item, 'pubDate', null)) ?? text(child(item, 'date', DC_NS));
  return makeItem(source, text(child(item, 'title', null)), link, date, rssImage(item));
}

function parseAtomEntry(entry: Element, source: NewsSource): NewsItem | undefined {
  const links = children(entry, 'link', ATOM_NS);
  const link = links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate') ?? links[0];
  const date = text(child(entry, 'published', ATOM_NS)) ?? text(child(entry, 'updated', ATOM_NS));
  return makeItem(source, text(child(entry, 'title', ATOM_NS)), link?.getAttribute('href'), date, undefined);
}

function makeItem(
  source: NewsSource,
  rawTitle: string | undefined,
  rawLink: string | null | undefined,
  rawDate: string | undefined,
  rawImage: string | null | undefined,
): NewsItem | undefined {
  const title = rawTitle && plainText(rawTitle);
  const url = webUrl(rawLink, source.url);
  if (!title || !url) return undefined;
  const publishedAt = rawDate ? Date.parse(rawDate) : NaN;
  return {
    title,
    url,
    source: source.name,
    publishedAt: Number.isNaN(publishedAt) ? undefined : publishedAt,
    image: httpsUrl(webUrl(rawImage, source.url)),
  };
}

function rssImage(item: Element): string | null | undefined {
  const thumbnail = item.getElementsByTagNameNS(MEDIA_NS, 'thumbnail')[0];
  if (thumbnail) return thumbnail.getAttribute('url');
  const media = Array.from(item.getElementsByTagNameNS(MEDIA_NS, 'content')).find(
    (m) => m.getAttribute('medium') === 'image' || m.getAttribute('type')?.startsWith('image/'),
  );
  if (media) return media.getAttribute('url');
  const enclosure = children(item, 'enclosure', null).find((e) => e.getAttribute('type')?.startsWith('image/'));
  return enclosure?.getAttribute('url');
}

/** Direct children by namespace, so e.g. <media:title> isn't mistaken for <title>. */
function children(parent: Element, localName: string, namespace: string | null): Element[] {
  return Array.from(parent.children).filter((c) => c.localName === localName && c.namespaceURI === namespace);
}

function child(parent: Element, localName: string, namespace: string | null): Element | undefined {
  return children(parent, localName, namespace)[0];
}

function text(el: Element | undefined): string | undefined {
  return el?.textContent?.trim() || undefined;
}

/** Feed titles sometimes carry HTML or entities inside CDATA; reduce them to plain text. */
function plainText(value: string): string {
  const decoded = /[<&]/.test(value)
    ? (new DOMParser().parseFromString(value, 'text/html').body.textContent ?? '')
    : value;
  return decoded.replace(/\s+/g, ' ').trim();
}

/** The extension's content security policy only allows images over https. */
function httpsUrl(url: string | undefined): string | undefined {
  return url?.startsWith('https:') ? url : undefined;
}

/** Only http(s) URLs are used, so a feed can't smuggle in javascript: or data: links. */
function webUrl(value: string | null | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim(), base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
