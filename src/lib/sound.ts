// Small Web Audio module — no assets. Everything here is gated by `enabled`
// (persisted to localStorage, default ON) and the AudioContext is created
// lazily on first use (browsers block it before a user gesture) and reused.

const STORAGE_KEY = 'goaguesser-sound';

let enabled = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) !== 'off' : true;
let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, startTime: number, duration: number, type: OscillatorType, peakGain: number) {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  // Exponential ramps can't target 0, so envelope bottoms out just above it.
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export function isSoundOn(): boolean {
  return enabled;
}

export function setSoundOn(on: boolean): void {
  enabled = on;
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
}

const NEAR_M = 100;
const FAR_M = 15000;
const NEAR_MISS_M = 1000;

/**
 * Short two-note chime on reveal. Pitch falls with distance — 880Hz at or
 * inside the 100m ring, down to 180Hz at 15km+. Near-misses (<=1km) get a
 * second note a fifth above, slightly after the first.
 */
export function playReveal(distanceM: number): void {
  if (!enabled) return;
  const c = getCtx();
  const now = c.currentTime;
  const t = Math.max(0, Math.min(1, (distanceM - NEAR_M) / (FAR_M - NEAR_M)));
  const freq = 880 - t * (880 - 180);
  tone(freq, now, 0.25, 'triangle', 0.22);
  if (distanceM <= NEAR_MISS_M) {
    tone(freq * 1.5, now + 0.09, 0.25, 'triangle', 0.16); // a fifth above
  }
}

/** A 30ms soft tick on pin drop. */
export function playPin(): void {
  if (!enabled) return;
  const c = getCtx();
  tone(720, c.currentTime, 0.03, 'sine', 0.1);
}
