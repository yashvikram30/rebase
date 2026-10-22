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
  /** Earlier reports for this case, newest first, kept when a new review replaces `report`. */
  history?: StoredReport[];
  /** A review being written (or that failed), so the report page can show progress or an error. */
  review?: { at: number; explanation: string; error?: string };
};
export type Chats = Record<string, Chat>;

const MAX_MESSAGES = 60;
export const MAX_HISTORY = 20;
const MAX_TEXT = 4000;

/** Light check only: the report came from our own server. A malformed one is dropped, not shown. */
function cleanReport(rep: StoredReport | null | undefined): StoredReport | undefined {
  return rep &&
    Number.isFinite(rep.at) &&
    typeof rep.report?.summary === "string" &&
    rep.report.dimensions &&
    Array.isArray(rep.course)
    ? rep
    : undefined;
}

/** Every review of a case, newest first. */
export const allReports = (c: Chat | undefined): StoredReport[] =>
  c?.report ? [c.report, ...(c.history ?? [])] : [];

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
    const report = cleanReport(c.report);
    const history = (Array.isArray(c.history) ? c.history : [])
      .map(cleanReport)
      .filter((r): r is StoredReport => !!r)
      .slice(0, MAX_HISTORY);
    const rv = c.review;
    const review =
      rv && Number.isFinite(rv.at) && typeof rv.explanation === "string"
        ? {
            at: rv.at,
            explanation: rv.explanation.slice(0, 1500),
            ...(typeof rv.error === "string" ? { error: rv.error.slice(0, 300) } : {}),
          }
        : undefined;
    out[id] = {
      ...(round ? { round } : {}),
      ...(report ? { report } : {}),
      ...(history.length > 0 ? { history } : {}),
      ...(review ? { review } : {}),
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
 * The round (so the message budget cannot be refilled by reopening) and the reports are kept. The timeline is
 * restarted separately, by `restartTimeline`.
 */
export function resetChatLog(id: string) {
  const c = chats.get()[id];
  if (c && c.messages.length > 0) updateChat(id, (x) => ({ ...x, messages: [] }));
}

/**
 * Starts a fresh timeline for a case, with an "open" entry, so the next review looks only at what happens from
 * here: called when the case is opened and when it is reset. Earlier reviews keep their own timeline.
 */
export function restartTimeline(id: string) {
  const at = Date.now();
  updateChat(id, (c) => ({ ...c, events: [{ at, type: "open" }], started: at }));
}

export function clearChat(id: string) {
  const { [id]: _removed, ...rest } = chats.get();
  void _removed;
  chats.set(rest);
}
