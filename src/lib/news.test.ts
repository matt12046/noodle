import { describe, expect, it } from 'vitest';
import { mergeItems, parseFeed } from './news';

const source = { name: 'Test Feed', url: 'https://example.com/feed.xml' };

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Test</title>
    <item>
      <title><![CDATA[Norris &amp; Piastri <b>fight</b> for the title]]></title>
      <media:title>Not the headline</media:title>
      <link>https://example.com/news/1?at_medium=RSS</link>
      <pubDate>Sun, 08 Dec 2024 15:30:00 GMT</pubDate>
      <media:thumbnail width="240" height="135" url="https://img.example.com/1.jpg"/>
    </item>
    <item>
      <title>Relative link with an enclosure</title>
      <link>/news/2</link>
      <dc:date>2024-12-07T10:00:00Z</dc:date>
      <enclosure url="https://img.example.com/2.jpg" length="0" type="image/jpeg"/>
    </item>
    <item>
      <title>Link only in the guid</title>
      <guid>https://example.com/news/3</guid>
    </item>
    <item>
      <title>Unsafe link</title>
      <link>javascript:alert(1)</link>
    </item>
    <item>
      <title></title>
      <link>https://example.com/news/no-title</link>
    </item>
  </channel>
</rss>`;

const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom test</title>
  <entry>
    <title>Atom headline</title>
    <link rel="alternate" href="https://example.com/atom/1"/>
    <updated>2024-12-06T09:00:00Z</updated>
  </entry>
</feed>`;

describe('parseFeed', () => {
  it('parses RSS items into plain-text headlines with safe links', () => {
    expect(parseFeed(rss, source)).toEqual([
      {
        title: 'Norris & Piastri fight for the title',
        url: 'https://example.com/news/1?at_medium=RSS',
        source: 'Test Feed',
        publishedAt: Date.parse('2024-12-08T15:30:00Z'),
        image: 'https://img.example.com/1.jpg',
      },
      {
        title: 'Relative link with an enclosure',
        url: 'https://example.com/news/2',
        source: 'Test Feed',
        publishedAt: Date.parse('2024-12-07T10:00:00Z'),
        image: 'https://img.example.com/2.jpg',
      },
      {
        title: 'Link only in the guid',
        url: 'https://example.com/news/3',
        source: 'Test Feed',
        publishedAt: undefined,
        image: undefined,
      },
    ]);
  });

  it('parses Atom entries', () => {
    expect(parseFeed(atom, source)).toEqual([
      {
        title: 'Atom headline',
        url: 'https://example.com/atom/1',
        source: 'Test Feed',
        publishedAt: Date.parse('2024-12-06T09:00:00Z'),
        image: undefined,
      },
    ]);
  });

  it('drops images that are not served over https', () => {
    const feed = `<rss version="2.0"><channel><item><title>Plain http image</title>
      <link>https://example.com/news/4</link>
      <enclosure url="http://img.example.com/4.jpg" type="image/jpeg" length="0"/>
    </item></channel></rss>`;
    expect(parseFeed(feed, source)[0]?.image).toBeUndefined();
  });

  it('rejects documents that are not XML', () => {
    expect(() => parseFeed('<html><body>Not found', source)).toThrow(/isn't valid XML/);
  });
});

describe('mergeItems', () => {
  it('sorts newest first, drops duplicates and puts undated items last', () => {
    const item = (url: string, publishedAt?: number) => ({ title: url, url, source: 'x', publishedAt });
    expect(mergeItems([item('a', 1), item('b'), item('c', 3), item('a', 1)]).map((i) => i.url)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });
});
