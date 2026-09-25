const TIMEOUT_MS = 10_000;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`${new URL(url).host} responded with HTTP ${status}`);
  }
}

/** Fetches a URL as text. Retries once when rate limited (HTTP 429). */
export async function fetchText(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      cache: 'no-cache',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) return response.text();
    if (response.status === 429 && attempt === 0) {
      await sleep(retryDelayMs(response.headers.get('Retry-After')));
      continue;
    }
    throw new HttpError(response.status, url);
  }
}

export async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

function retryDelayMs(retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 5) * 1000 : 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
