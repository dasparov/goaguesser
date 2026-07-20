// One-tap "Publish" flow: sends kept spots straight into the existing
// spots-inbox/*.json pipeline (see .github/workflows/import-spots.yml) via the
// GitHub Contents API, so curators never have to download/upload a file by hand.

const STORAGE_KEY = 'goaguesser-gh-token';

export interface GhConfig {
  repo: string; // "owner/name"
  token: string;
}

/** Reads the curator's GitHub token from localStorage. Never throws — a missing
 *  or inaccessible (private-mode) store just yields no token. */
export function loadGhToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Persists the GitHub token. Best-effort — a blocked store silently no-ops. */
export function saveGhToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

/** Forgets the stored GitHub token. */
export function forgetGhToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type PublishResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'no-token' | 'bad-token' | 'forbidden' | 'conflict' | 'network' | 'other'; detail?: string };

/** Default target repo: override via VITE_GH_REPO, otherwise the game's own repo. */
export const DEFAULT_REPO: string =
  (import.meta.env.VITE_GH_REPO as string | undefined) || 'dasparov/goaguesser';

/** Builds the spots-inbox filename for a publish, from a timestamp (ms since epoch). */
export function makeInboxFilename(timestamp: number = Date.now()): string {
  return `spots-${timestamp}.json`;
}

/** UTF-8-safe base64 encoding — plain btoa(str) mangles non-Latin1 characters
 *  (accented names etc.), so we go through TextEncoder first. */
function base64EncodeUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

const TIMEOUT_MS = 10_000;

async function extractErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  } catch {
    // no JSON body — leave detail undefined
  }
  return undefined;
}

type FailureReason = Extract<PublishResult, { ok: false }>['reason'];

function reasonForStatus(status: number): FailureReason {
  if (status === 401) return 'bad-token';
  if (status === 403) return 'forbidden';
  if (status === 409 || status === 422) return 'conflict';
  return 'other';
}

/** Validates a token against the target repo with a cheap authenticated GET.
 *  Used by the setup panel before the token is stored. */
export async function verifyGhToken(repo: string, token: string): Promise<PublishResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });
    if (response.ok) return { ok: true, path: repo };
    const detail = await extractErrorMessage(response);
    return { ok: false, reason: reasonForStatus(response.status), detail };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

/** Publishes kept spots by creating one file under spots-inbox/ via the GitHub
 *  Contents API — the existing import-spots.yml Action picks it up from there. */
export async function publishSpots(
  spots: Array<{ imageId: string; name?: string }>,
  opts: { repo: string; token: string; filename: string }
): Promise<PublishResult> {
  const { repo, token, filename } = opts;
  if (!token) return { ok: false, reason: 'no-token' };

  const payload = spots.map((s) => (s.name ? { imageId: s.imageId, name: s.name } : { imageId: s.imageId }));
  const content = base64EncodeUtf8(JSON.stringify(payload, null, 2));
  const path = `spots-inbox/${filename}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `spots: ${spots.length} spots from the curator`,
        content,
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      return { ok: true, path };
    }

    const detail = await extractErrorMessage(response);
    return { ok: false, reason: reasonForStatus(response.status), detail };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
