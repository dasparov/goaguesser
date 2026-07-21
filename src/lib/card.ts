import { MAX_GAME_POINTS, type DistanceScale } from './score';
import { formatPoints, ordinal } from './share';

// The share card is a fixed "printed survey chart on sand" — it always uses
// the warm light palette regardless of the app's active theme (docs/superpowers/
// specs/visual-identity.md, "Signature: the shot-group share card").
const CARD_SAND = '#A9B0A1';
const CARD_INK = '#2B2820';
const CARD_INK_SOFT = '#4C473C';
const CARD_INK_FAINT = '#6E695C';
const CARD_AZULEJO = '#2B2820';
const CARD_LATERITE = '#9E4A40';
const DISPLAY_FONT = '"Palatino Linotype", "Book Antiqua", Palatino, "Iowan Old Style", Georgia, serif';
const MONO_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const W = 1080;
// Extra vertical room reserved for the caption line under the target chart
// ("5 rounds · ✕ plotted by distance from the answer") — added to the base
// height and to every Y offset below it, so the rank/score/standings block
// keeps its original spacing instead of crowding upward into the caption.
const CAPTION_GAP = 36;
const BASE_H = 1080 + CAPTION_GAP;
const MARGIN = 80;
const STANDINGS_ROW_H = 56;
const STANDINGS_VISIBLE = 3;

// Ring / shot radial scale: miss-distance thresholds mapped to fractions of
// the chart's outer radius R, piecewise-linear between stops.
// The four ring fractions of the chart radius, inner→outer.
const RING_FRACS = [0.25, 0.5, 0.75, 1];

// Miss-distance → radius-fraction breakpoints for a mode's scale: the
// full-points zone plus the four ring distances at their fixed fractions.
function radiusStopsFor(scale: DistanceScale): Array<[number, number]> {
  return [
    [0, 0],
    [scale.fullWithinM, 0.06],
    ...scale.ringStops.map((s, i): [number, number] => [s[0], RING_FRACS[i]]),
  ];
}

function scaledRadius(m: number, R: number, stops: Array<[number, number]>): number {
  if (m <= 0) return 0;
  const last = stops[stops.length - 1][0];
  if (m >= last) return R;
  for (let i = 1; i < stops.length; i++) {
    const [m0, f0] = stops[i - 1];
    const [m1, f1] = stops[i];
    if (m <= m1) {
      const t = (m - m0) / (m1 - m0);
      return (f0 + t * (f1 - f0)) * R;
    }
  }
  return R;
}

