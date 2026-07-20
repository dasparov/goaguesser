/**
 * Free link shortening via TinyURL's keyless API — verified to send CORS
 * headers for our origin. Strictly a progressive enhancement: any failure,
 * slowness, or odd response falls back to the original URL, so sharing
 * never depends on TinyURL being alive.
 */
const API = 'https://tinyurl.com/api-create.php?url=';
const TIMEOUT_MS = 2500;

export async function shortenUrl(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(API + encodeURIComponent(url), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return url;
    const short = (await res.text()).trim();
    return short.startsWith('https://tinyurl.com/') ? short : url;
  } catch {
    return url;
  }
}
