import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchText, HttpError } from './http';

const URL = 'https://api.jolpi.ca/ergast/f1/current/driverStandings.json';

describe('fetchText', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('never sends cookies or a referrer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchText(URL)).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }),
    );
  });

  it('waits and retries once when rate limited', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const result = fetchText(URL);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after a second rate limit or any other error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('', { status: 429 })));
    const limited = expect(fetchText(URL)).rejects.toThrow(HttpError);
    await vi.advanceTimersByTimeAsync(1_000);
    await limited;

    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('', { status: 503 })));
    await expect(fetchText(URL)).rejects.toThrow('api.jolpi.ca responded with HTTP 503');
  });
});