/** Card-local distance format — spec example is "avg miss 1.4 km" (no " away" suffix). */
function formatMiss(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Manual letter-spacing: canvas `letterSpacing` isn't universally supported. */
function fillTextSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

/** Visual width of `fillTextSpaced`'s output — sum of glyph widths plus the
 *  inter-glyph spacing (no trailing spacing after the last glyph). */
function measureSpaced(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width;
  return w + spacing * Math.max(0, text.length - 1);
}

/**
 * The same flat geometric trophy as `Trophy.svelte`, drawn with canvas paths
 * instead of the 🏆 glyph (docs/superpowers/specs/visual-identity.md,
 * "Iconography — no emoji in the UI"). `(x, y)` is the top-left corner of a
 * `size`×`size` box; `color` fills solid, no outline/gradient.
 */
function drawTrophy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  const s = size / 24; // local shapes are authored on a 24-unit grid
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;

  // bowl
  roundRectPath(ctx, 7, 4, 10, 8, 1.5);
  ctx.fill();

  // left handle (crescent)
  ctx.beginPath();
  ctx.arc(7, 8.5, 3, Math.PI * 0.5, Math.PI * 1.5, false);
  ctx.arc(7, 8.5, 1.5, Math.PI * 1.5, Math.PI * 0.5, true);
  ctx.closePath();
  ctx.fill();

  // right handle (crescent)
  ctx.beginPath();
  ctx.arc(17, 8.5, 3, Math.PI * 1.5, Math.PI * 0.5, false);
  ctx.arc(17, 8.5, 1.5, Math.PI * 0.5, Math.PI * 1.5, true);
  ctx.closePath();
  ctx.fill();

  // stem
  ctx.fillRect(11, 12, 2, 4);

  // wide base
  roundRectPath(ctx, 9, 16, 6, 1.5, 0.5);
  ctx.fill();
  roundRectPath(ctx, 7, 17.5, 10, 1.5, 0.75);
  ctx.fill();

  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface ShareCardStandingRow {
  position: number;
  name: string | null;
  total: number;
  isMe: boolean;
}

export async function renderShareCard(opts: {
  /** Wordmark shown top-left, e.g. "IMSpatial · Delhi". */
  title: string;
  /** This player's real miss distances, in round order — plotted as shots. */
  distances: number[];
  rank: string;
  total: number;
  /** Perfect-game total (rounds × 5000); falls back to the 5-round Goa max. */
  maxGamePoints?: number;
  position: number;
  fieldSize: number;
  /** The mode's distance scale — drives the chart rings and shot radii. */
  scale: DistanceScale;
  standings: ShareCardStandingRow[];
}): Promise<Blob> {
  const roundCount = opts.distances.length;
  const maxPoints = opts.maxGamePoints ?? MAX_GAME_POINTS;
  const radiusStops = radiusStopsFor(opts.scale);
  const rows = opts.standings.slice(0, STANDINGS_VISIBLE);
  const height = BASE_H + Math.max(0, rows.length - 1) * STANDINGS_ROW_H;

  const c = document.createElement('canvas');
  c.width = W;
  c.height = height;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = CARD_SAND;
  ctx.fillRect(0, 0, W, height);

  // Drawn hairline border, matching the app's bordered cards.
  ctx.strokeStyle = CARD_INK;
  ctx.lineWidth = 3;
  roundRectPath(ctx, 8, 8, W - 16, height - 16, 16);
  ctx.stroke();

  // Header: serif-mono caps, letterspaced — wordmark left, round count right.
  ctx.fillStyle = CARD_INK_FAINT;
  ctx.font = `bold 24px ${MONO_FONT}`;
  fillTextSpaced(ctx, opts.title.toUpperCase(), MARGIN, 74, 3);
  const roundsLabel = `${roundCount} ROUNDS`;
  fillTextSpaced(ctx, roundsLabel, W - MARGIN - measureSpaced(ctx, roundsLabel, 3), 74, 3);

  // One-line explainer so a first-time viewer instantly gets the premise.
  ctx.fillStyle = CARD_INK_SOFT;
  ctx.font = `20px ${MONO_FONT}`;
  ctx.fillText('A street-view guessing game — pin the spot on the map, closer wins.', MARGIN, 112);

  // Chart: four concentric rings + this player's five shots.
  const R = 220;
  const cx = W / 2;
  const cy = 340;
  // Ink concentric rings — dark on the sage card, a clear contrast to the
  // brick-red ✕ shot markers. Inner rings strongest, fading outward.
  const ringAlpha = [0.95, 0.75, 0.6, 0.45];
  const RING_STOPS = opts.scale.ringStops.map(
    ([m, label], i): [number, string, number] => [m, label, ringAlpha[i]],
  );
  const labelAngle = (-45 * Math.PI) / 180;
  for (const [m, label, alpha] of RING_STOPS) {
    const r = scaledRadius(m, R, radiusStops);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(43, 40, 32, ${alpha})`; // ink rings, dark on sage
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = CARD_INK_SOFT;
    ctx.font = `15px ${MONO_FONT}`;
    ctx.fillText(label, cx + r * Math.cos(labelAngle) + 4, cy + r * Math.sin(labelAngle));
  }

  // Shots: deterministic angle per round so the same game always renders the
  // same card — i*72° − 90° plus a fixed 20° offset.
  for (let i = 0; i < opts.distances.length; i++) {
    const m = opts.distances[i];
    const r = scaledRadius(m, R, radiusStops);
    const angle = ((i * 72 - 90 + 20) * Math.PI) / 180;
    const sx = cx + r * Math.cos(angle);
    const sy = cy + r * Math.sin(angle);

    if (m <= opts.scale.ringStops[0][0]) {
      ctx.beginPath();
      ctx.arc(sx, sy, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(158, 74, 64, 0.28)'; // brick-red halo on a near-bullseye
      ctx.fill();
    }

    ctx.strokeStyle = CARD_LATERITE;
    ctx.lineWidth = 3;
    const s = 9;
    ctx.beginPath();
    ctx.moveTo(sx - s, sy - s);
    ctx.lineTo(sx + s, sy + s);
    ctx.moveTo(sx + s, sy - s);
    ctx.lineTo(sx - s, sy + s);
    ctx.stroke();
  }

  // Caption: directly under the rings, well clear of the rank block below.
  ctx.fillStyle = CARD_INK_FAINT;
  ctx.font = `15px ${MONO_FONT}`;
  ctx.fillText(`${roundCount} rounds · ✕ plotted by distance from the answer`, MARGIN, cy + R + 40);

  // Rank / score / accuracy.
  let y = 700 + CAPTION_GAP;
  ctx.fillStyle = CARD_INK;
  ctx.font = `italic 56px ${DISPLAY_FONT}`;
  ctx.fillText(opts.rank, MARGIN, y);

  y += 72;
  ctx.fillStyle = CARD_INK_SOFT;
  ctx.font = `bold 32px ${MONO_FONT}`;
  const scoreLine =
    `${formatPoints(opts.total)} / ${formatPoints(maxPoints)}` +
    (opts.fieldSize > 1 ? ` · ${ordinal(opts.position)} of ${opts.fieldSize}` : '');
  ctx.fillText(scoreLine, MARGIN, y);

  y += 58;
  const avgMiss = opts.distances.reduce((a, b) => a + b, 0) / opts.distances.length;
  ctx.fillStyle = CARD_LATERITE;
  ctx.font = `bold 28px ${MONO_FONT}`;
  ctx.fillText(`avg miss ${formatMiss(avgMiss)}`, MARGIN, y);

  // Standings (up to three rows; own row azulejo, drawn trophy on the leader).
  if (rows.length > 0) {
    y += 90;
    for (const row of rows) {
      ctx.fillStyle = row.isMe ? CARD_AZULEJO : CARD_INK_SOFT;
      ctx.font = `bold 30px ${MONO_FONT}`;
      ctx.textAlign = 'left';
      const label = `${row.position}. ${row.name ?? 'Player'}`;
      ctx.fillText(label, MARGIN, y);
      if (row.position === 1) {
        drawTrophy(ctx, MARGIN + ctx.measureText(label).width + 10, y - 22, 22, CARD_AZULEJO);
      }
      ctx.textAlign = 'right';
      ctx.fillText(formatPoints(row.total), W - MARGIN, y);
      ctx.textAlign = 'left';
      y += STANDINGS_ROW_H;
    }
  }

  // Footer invite — full-ink serif at a legible size (a play on IMSpatial).
  ctx.fillStyle = CARD_INK;
  ctx.font = `italic 34px ${DISPLAY_FONT}`;
  ctx.fillText("Think you're spatial? Show me!", MARGIN, height - 46);

  return new Promise((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));
}
