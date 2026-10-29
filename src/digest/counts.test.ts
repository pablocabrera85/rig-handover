import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countNight } from './counts.js';

describe('countNight', () => {
  it('counts good lines by status, skips bad lines, null when missing', () => {
    const dir = mkdtempSync(join(process.cwd(), 'counts-'));
    const l = (status: string) => JSON.stringify({ at: 'x', job: 'j', status, owner: null });
    writeFileSync(join(dir, '2026-01-01.jsonl'), [l('ok'), l('retry'), 'garbage', l('ok'), l('fail')].join('\n'));
    expect(countNight(dir, '2026-01-01')).toEqual({ ok: 2, retry: 1, fail: 1 });
    expect(countNight(dir, '2026-01-02')).toBeNull();
    rmSync(dir, { recursive: true });
  });
});
