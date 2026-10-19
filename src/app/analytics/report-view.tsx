import Link from "next/link";
import { ago, type Count, type Summary, type Visit } from "@/lib/analytics";
import { MAX_ROWS, type Report } from "@/lib/analytics-store";

export const RANGES = {
  "24h": { label: "24 hours", ms: 24 * 3_600_000 },
  "7d": { label: "7 days", ms: 7 * 86_400_000 },
  "30d": { label: "30 days", ms: 30 * 86_400_000 },
  "90d": { label: "90 days", ms: 90 * 86_400_000 },
} as const;
export type RangeKey = keyof typeof RANGES;
export const isRange = (v: unknown): v is RangeKey => typeof v === "string" && v in RANGES;

/** The dashboard for one loaded report. Pure presentation: the page does the auth and the query. */
export function ReportView({ current, report }: { current: RangeKey; report: Report }) {
  const { summary: s, returning, truncated, now: until } = report;
  return (
    <>
      <Header current={current} />
      {truncated && (
        <p className="callout">Showing the most recent {MAX_ROWS.toLocaleString("en-US")} page views only.</p>
      )}
      <div className="cards an-cards">
        <Stat label="Page views" value={s.views} />
        <Stat label="Visitors" value={s.visitors} note={`${returning} returning`} />
        <Stat
          label="Sessions"
          value={s.sessions}
          note={s.sessions ? `${(s.views / s.sessions).toFixed(1)} pages each` : undefined}
        />
        <Stat label="Signed in" value={s.signedIn} note="with an account" />
        <Stat
          label="Bounce rate"
          value={s.bounceRate === null ? "–" : `${Math.round(s.bounceRate * 100)}%`}
          note="one-page sessions"
        />
      </div>

      <h2>Traffic</h2>
      <Chart s={s} />

      <h2>Who visited</h2>
      <People s={s} now={until} />

      <h2>What they read</h2>
      <div className="an-grid">
        <Bars title="Top pages" rows={s.pages} />
        <Bars title="Where they came from" rows={s.referrers} />
      </div>

      <h2>Where and on what</h2>
      <div className="an-grid">
        <Bars title="Countries" rows={s.countries} />
        <Bars title="Devices" rows={s.devices} />
        <Bars title="Browsers" rows={s.browsers} />
        <Bars title="Operating systems" rows={s.systems} />
      </div>

      <h2>Latest page views</h2>
      <Recent rows={s.recent} now={until} />
    </>
  );
}

export function Header({ current }: { current: RangeKey }) {
  return (
    <>
      <Link className="an-back" href="/">
        ← Back to Rebase
      </Link>
      <h1>Analytics</h1>
      <p className="lead">
        Visits to this site, visible only to you. Your own signed-in visits are left out, and days are in UTC.
      </p>
      <nav className="an-range" aria-label="Time range">
        {(Object.keys(RANGES) as RangeKey[]).map((k) => (
          <Link
            key={k}
            href={`/analytics?range=${k}`}
            className={"btn" + (k === current ? " on" : "")}
            aria-current={k === current ? "true" : undefined}
          >
            {RANGES[k].label}
          </Link>
        ))}
      </nav>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="card">
      <small>{label}</small>
      <b>{typeof value === "number" ? value.toLocaleString("en-US") : value}</b>
      {note && <small>{note}</small>}
    </div>
  );
}

const utc = (t: number, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(t);

function Chart({ s }: { s: Summary }) {
  const W = 720;
  const H = 180;
  const pad = { l: 36, r: 8, t: 8, b: 22 };
  const max = Math.max(1, ...s.series.map((b) => b.views));
  const top = niceCeil(max);
  const slot = (W - pad.l - pad.r) / s.series.length;
  const bar = Math.max(1, Math.min(28, slot * 0.72));
  const y = (n: number) => pad.t + (H - pad.t - pad.b) * (1 - n / top);
  const fmt: Intl.DateTimeFormatOptions =
    s.bucket === "hour" ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" };
  const labelEvery = Math.max(1, Math.ceil(s.series.length / 6));

  if (!s.views) return <p className="an-empty">No page views in this range yet.</p>;
  return (
    <figure className="an-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Page views and visitors per ${s.bucket}, ${s.views} views in total`}
      >
        {[0, top / 2, top].map((n) => (
          <g key={n}>
            <line x1={pad.l} x2={W - pad.r} y1={y(n)} y2={y(n)} className="an-grid-line" />
            <text x={pad.l - 6} y={y(n) + 4} textAnchor="end" className="an-axis">
              {Math.round(n)}
            </text>
          </g>
        ))}
        {s.series.map((b, i) => {
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={b.t}>
              <title>{`${utc(b.t, { ...fmt, ...(s.bucket === "hour" ? { day: "numeric", month: "short" } : {}) })}: ${b.views} views, ${b.visitors} visitors`}</title>
              <rect
                x={cx - bar / 2}
                width={bar}
                y={y(b.views)}
                height={y(0) - y(b.views)}
                className="an-views"
              />
              <rect
                x={cx - bar / 4}
                width={bar / 2}
                y={y(b.visitors)}
                height={y(0) - y(b.visitors)}
                className="an-visitors"
              />
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 6} textAnchor="middle" className="an-axis">
                  {utc(b.t, fmt)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span className="an-key an-views" /> Page views <span className="an-key an-visitors" /> Visitors
      </figcaption>
    </figure>
  );
}

/** 7 → 8, 130 → 150: a round number to top the y axis. */
function niceCeil(n: number): number {
  const p = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 1.5, 2, 3, 5, 7.5, 10]) if (n <= m * p) return m * p;
  return 10 * p;
}

function People({ s, now }: { s: Summary; now: number }) {
  if (!s.people.length) return <p className="an-empty">Nobody yet.</p>;
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Visitor</th>
            <th>From</th>
            <th>Using</th>
            <th className="num">Views</th>
            <th className="num">Sessions</th>
            <th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {s.people.map((p) => (
            <tr key={p.key}>
              <td>
                <b>{p.label}</b>
                {p.sub && <small className="an-sub">{p.sub}</small>}
              </td>
              <td>{p.place}</td>
              <td>
                {p.browser} on {p.os} <small className="an-sub">{p.device}</small>
              </td>
              <td className="num">{p.views}</td>
              <td className="num">{p.sessions}</td>
              <td title={`${utc(p.last.getTime(), { dateStyle: "medium", timeStyle: "short" })} UTC`}>
                {ago(p.last, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: Count[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="an-bars">
      <h3>{title}</h3>
      {rows.length ? (
        <ul>
          {rows.map((r) => (
            <li key={r.label}>
              <span className="an-fill" style={{ width: `${(r.n / max) * 100}%` }} aria-hidden="true" />
              <span className="an-label">{r.label}</span>
              <span className="an-n">{r.n.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="an-empty">No data yet.</p>
      )}
    </section>
  );
}

function Recent({ rows, now }: { rows: Visit[]; now: number }) {
  if (!rows.length) return <p className="an-empty">No page views yet.</p>;
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Page</th>
            <th>Visitor</th>
            <th>From</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v, i) => (
            <tr key={`${v.sid}-${v.ts.getTime()}-${i}`}>
              <td title={`${utc(v.ts.getTime(), { dateStyle: "medium", timeStyle: "medium" })} UTC`}>
                {ago(v.ts, now)}
              </td>
              <td>
                <code>{v.path}</code>
              </td>
              <td>{v.name || v.email || `Visitor ${v.vid.replace(/-/g, "").slice(0, 4)}`}</td>
              <td>{v.city && v.country ? `${v.city}, ${v.country}` : (v.country ?? "–")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
