// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One line of runs/<night>.jsonl, after parsing at the edge. */
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One row per job for the night. Times keep the log's offset, never converted to UTC. */
export type DigestRow = {
  job: string;
  /** Owner on the job's last line; `null` renders as `—`. */
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  /** Most recent error seen for the job, even if a later run was ok. */
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  /** Sorted by job. */
  rows: DigestRow[];
  /** Lines that did not parse. Counted, never thrown. */
  badLines: number;
};

/** A night is `YYYY-MM-DD`; anything else is not a night. */
export const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

/** Returns `null` when the night has no file (or is not a night). An empty file is a Night with no rows. */
export type ReadNight = (runsDir: string, night: string) => Night | null;
