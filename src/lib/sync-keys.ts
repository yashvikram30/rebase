/** The localStorage keys that follow a signed-in user across devices. Theme and banner snoozes stay per device. */
export const SYNC_KEYS = [
  "csplan.v1",
  "csplan.plan",
  "csplan.brain",
  "csplan.clips",
  "csplan.cards",
  "csplan.revise",
  "csplan.debug",
  "csplan.debug.drafts",
  "csplan.striver",
] as const;
export type SyncKey = (typeof SYNC_KEYS)[number];

export const isSyncKey = (k: unknown): k is SyncKey => (SYNC_KEYS as readonly unknown[]).includes(k);

/** MongoDB documents top out at 16 MB; stay well under that. */
export const MAX_VALUE_BYTES = 12_000_000;
