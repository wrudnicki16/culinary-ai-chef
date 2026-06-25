import { describe, it, expect } from 'vitest';
import { selectStaleJobIds } from '@/lib/generation/reaper';

const NOW = 1_000_000_000_000;
const TTL = 5 * 60 * 1000; // 5 min

describe('selectStaleJobIds', () => {
  it('returns active jobs older than the ttl', () => {
    const jobs = [
      { id: 1, status: 'processing' as const, updatedAt: new Date(NOW - TTL - 1) },
      { id: 2, status: 'pending' as const, updatedAt: new Date(NOW - 1000) },
      { id: 3, status: 'processing' as const, updatedAt: new Date(NOW - TTL) },
    ];
    expect(selectStaleJobIds(jobs, NOW, TTL)).toEqual([1, 3]);
  });

  it('never selects terminal jobs even if old', () => {
    const jobs = [
      { id: 4, status: 'done' as const, updatedAt: new Date(NOW - TTL - 99999) },
      { id: 5, status: 'error' as const, updatedAt: new Date(NOW - TTL - 99999) },
    ];
    expect(selectStaleJobIds(jobs, NOW, TTL)).toEqual([]);
  });
});
