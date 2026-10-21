import { DIMENSIONS } from "@/lib/debug-report-types";

const STEPS = [
  "Replaying how you worked",
  "Reading your diff",
  "Checking your explanation against the real cause",
  "Choosing what to revisit",
];

const bars = (widths: number[]) =>
  widths.map((w, i) => <i key={i} className="rsk-bar" style={{ width: `${w}%` }} />);

/**
 * What the report page shows while the review is being written. It mirrors the real report, section by section,
 * with the real section titles and the six real rating areas, so the page does not jump when the report lands.
 */
export function ReportSkeleton() {
  return (
    <div className="dbg-report rsk" role="status" aria-live="polite" aria-label="Writing your review">
      <div className="rsk-status">
        <span className="rsk-spin" aria-hidden="true" />
        <div>
          <p className="rsk-title">Writing your review</p>
          <p className="rsk-sub">
            It reads your timeline, your diff and your explanation. This usually takes under a minute.
          </p>
        </div>
      </div>
      <ol className="rsk-steps">
        {STEPS.map((s, i) => (
          <li key={s} style={{ ["--i" as string]: i }}>
            <span className="rsk-tick" aria-hidden="true" />
            {s}
          </li>
        ))}
      </ol>

      <div className="rsk-lead" aria-hidden="true">
        {bars([96, 88, 54])}
      </div>

      <section aria-hidden="true">
        <h2>How you worked</h2>
        <dl className="dbg-dims">
          {DIMENSIONS.map(([k, label], i) => (
            <div key={k} className="dbg-dim" style={{ ["--i" as string]: i }}>
              <dt>{label}</dt>
              <dd>
                <i className="rsk-pill" />
              </dd>
              <dd className="dbg-dim-why">{bars([i % 2 ? 78 : 92, i % 3 ? 46 : 64])}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="dbg-two" aria-hidden="true">
        <section>
          <h2>What went well</h2>
          <div className="rsk-list">{bars([90, 76, 84])}</div>
        </section>
        <section>
          <h2>What to do next time</h2>
          <div className="rsk-list">{bars([82, 92, 60])}</div>
        </section>
      </div>

      <section aria-hidden="true">
        <h2>What you changed</h2>
        <div className="rsk-diff">
          {[34, 58, 46, 70, 40, 62].map((w, i) => (
            <span key={i} className={i === 2 || i === 3 ? "is-add" : undefined}>
              <i style={{ width: `${w}%` }} />
            </span>
          ))}
        </div>
      </section>

      <section aria-hidden="true">
        <h2>What to revisit</h2>
        <div className="rsk-cards">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rsk-card">
              {bars([60, 90, 42])}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
