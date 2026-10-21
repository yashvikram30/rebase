"use client";
import { useRef, useState } from "react";
import type { SuiteResult } from "@/lib/debug-sandbox";

type Entry = { code: string; out: string; ok: boolean };

/** A small console: type Python and see what it prints. The project is imported, and names persist until a file changes. */
export function Terminal({ exec }: { exec: (code: string) => Promise<SuiteResult> }) {
  const [log, setLog] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recall, setRecall] = useState(-1);
  const end = useRef<HTMLDivElement>(null);

  async function submit() {
    const code = text.trim();
    if (!code || busy) return;
    setText("");
    setRecall(-1);
    setBusy(true);
    const r = await exec(code);
    setLog((l) => [...l, { code, out: r.output, ok: r.ok }]);
    setBusy(false);
    queueMicrotask(() => end.current?.scrollIntoView({ block: "end" }));
  }

  function history(dir: -1 | 1) {
    const past = log.map((l) => l.code);
    if (!past.length) return;
    const next = Math.min(
      past.length - 1,
      Math.max(-1, recall === -1 && dir === -1 ? past.length - 1 : recall + dir),
    );
    setRecall(next);
    setText(next === -1 ? "" : past[next]);
  }

  return (
    <div className="wb-term">
      <div className="wb-term-log" role="log" aria-live="polite">
        {log.length === 0 && (
          <p className="wb-hint">
            Your code is already imported, so call it directly and print what you need. Names stay until you
            change a file.
          </p>
        )}
        {log.map((l, i) => (
          <div key={i} className={"wb-term-entry" + (l.ok ? "" : " is-error")}>
            <pre className="wb-term-cmd">{l.code}</pre>
            {l.out && <pre className="wb-term-out">{l.out}</pre>}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="wb-term-in"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <span aria-hidden="true">&gt;&gt;&gt;</span>
        <textarea
          value={text}
          rows={1}
          spellCheck={false}
          aria-label="Python command"
          placeholder={busy ? "Running…" : "Type Python, Enter to run, Shift+Enter for a new line"}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            } else if (e.key === "ArrowUp" && !text.includes("\n")) {
              e.preventDefault();
              history(-1);
            } else if (e.key === "ArrowDown" && recall !== -1) {
              e.preventDefault();
              history(1);
            }
          }}
        />
        {log.length > 0 && (
          <button type="button" onClick={() => setLog([])}>
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
