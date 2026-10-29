import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const good = [
  '{"at":"2026-10-28T23:00:06+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  '{"at":"2026-10-29T01:30:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-29T04:00:01+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}',
];

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), good.join('\n') + '\n');
  writeFileSync(join(runsDir, '2026-10-26.jsonl'), '');
  writeFileSync(join(runsDir, '2026-10-25.jsonl'), [good[0], 'not json', good[2]].join('\n') + '\n');
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const page = (night: string) => app.request(`/digest/${night}`);
const json = (night: string) => app.request(`/api/digest/${night}`);

describe('digest page', () => {
  it('renders a good night', async () => {
    const res = await page('2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest 2026-10-28');
    expect(html).toContain('fixtures/refresh');
  });

  it('404s for a night with no file', async () => {
    const res = await page('2026-10-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for 2026-10-01');
  });

  it('says nothing ran on an empty night', async () => {
    const res = await page('2026-10-26');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('flags a bad line and still renders the good rows', async () => {
    const html = await (await page('2026-10-25')).text();
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('lane/sync');
    expect(html).toContain('notes/backup');
  });
});

describe('digest JSON', () => {
  it('returns a good night', async () => {
    const res = await json('2026-10-28');
    const body = (await res.json()) as { night: string; badLines: number; rows: unknown[] };
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(0);
    expect(body.rows).toHaveLength(3);
  });

  it('404s for a night with no file', async () => {
    const res = await json('2026-10-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '2026-10-01' });
  });

  it('has no rows on an empty night', async () => {
    const res = await json('2026-10-26');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the good rows', async () => {
    const body = (await (await json('2026-10-25')).json()) as { badLines: number; rows: unknown[] };
    expect(body.badLines).toBe(1);
    expect(body.rows).toHaveLength(2);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await page('2026-10-28')).text();
    const body = (await (await json('2026-10-28')).json()) as { rows: { job: string }[] };
    const jobs = body.rows.map((r) => r.job);
    const positions = jobs.map((j) => html.indexOf(`<td>${j}</td>`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html.match(/<td>[a-z]+\/[a-z-]+<\/td>/g)).toHaveLength(jobs.length);
  });
});
