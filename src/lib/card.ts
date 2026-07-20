import { formatDistance, MAX_GAME_POINTS } from './score';
import { formatPoints } from './share';

const CARD_BG = '#0A141D';
const CARD_INK = '#E6EDF5';
const CARD_INK_SOFT = '#9BB0C4';
const CARD_INK_FAINT = '#63798E';
const CARD_AZULEJO = '#79A5E8';
const CARD_AZULEJO_HIGHLIGHT = 'rgba(121, 165, 232, 0.14)';
const CARD_LATERITE = '#E8674A';
const DISPLAY_FONT = '"Palatino Linotype", "Book Antiqua", Palatino, "Iowan Old Style", Georgia, serif';
const MONO_FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const MARGIN = 80;
const HEADER_H = 560;
const STANDINGS_ROW_H = 52;
const ROUND_ROW_H = 46;
const FOOTER_H = 90;

export async function renderShareCard(opts: {
  total: number;
  rank: string;
  bar: string;
  rounds: Array<{ name: string; distanceM: number; points: number }>;
  standings: Array<{ position: number; name: string | null; total: number; isMe: boolean }>;
}): Promise<Blob> {
  const standingsH = opts.standings.length * STANDINGS_ROW_H + 60;
  const roundsH = opts.rounds.length * ROUND_ROW_H + 60;

  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = HEADER_H + standingsH + roundsH + FOOTER_H;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = CARD_BG;
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = CARD_AZULEJO;
  ctx.font = `bold 56px ${MONO_FONT}`;
  ctx.fillText('BACKYARD: GOA', MARGIN, 130);

  ctx.fillStyle = CARD_INK;
  ctx.font = `italic 44px ${DISPLAY_FONT}`;
  ctx.fillText(opts.rank, MARGIN, 190);

  ctx.fillStyle = CARD_INK;
  ctx.font = `900 150px ${MONO_FONT}`;
  ctx.fillText(formatPoints(opts.total), MARGIN, 360);
  ctx.fillStyle = CARD_INK_FAINT;
  ctx.font = `bold 36px ${MONO_FONT}`;
  ctx.fillText(`/ ${formatPoints(MAX_GAME_POINTS)}`, MARGIN, 410);

  ctx.font = '64px system-ui, sans-serif';
  ctx.fillText(opts.bar, MARGIN, 500);

  ctx.fillStyle = CARD_INK_FAINT;
  ctx.font = `bold 28px ${MONO_FONT}`;
  ctx.fillText('STANDINGS', MARGIN, 580);

  let y = HEADER_H + 30;
  for (const s of opts.standings) {
    if (s.isMe) {
      ctx.fillStyle = CARD_AZULEJO_HIGHLIGHT;
      ctx.fillRect(MARGIN - 20, y - 34, 1080 - 2 * MARGIN + 40, 46);
    }
    ctx.fillStyle = s.position === 1 ? CARD_AZULEJO : CARD_INK_SOFT;
    ctx.font = `bold 30px ${MONO_FONT}`;
    ctx.fillText(`${s.position}${s.position === 1 ? ' 🏆' : ''}  ${s.name ?? 'Player'}`, MARGIN, y);
    ctx.textAlign = 'right';
    ctx.fillText(formatPoints(s.total), 1080 - MARGIN, y);
    ctx.textAlign = 'left';
    y += STANDINGS_ROW_H;
  }

  y += 30;
  ctx.fillStyle = CARD_INK_FAINT;
  ctx.font = `bold 28px ${MONO_FONT}`;
  ctx.fillText('THIS RUN', MARGIN, y);
  y += 44;
  ctx.font = `26px ${MONO_FONT}`;
  for (const r of opts.rounds) {
    ctx.fillStyle = CARD_INK_SOFT;
    ctx.fillText(r.name, MARGIN, y);
    ctx.fillStyle = CARD_LATERITE;
    ctx.fillText(`${formatDistance(r.distanceM)} · +${formatPoints(r.points)}`, 620, y);
    y += ROUND_ROW_H;
  }

  ctx.fillStyle = CARD_INK_FAINT;
  ctx.font = `26px ${MONO_FONT}`;
  ctx.fillText('Add your score — play the link!', MARGIN, c.height - 40);

  return new Promise((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));
}
