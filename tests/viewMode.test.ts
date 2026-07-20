import { describe, it, expect } from 'vitest';
import { loadViewMode, paneFlex } from '../src/lib/viewMode';

describe('viewMode', () => {
  describe('loadViewMode', () => {
    it('defaults to split when localStorage is unavailable (node test env)', () => {
      expect(loadViewMode()).toBe('split');
    });
  });

  describe('paneFlex', () => {
    it('fills the panorama and collapses the map in pano mode', () => {
      expect(paneFlex('pano', false)).toEqual({ pano: 1, map: 0 });
      expect(paneFlex('pano', true)).toEqual({ pano: 1, map: 0 });
    });

    it('fills the map and collapses the panorama in map mode', () => {
      expect(paneFlex('map', false)).toEqual({ pano: 0, map: 1 });
      expect(paneFlex('map', true)).toEqual({ pano: 0, map: 1 });
    });

    it('keeps today\'s split proportions while playing', () => {
      expect(paneFlex('split', false)).toEqual({ pano: 1.25, map: 1 });
    });

    it('keeps the existing reveal-time shift once scored', () => {
      expect(paneFlex('split', true)).toEqual({ pano: 0.85, map: 1.4 });
    });
  });
});
