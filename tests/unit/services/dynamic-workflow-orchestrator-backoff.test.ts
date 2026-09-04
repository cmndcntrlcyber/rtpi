import { describe, it, expect } from 'vitest';
import { calculateBackoffDelay } from '../../../server/services/dynamic-workflow-orchestrator';

describe('calculateBackoffDelay', () => {
  describe('default parameters (baseDelay=1000, multiplier=2, maxDelay=60000)', () => {
    it('should return baseDelay on first attempt', () => {
      expect(calculateBackoffDelay(1)).toBe(1000);
    });

    it('should double the delay on second attempt', () => {
      expect(calculateBackoffDelay(2)).toBe(2000);
    });

    it('should quadruple the delay on third attempt', () => {
      expect(calculateBackoffDelay(3)).toBe(4000);
    });

    it('should compute 2^(n-1) * baseDelay for attempt n', () => {
      expect(calculateBackoffDelay(4)).toBe(8000);
      expect(calculateBackoffDelay(5)).toBe(16000);
      expect(calculateBackoffDelay(6)).toBe(32000);
    });

    it('should cap at maxDelayMs (60000)', () => {
      expect(calculateBackoffDelay(7)).toBe(60000);
      expect(calculateBackoffDelay(10)).toBe(60000);
      expect(calculateBackoffDelay(100)).toBe(60000);
    });
  });

  describe('custom parameters', () => {
    it('should respect custom baseDelayMs', () => {
      expect(calculateBackoffDelay(1, 500)).toBe(500);
      expect(calculateBackoffDelay(2, 500)).toBe(1000);
      expect(calculateBackoffDelay(3, 500)).toBe(2000);
    });

    it('should respect custom multiplier', () => {
      expect(calculateBackoffDelay(1, 1000, 3)).toBe(1000);
      expect(calculateBackoffDelay(2, 1000, 3)).toBe(3000);
      expect(calculateBackoffDelay(3, 1000, 3)).toBe(9000);
    });

    it('should respect custom maxDelayMs', () => {
      expect(calculateBackoffDelay(1, 1000, 2, 5000)).toBe(1000);
      expect(calculateBackoffDelay(2, 1000, 2, 5000)).toBe(2000);
      expect(calculateBackoffDelay(3, 1000, 2, 5000)).toBe(4000);
      expect(calculateBackoffDelay(4, 1000, 2, 5000)).toBe(5000);
    });

    it('should work with multiplier of 1 (constant delay)', () => {
      expect(calculateBackoffDelay(1, 1000, 1)).toBe(1000);
      expect(calculateBackoffDelay(5, 1000, 1)).toBe(1000);
      expect(calculateBackoffDelay(100, 1000, 1)).toBe(1000);
    });
  });

  describe('edge cases', () => {
    it('should handle attempt=0 (returns baseDelay/multiplier)', () => {
      const result = calculateBackoffDelay(0);
      expect(result).toBe(500);
    });

    it('should handle very large attempt numbers without exceeding maxDelay', () => {
      const result = calculateBackoffDelay(1000);
      expect(result).toBe(60000);
      expect(result).toBeLessThanOrEqual(60000);
    });

    it('should handle fractional multipliers', () => {
      expect(calculateBackoffDelay(1, 1000, 1.5)).toBe(1000);
      expect(calculateBackoffDelay(2, 1000, 1.5)).toBe(1500);
      expect(calculateBackoffDelay(3, 1000, 1.5)).toBe(2250);
    });

    it('should return maxDelayMs when baseDelay exceeds it', () => {
      expect(calculateBackoffDelay(1, 100000, 2, 5000)).toBe(5000);
    });
  });
});
