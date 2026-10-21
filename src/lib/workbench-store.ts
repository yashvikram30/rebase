"use client";
import type { StoredReport } from "./debug-report-types";
import { addEvent, type DebugEvent } from "./debug-session";
import { createLocalStore, useLocalStore } from "./local-store";

/** Work in progress on one case: the edited files and when the round started. */
export type Draft = { files: Record<string, string>; started: number; updated: number };
export type Drafts = Record<string, Draft>;

/** Keeps one draft well under the sync size limit, and the whole store bounded. */
const MAX_DRAFT_BYTES = 200_000;
const MAX_DRAFTS = 50;

export function normalizeDrafts(raw: unknown): Drafts {
  const out: Drafts = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw)) {
    const d = v as Partial<Draft> | null;
    if (
      !d ||
      typeof d.files !== "object" ||
      !d.files ||
      !Number.isFinite(d.started) ||
      !Number.isFinite(d.updated)
    )
      continue;
    const files: Record<string, string> = {};
    let bytes = 0;
    for (const [name, code] of Object.entries(d.files)) {
      if (typeof code !== "string") continue;
      bytes += name.length + code.length;
      files[name] = code;
    }
    if (bytes <= MAX_DRAFT_BYTES) out[id] = { files, started: d.started!, updated: d.updated! };
  }
  // Newest first, then trim.
  return Object.fromEntries(
    Object.entries(out)
      .sort(([, a], [, b]) => b.updated - a.updated)
      .slice(0, MAX_DRAFTS),
  );
}

const drafts = createLocalStore<Drafts>("csplan.debug.drafts", {}, normalizeDrafts);
export const useDrafts = () => useLocalStore(drafts);
export const getDraft = (id: string) => drafts.get()[id];

export function saveDraft(id: string, files: Record<string, string>, started: number) {
  drafts.set(normalizeDrafts({ ...drafts.get(), [id]: { files, started, updated: Date.now() } }));
}

export function clearDraft(id: string) {
  const { [id]: _removed, ...rest } = drafts.get();
  void _removed;
  drafts.set(rest);
}

/** Pane sizes in pixels. These are per device, so they are not synced. */
export type Layout = { explorer: number; panel: number; chat: number };
export const DEFAULT_LAYOUT: Layout = { explorer: 232, panel: 280, chat: 340 };
const LIMITS = { explorer: [160, 480], panel: [120, 640], chat: [260, 560] } as const;

const clamp = (n: unknown, [lo, hi]: readonly [number, number], fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;

export function normalizeLayout(raw: unknown): Layout {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Layout>;
  return {
    explorer: clamp(r.explorer, LIMITS.explorer, DEFAULT_LAYOUT.explorer),
    panel: clamp(r.panel, LIMITS.panel, DEFAULT_LAYOUT.panel),
    chat: clamp(r.chat, LIMITS.chat, DEFAULT_LAYOUT.chat),
  };
}

const layout = createLocalStore<Layout>("csplan.workbench.layout", DEFAULT_LAYOUT, normalizeLayout);
export const useLayout = () => useLocalStore(layout);
export const setLayout = (next: Layout) => layout.set(normalizeLayout(next));

/** A chat round: the signed token from the server, its message cap, and how many messages are used. */
export type Round = { token: string; exp: number; cap: number; used: number };
export type ChatMsg = { role: "user" | "assistant"; content: string; at: number };
/** Everything about one case's chat and timeline. Kept on this device. */
export type Chat = {
  round?: Round;
  messages: ChatMsg[];
  events: DebugEvent[];
  started: number;
  /** The mentor report, once the round has been finished. */
  report?: StoredReport;
};
export type Chats = Record<string, Chat>;

const MAX_MESSAGES = 60;
const MAX_TEXT = 4000;

export function normalizeChats(raw: unknown): Chats {
  const out: Chats = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, v] of Object.entries(raw)) {
    const c = v as Partial<Chat> | null;
    if (!c || !Number.isFinite(c.started) || !Array.isArray(c.messages) || !Array.isArray(c.events)) continue;
    const r = c.round;
    const round =
      r &&
      typeof r.token === "string" &&
      Number.isFinite(r.exp) &&
      Number.isInteger(r.cap) &&
      Number.isInteger(r.used)
        ? { token: r.token, exp: r.exp, cap: r.cap, used: r.used }
        : undefined;
    const messages = c.messages
      .filter(
        (m): m is ChatMsg =>
          !!m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          Number.isFinite(m.at),
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TEXT), at: m.at }))
      .slice(-MAX_MESSAGES);
    const events = (c.events as DebugEvent[]).filter(
      (e) => !!e && typeof e.type === "string" && Number.isFinite(e.at),
    );
    // Light check only: the report came from our own server. A malformed one is dropped, not shown.
    const rep = c.report;
    const report =
      rep &&
      Number.isFinite(rep.at) &&
      typeof rep.report?.summary === "string" &&
      rep.report.dimensions &&
      Array.isArray(rep.course)
        ? rep
        : undefined;
    out[id] = {
      ...(round ? { round } : {}),
      ...(report ? { report } : {}),
      messages,
      events,
      started: c.started!,
    };
  }
  return out;
}

const chats = createLocalStore<Chats>("csplan.debug.chat", {}, normalizeChats);
export const useChats = () => useLocalStore(chats);
export const getChat = (id: string) => chats.get()[id];

const blank = (): Chat => ({ messages: [], events: [], started: Date.now() });

export function updateChat(id: string, change: (c: Chat) => Chat) {
  const all = chats.get();
  chats.set(normalizeChats({ ...all, [id]: change(all[id] ?? blank()) }));
}

export function recordEvent(id: string, event: DebugEvent) {
  updateChat(id, (c) => ({ ...c, events: addEvent(c.events, event) }));
}

/**
 * Starts a fresh conversation for a case: the visible log and the history sent to the model are emptied.
 * The round (so the message budget cannot be refilled by reopening), the event timeline and the report are
 * kept, because the end-of-round review reads the timeline, not this log.
 */
export function resetChatLog(id: string) {
  const c = chats.get()[id];
  if (c && c.messages.length > 0) updateChat(id, (x) => ({ ...x, messages: [] }));
}

export function clearChat(id: string) {
  const { [id]: _removed, ...rest } = chats.get();
  void _removed;
  chats.set(rest);
}
