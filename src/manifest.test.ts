import { describe, expect, it } from 'vitest';
import manifest from '../public/manifest.json';
import { API_BASE } from './lib/f1';
import { NEWS_SOURCES } from './lib/news';

// These tests pin down what the extension is allowed to do. If one fails, a
// change is asking for more access than before: make sure that's intended, then
// update the test and the permission justification in docs/chrome-web-store.md.

const newsOrigins = [...new Set(NEWS_SOURCES.map((source) => new URL(source.url).origin))];

function parseCsp(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name = '', ...values]) => [name, values]),
  );
}

describe('manifest', () => {
  it('requests no browser API permissions and never runs code on web pages', () => {
    for (const key of [
      'permissions',
      'optional_permissions',
      'optional_host_permissions',
      'content_scripts',
      'background',
      'web_accessible_resources',
      'externally_connectable',
    ]) {
      expect(manifest).not.toHaveProperty(key);
    }
  });

  it('only has host access to the news feeds', () => {
    expect([...manifest.host_permissions].sort()).toEqual(newsOrigins.map((origin) => `${origin}/*`).sort());
  });

  it('only runs its own code and only connects to the stats API and news feeds', () => {
    const csp = parseCsp(manifest.content_security_policy.extension_pages);
    expect(csp['default-src']).toEqual(["'none'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['img-src']).toEqual(["'self'", 'https:']);
    expect([...(csp['connect-src'] ?? [])].sort()).toEqual([new URL(API_BASE).origin, ...newsOrigins].sort());
  });
});
