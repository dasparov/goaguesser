import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadGhToken,
  saveGhToken,
  forgetGhToken,
  publishSpots,
  makeInboxFilename,
  DEFAULT_REPO,
} from '../src/curate/github';

// --- localStorage shim (tests run under the 'node' vitest environment) ---
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('token persistence', () => {
  it('returns null when no token is stored', () => {
    expect(loadGhToken()).toBeNull();
  });

  it('round-trips a saved token', () => {
    saveGhToken('ghp_abc123');
    expect(loadGhToken()).toBe('ghp_abc123');
  });

  it('forgetGhToken clears the stored token', () => {
    saveGhToken('ghp_abc123');
    forgetGhToken();
    expect(loadGhToken()).toBeNull();
  });
});

describe('DEFAULT_REPO', () => {
  it('resolves to a non-empty owner/name string', () => {
    expect(DEFAULT_REPO).toMatch(/^[^/]+\/[^/]+$/);
  });
});

describe('makeInboxFilename', () => {
  it('produces a spots-<timestamp>.json filename', () => {
    expect(makeInboxFilename(1700000000000)).toBe('spots-1700000000000.json');
  });
});

describe('publishSpots payload shape', () => {
  it('sends only imageId/name, base64-encoded UTF-8-safely (accented names included)', async () => {
    let capturedBody: string | undefined;
    let capturedUrl: string | undefined;
    let capturedHeaders: Record<string, string> | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        capturedUrl = url;
        capturedBody = init.body as string;
        capturedHeaders = init.headers as Record<string, string>;
        return new Response(JSON.stringify({ content: {} }), { status: 201 });
      })
    );

    const spots = [
      { imageId: '123', name: 'Cándolim beach', lat: 15.5, lng: 73.7 },
      { imageId: '456', name: undefined, lat: 15.6, lng: 73.8 },
    ];

    const result = await publishSpots(spots as never, {
      repo: 'dasparov/goaguesser',
      token: 'ghp_test',
      filename: 'spots-123.json',
    });

    expect(result).toEqual({ ok: true, path: 'spots-inbox/spots-123.json' });
    expect(capturedUrl).toBe(
      'https://api.github.com/repos/dasparov/goaguesser/contents/spots-inbox/spots-123.json'
    );
    expect(capturedHeaders?.Authorization).toBe('Bearer ghp_test');
    expect(capturedHeaders?.Accept).toBe('application/vnd.github+json');
    expect(capturedHeaders?.['X-GitHub-Api-Version']).toBe('2022-11-28');

    const parsedBody = JSON.parse(capturedBody!);
    expect(parsedBody.message).toMatch(/spots/i);

    // decode base64 as UTF-8 to verify no mangling of the accented character,
    // and that lat/lng did not leak into the payload.
    const decoded = Buffer.from(parsedBody.content, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);
    expect(payload).toEqual([
      { imageId: '123', name: 'Cándolim beach' },
      { imageId: '456' },
    ]);
    expect(decoded).not.toMatch(/lat/);
    expect(decoded).not.toMatch(/lng/);
  });
});

describe('publishSpots status -> reason mapping', () => {
  const spots = [{ imageId: '1', name: 'a' }];
  const opts = { repo: 'dasparov/goaguesser', token: 't', filename: 'spots-1.json' };

  it('maps 401 to bad-token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 }))
    );
    const result = await publishSpots(spots, opts);
    expect(result).toEqual({ ok: false, reason: 'bad-token', detail: 'Bad credentials' });
  });

  it('maps 403 to forbidden', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Resource not accessible' }), { status: 403 }))
    );
    const result = await publishSpots(spots, opts);
    expect(result).toEqual({ ok: false, reason: 'forbidden', detail: 'Resource not accessible' });
  });

  it('maps 409 to conflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Conflict' }), { status: 409 }))
    );
    const result = await publishSpots(spots, opts);
    expect(result).toEqual({ ok: false, reason: 'conflict', detail: 'Conflict' });
  });

  it('maps 422 to conflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Unprocessable' }), { status: 422 }))
    );
    const result = await publishSpots(spots, opts);
    expect(result).toEqual({ ok: false, reason: 'conflict', detail: 'Unprocessable' });
  });

  it('maps other statuses to other, including the API message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Server exploded' }), { status: 500 }))
    );
    const result = await publishSpots(spots, opts);
    expect(result).toEqual({ ok: false, reason: 'other', detail: 'Server exploded' });
  });

  it('maps a thrown/aborted fetch to network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted', 'AbortError');
      })
    );
    const result = await publishSpots(spots, opts);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('network');
  });

  it('returns ok:true with the inbox path on 201', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 201 })));
    const result = await publishSpots(spots, opts);
    expect(result).toEqual({ ok: true, path: 'spots-inbox/spots-1.json' });
  });
});
