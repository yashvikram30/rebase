"use client";
import { useEffect, useRef, useState } from "react";
import { MIN_HYPOTHESIS } from "@/lib/agent-constants";
import { splitReply } from "@/lib/agent-reply";
import { recordEvent, updateChat, useChats } from "@/lib/workbench-store";
import { Diff } from "../debug/results";
import { useNowSeconds } from "./use-now";

/** The wall clock, read outside the component so event handlers can stamp their messages. */
const nowMs = () => Date.now();

type Props = {
  scenarioId: string;
  files: Record<string, string>;
  testOutput: string;
  onApply: (file: string, code: string) => void;
};

/** The limited chat with the assistant: a few messages, hints only, never the fix. */
export function ChatPanel({ scenarioId, files, testOutput, onApply }: Props) {
  const chat = useChats()[scenarioId];
  const round = chat?.round;
  const messages = chat?.messages ?? [];
  const editable = Object.keys(files);
  const now = useNowSeconds();

  const [draft, setDraft] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  const left = round ? round.cap - round.used : 0;
  const ended = !!round && now > 0 && round.exp <= now * 1000;
  const minutes = round && now > 0 ? Math.max(0, Math.ceil((round.exp - now * 1000) / 60_000)) : null;
  const live = !!round && !ended && left > 0;

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/debug/round", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.token) return setError(data?.error ?? "Could not start the chat. Try again.");
      updateChat(scenarioId, (c) => ({
        ...c,
        round: { token: data.token, exp: data.exp, cap: data.cap, used: 0 },
      }));
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function send(phase: "explore" | "fix") {
    const text = draft.trim() || (phase === "fix" ? "Is my hypothesis right?" : "");
    const why = phase === "fix" ? hypothesis.trim() : undefined;
    if (!text || !round || !live || busy) return;
    const at = nowMs();
    const history = [...messages, { role: "user" as const, content: text, at }];
    setBusy(true);
    setError("");
    updateChat(scenarioId, (c) => ({ ...c, messages: history }));
    recordEvent(scenarioId, { at, type: "chat-user", phase, text, hypothesis: why });
    setDraft("");
    try {
      const res = await fetch("/api/debug/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: round.token,
          phase,
          hypothesis: why,
          messages: history.slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 3000) })),
          files,
          testOutput: testOutput ? testOutput.slice(-5000) : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.reply !== "string") {
        // The message did not count, so take it back out of the conversation and give the text back.
        updateChat(scenarioId, (c) => ({
          ...c,
          messages: c.messages.filter((m) => m.at !== at),
          events: c.events.filter((e) => !(e.type === "chat-user" && e.at === at)),
          round: res.status === 429 && data?.remaining === 0 ? { ...c.round!, used: c.round!.cap } : c.round,
        }));
        setDraft(text);
        return setError(data?.error ?? "Something went wrong. Try again.");
      }
      const patches = splitReply(data.reply, editable)
        .filter((p) => p.kind === "patch")
        .map((p) => p.file);
      updateChat(scenarioId, (c) => ({
        ...c,
        round: { ...c.round!, used: data.used },
        messages: [...c.messages, { role: "assistant", content: data.reply, at: nowMs() }],
      }));
      recordEvent(scenarioId, { at: nowMs(), type: "chat-agent", text: data.reply, patches });
    } catch {
      updateChat(scenarioId, (c) => ({
        ...c,
        messages: c.messages.filter((m) => m.at !== at),
        events: c.events.filter((e) => !(e.type === "chat-user" && e.at === at)),
      }));
      setDraft(text);
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!round) {
    return (
      <aside className="wb-chat" aria-label="Assistant">
        <div className="wb-chat-intro">
          <h2>Assistant</h2>
          <p>
            Ask for hints while you debug. You get a few messages, and the assistant will not write a fix
            until you have said what you think is wrong.
          </p>
          <p className="wb-hint">
            Messages and your code are sent to a third-party AI service. Free models may keep what you send.
          </p>
          <button type="button" className="wb-btn is-primary" onClick={() => void start()} disabled={busy}>
            {busy ? "Starting…" : "Start chat"}
          </button>
          {error && (
            <p className="wb-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="wb-chat" aria-label="Assistant">
      <div className="wb-chat-head">
        <h2>Assistant</h2>
        <span className="wb-chat-budget" aria-live="polite">
          {ended ? "Round ended" : `${left} ${left === 1 ? "message" : "messages"} left`}
          {minutes !== null && !ended && ` · ${minutes} min`}
        </span>
      </div>

      <div className="wb-chat-log" role="log">
        {messages.length === 0 && (
          <p className="wb-hint">
            Describe what you see, or ask what a line does. The assistant gives hints, not fixes, and each question gets a little more specific.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={m.at + ":" + i} className={`wb-msg is-${m.role}`}>
            <p className="wb-msg-who">{m.role === "user" ? "You" : "Assistant"}</p>
            {m.role === "user" ? (
              <p className="wb-msg-text">{m.content}</p>
            ) : (
              splitReply(m.content, editable).map((part, j) =>
                part.kind === "text" ? (
                  <p key={j} className="wb-msg-text">
                    {part.text}
                  </p>
                ) : part.kind === "code" ? (
                  <pre key={j} className="wb-msg-code">
                    {part.code}
                  </pre>
                ) : (
                  <div key={j} className="wb-msg-patch">
                    {files[part.file] === part.code ? (
                      // Applied (or already identical): a diff against the current file would be empty.
                      <p className="wb-hint">
                        <code>{part.file}</code> now has this change. Run the tests to check it.
                      </p>
                    ) : (
                      <>
                        <Diff name={part.file} before={files[part.file] ?? ""} after={part.code} />
                        <button
                          type="button"
                          className="wb-btn"
                          onClick={() => {
                            onApply(part.file, part.code);
                            recordEvent(scenarioId, { at: nowMs(), type: "patch-applied", file: part.file });
                          }}
                        >
                          Apply patch
                        </button>
                      </>
                    )}
                  </div>
                ),
              )
            )}
          </div>
        ))}
        {busy && <p className="wb-hint">Thinking…</p>}
        <div ref={end} />
      </div>

      {error && (
        <p className="wb-error" role="alert">
          {error}
        </p>
      )}

      {live ? (
        <form
          className="wb-chat-in"
          onSubmit={(e) => {
            e.preventDefault();
            void send("explore");
          }}
        >
          <textarea
            value={draft}
            rows={3}
            maxLength={2000}
            aria-label="Message to the assistant"
            placeholder="Ask about the code or the test output"
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send("explore");
              }
            }}
          />
          <div className="wb-chat-actions">
            <button type="submit" className="wb-btn is-primary" disabled={busy || !draft.trim()}>
              Send
            </button>
          </div>
          <details className="wb-fix">
            <summary>Check my hypothesis</summary>
            <label>
              What do you think is wrong, and why?
              <textarea
                value={hypothesis}
                rows={3}
                maxLength={1500}
                placeholder="For example: the loop stops one window early because the range ends at n - k."
                onChange={(e) => setHypothesis(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="wb-btn"
              disabled={busy || hypothesis.trim().length < MIN_HYPOTHESIS}
              onClick={() => void send("fix")}
            >
              Check my hypothesis
            </button>
            {hypothesis.trim().length < MIN_HYPOTHESIS && (
              <p className="wb-hint">Write a sentence or two first.</p>
            )}
          </details>
        </form>
      ) : (
        <div className="wb-chat-in">
          <p className="wb-hint">
            {ended
              ? "This round has ended. Start a new one to keep chatting."
              : "You have used all your messages. Keep debugging on your own."}
          </p>
          {ended && (
            <button type="button" className="wb-btn" onClick={() => void start()} disabled={busy}>
              Start a new round
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
