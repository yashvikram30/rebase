"use client";
import type { CSSProperties } from "react";
import type { SuiteResult } from "@/lib/debug-sandbox";
import { diffStats, lineDiff, withContext } from "@/lib/line-diff";
import { parseUnittest, prettyTestName } from "@/lib/unittest-report";

const SIGN = { add: "+", del: "−", same: " " } as const;

export function Diff({ name, before, after }: { name: string; before: string; after: string }) {
  const diff = lineDiff(before, after);
  const { added, removed } = diffStats(diff);
  return (
    <figure className="dbg-diff">
      <figcaption>
        <code>{name}</code>
        <span>
          <b className="add">+{added}</b>
          <b className="del">−{removed}</b>
        </span>
      </figcaption>
      <pre>
        <code>
          {withContext(diff, 2).map((it, i) =>
            it.kind === "gap" ? (
              <span key={i} className="gap">
                {it.count} unchanged {it.count === 1 ? "line" : "lines"}
              </span>
            ) : (
              <span key={i} className={`ln ${it.kind}`} data-sign={SIGN[it.kind]}>
                {it.text}
              </span>
            ),
          )}
        </code>
      </pre>
    </figure>
  );
}

export function TestRun({ label, r }: { label: string; r: SuiteResult }) {
  const tests = parseUnittest(r.output);
  const passed = tests.filter((t) => t.status === "pass").length;
  const summary = r.timedOut
    ? "timed out"
    : tests.length
      ? `${passed} of ${tests.length} passed`
      : r.ok
        ? "passed"
        : "failed";
  return (
    <div className={"dbg-run " + (r.ok ? "is-pass" : "is-fail")}>
      <p className="dbg-run-head">
        <span aria-hidden="true">{r.ok ? "✓" : "✗"}</span>
        <strong>{label}</strong>
        <span className="dbg-run-sum">{summary}</span>
      </p>
      {tests.length > 0 && (
        <ul>
          {tests.map((t, i) => (
            <li key={t.name} className={`is-${t.status}`} style={{ "--i": i } as CSSProperties}>
              <span aria-hidden="true">{t.status === "pass" ? "✓" : t.status === "skip" ? "–" : "✗"}</span>
              <span className="dbg-sr">{t.status}: </span>
              {prettyTestName(t.name)}
            </li>
          ))}
        </ul>
      )}
      {(!r.ok || tests.length === 0) && (
        <details>
          <summary>Full output</summary>
          <pre>{r.output}</pre>
        </details>
      )}
    </div>
  );
}
