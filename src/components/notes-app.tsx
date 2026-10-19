"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipItem } from "./quick-capture";
import { backlinksTo, makeResolver, type DayRef } from "@/lib/brain-links";
import {
  createNote,
  deleteNote,
  linksOf,
  tagsOf,
  titleOf,
  updateNote,
  useBrain,
  type Note,
} from "@/lib/brain-store";
import { clipsOn, useClips } from "@/lib/clips-store";
import { setNote, useGuestState } from "@/lib/guest-store";
import { Markdown, toggleTask } from "@/lib/markdown";
import { useHydrated } from "@/lib/plan-store";
import { formatDate } from "@/lib/schedule";
import { toast } from "@/lib/toast";

type Entry = {
  id: string;
  kind: "note" | "day" | "clips";
  title: string;
  body: string;
  day: string | null;
  pinned: boolean;
  updated: number;
};

export const TEMPLATES: { name: string; body: string }[] = [
  {
    name: "Lesson recap",
    body: "## What it is\n\n## Why it matters\n\n## The one thing I would forget\n\n## Questions I still have\n- [ ] \n",
  },
  {
    name: "Explain it simply",
    body: "## Explain it to a friend in four sentences\n\n## Where my explanation breaks down\n\n## Go back and read\n- [ ] \n",
  },
  {
    name: "Bug post-mortem",
    body: "## What I saw\n\n## What I expected\n\n## Root cause\n\n## The fix, and the test that guards it\n\n#debugging\n",
  },
  {
    name: "Reading notes",
    body: "## Source\n\n## Three claims worth keeping\n- \n- \n- \n\n## What I disagree with\n\n## Links to other notes\n[[ ]]\n",
  },
];

const when = (ts: number) => (ts ? formatDate(new Date(ts).toISOString().slice(0, 10)) : "");
const snippet = (body: string) =>
  body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function NotesApp({ days }: { days: DayRef[] }) {
  const hydrated = useHydrated();
  const brain = useBrain();
  const guest = useGuestState();
  const clips = useClips().clips;
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const handled = useRef(false);

  const selected = params.get("n");
  const tag = params.get("tag");

  // A link like /notes?new=1&day=w3d2 starts a note, then swaps the address for the new note.
  useEffect(() => {
    if (!params.get("new") || handled.current) return;
    handled.current = true;
    const day = params.get("day");
    const id = createNote({
      title: params.get("title") ?? "",
      day: day && days.some((d) => d.id === day) ? day : null,
    });
    router.replace(`/notes?n=${id}`);
  }, [params, days, router]);
  useEffect(() => {
    if (!params.get("new")) handled.current = false;
  }, [params]);

  const entries: Entry[] = useMemo(() => {
    const free = brain.notes.map((n): Entry => ({
      id: n.id,
      kind: "note",
      title: titleOf(n),
      body: n.body,
      day: n.day,
      pinned: n.pinned,
      updated: n.updated,
    }));
    free.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated - a.updated);
    const journals = days
      .filter((d) => guest.notes[d.id])
      .map((d): Entry => ({
        id: "day:" + d.id,
        kind: "day",
        title: d.title,
        body: guest.notes[d.id],
        day: d.id,
        pinned: false,
        updated: 0,
      }));
    // Quick captures from the side panel, one entry per day, newest day first.
    const captured = days
      .filter((d) => clips.some((c) => c.day === d.id))
      .map((d): Entry => {
        const mine = clipsOn(clips, d.id);
        return {
          id: "clips:" + d.id,
          kind: "clips",
          title: "Captures: " + d.title,
          body: mine
            .map((c) => c.text)
            .filter(Boolean)
            .join("\n"),
          day: d.id,
          pinned: false,
          updated: mine[mine.length - 1].created,
        };
      })
      .sort((a, b) => b.updated - a.updated);
    return [...free, ...journals, ...captured];
  }, [brain.notes, guest.notes, clips, days]);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) for (const t of tagsOf(e.body)) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [entries]);

  const shown = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter(
      (e) =>
        (!tag || tagsOf(e.body).includes(tag)) &&
        terms.every((t) => (e.title + " " + e.body).toLowerCase().includes(t)),
    );
  }, [entries, q, tag]);

  const resolve = useMemo(() => makeResolver(brain.notes, days), [brain.notes, days]);
  const current = entries.find((e) => e.id === selected) ?? null;

  function open(id: string | null) {
    router.push(id ? `/notes?n=${id}` : "/notes");
  }
  function newNote() {
    open(createNote({ day: null }));
  }
  function exportAll() {
    const parts = entries.map((e) => {
      const tags = tagsOf(e.body)
        .map((t) => "#" + t)
        .join(" ");
      return `# ${e.title}${e.kind === "day" ? " (day journal)" : ""}\n\n${tags ? tags + "\n\n" : ""}${e.body.trim()}\n`;
    });
    download(`second-brain-${new Date().toISOString().slice(0, 10)}.md`, parts.join("\n---\n\n"));
    toast("Notes exported as Markdown");
  }

  if (!hydrated) return <div className="brain" aria-busy="true" />;

  return (
    <div className={"brain" + (current ? " has-sel" : "")}>
      <header className="brain-head">
        <div>
          <h1>Notes</h1>
          <p className="lead">
            Write what you learn in your own words, link notes to each other and to any day with{" "}
            <code>[[double brackets]]</code>, and find it again by tag. It all stays in this browser.
          </p>
        </div>
        <div className="brain-actions">
          <button className="btn primary" type="button" onClick={newNote}>
            New note
          </button>
          <button className="btn" type="button" onClick={exportAll} disabled={entries.length === 0}>
            Export Markdown
          </button>
        </div>
      </header>

      <div className="brain-grid">
        <aside className="brain-list" aria-label="Your notes">
          <input
            type="text"
            placeholder="Search notes"
            aria-label="Search notes"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {tagCounts.length > 0 && (
            <div className="tagbar" aria-label="Filter by tag">
              {tag && (
                <Link className="tag on" href={selected ? `/notes?n=${selected}` : "/notes"}>
                  #{tag} ×
                </Link>
              )}
              {tagCounts
                .filter(([t]) => t !== tag)
                .slice(0, 14)
                .map(([t, n]) => (
                  <Link
                    key={t}
                    className="tag"
                    href={`/notes?tag=${encodeURIComponent(t)}${selected ? `&n=${selected}` : ""}`}
                  >
                    #{t} <small>{n}</small>
                  </Link>
                ))}
            </div>
          )}
          {shown.length === 0 ? (
            <p className="brain-empty">
              {entries.length === 0
                ? "Nothing here yet. Start a note, or write in the notes box at the end of any day and it will appear here."
                : "No notes match."}
            </p>
          ) : (
            <ul>
              {shown.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/notes?n=${e.id}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}`}
                    className={e.id === selected ? "on" : undefined}
                    aria-current={e.id === selected ? "true" : undefined}
                  >
                    <b>
                      {e.pinned && <span aria-label="Pinned">★ </span>}
                      {e.title}
                    </b>
                    <span>{snippet(e.body) || (e.kind === "clips" ? "Images and links" : "Empty note")}</span>
                    <small>
                      {e.kind === "day"
                        ? "Day journal"
                        : e.kind === "clips"
                          ? `${clipsOn(clips, e.day!).length} captured · ${when(e.updated)}`
                          : when(e.updated)}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="brain-main" aria-label="Note">
          {current?.kind === "clips" ? (
            <ClipsView key={current.id} entry={current} days={days} onClose={() => open(null)} />
          ) : current ? (
            <Editor
              key={current.id}
              entry={current}
              notes={brain.notes}
              days={days}
              resolve={resolve}
              onClose={() => open(null)}
              onDeleted={() => open(null)}
            />
          ) : (
            <Welcome onNew={newNote} onTemplate={(body) => open(createNote({ day: null, body }))} />
          )}
        </section>
      </div>
    </div>
  );
}

function ClipsView({ entry, days, onClose }: { entry: Entry; days: DayRef[]; onClose: () => void }) {
  const mine = clipsOn(useClips().clips, entry.day!);
  const day = days.find((d) => d.id === entry.day);
  return (
    <div className="editor clips-view">
      <button className="btn brain-back" type="button" onClick={onClose}>
        All notes
      </button>
      <h2 className="ed-title static">{entry.title}</h2>
      <div className="ed-meta">
        <span className="host">Captured from the side panel</span>
        {day && (
          <Link className="chip link" href={day.href}>
            Week {day.week}, day {day.day}: {day.title}
          </Link>
        )}
      </div>
      {mine.length === 0 ? (
        <p className="brain-empty">Nothing left here. Captures you add on the day page show up again.</p>
      ) : (
        <ul className="qc-list" aria-label="Captures">
          {[...mine].reverse().map((c) => (
            <ClipItem key={c.id} clip={c} wide />
          ))}
        </ul>
      )}
    </div>
  );
}

function Welcome({ onNew, onTemplate }: { onNew: () => void; onTemplate: (body: string) => void }) {
  return (
    <div className="brain-welcome">
      <h2>What would you like to remember?</h2>
      <p>A good note is short and in your own words. Start from a shape, or from nothing.</p>
      <div className="tpl">
        {TEMPLATES.map((t) => (
          <button key={t.name} type="button" onClick={() => onTemplate(t.body)}>
            <b>{t.name}</b>
            <span>{snippet(t.body).slice(0, 70)}</span>
          </button>
        ))}
      </div>
      <button className="btn" type="button" onClick={onNew}>
        Blank note
      </button>
      <ul className="tips">
        <li>
          Link ideas: <code>[[Page tables]]</code> opens that note, or a day if the name matches.
        </li>
        <li>
          Tag them: <code>#os</code> anywhere in the text adds a tag you can filter by.
        </li>
        <li>
          Make a to-do: <code>- [ ] revisit TLP</code> gives a box you can tick in the preview.
        </li>
      </ul>
    </div>
  );
}

function Editor({
  entry,
  notes,
  days,
  resolve,
  onClose,
  onDeleted,
}: {
  entry: Entry;
  notes: Note[];
  days: DayRef[];
  resolve: ReturnType<typeof makeResolver>;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const isDay = entry.kind === "day";
  const dayId = isDay ? entry.id.slice(4) : null;
  const [editing, setEditing] = useState(!entry.body);
  const [confirm, setConfirm] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const [linkText, setLinkText] = useState("");

  const note = isDay ? null : (notes.find((n) => n.id === entry.id) ?? null);
  const setBody = (body: string) => (isDay ? setNote(dayId!, body) : updateNote(entry.id, { body }));
  const day = days.find((d) => d.id === (isDay ? dayId : entry.day));
  const back = note ? backlinksTo(note, notes, linksOf) : [];
  const tags = tagsOf(entry.body);
  const words = entry.body.trim() ? entry.body.trim().split(/\s+/).length : 0;

  function wrap(before: string, after = "", placeholder = "") {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const mid = value.slice(s, e) || placeholder;
    setBody(value.slice(0, s) + before + mid + after + value.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + mid.length);
    });
  }
  function lineStart(prefix: string) {
    const el = area.current;
    if (!el) return;
    const s = el.selectionStart;
    const at = el.value.lastIndexOf("\n", s - 1) + 1;
    setBody(el.value.slice(0, at) + prefix + el.value.slice(at));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  }
  function insertLink() {
    const t = linkText.trim();
    if (!t) return;
    wrap(`[[${t}]]`);
    setLinkText("");
  }

  return (
    <div className="editor">
      <button className="btn brain-back" type="button" onClick={onClose}>
        All notes
      </button>
      {isDay ? (
        <h2 className="ed-title static">{entry.title}</h2>
      ) : (
        <input
          className="ed-title"
          aria-label="Title"
          placeholder="Untitled"
          value={note?.title ?? ""}
          onChange={(e) => updateNote(entry.id, { title: e.target.value })}
        />
      )}
      <div className="ed-meta">
        {isDay && <span className="host">Day journal</span>}
        {day && (
          <Link className="chip link" href={day.href}>
            Week {day.week}, day {day.day}: {day.title}
          </Link>
        )}
        {!isDay && (
          <select
            aria-label="Link this note to a day"
            value={entry.day ?? ""}
            onChange={(e) => updateNote(entry.id, { day: e.target.value || null })}
          >
            <option value="">{entry.day ? "Remove day link" : "Link to a day"}</option>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                W{d.week} D{d.day}: {d.title}
              </option>
            ))}
          </select>
        )}
        {tags.map((t) => (
          <Link key={t} className="tag" href={`/notes?tag=${encodeURIComponent(t)}&n=${entry.id}`}>
            #{t}
          </Link>
        ))}
      </div>

      <div className="ed-bar" role="toolbar" aria-label="Note tools">
        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={editing} onClick={() => setEditing(true)}>
            Write
          </button>
          <button type="button" aria-pressed={!editing} onClick={() => setEditing(false)}>
            Preview
          </button>
        </div>
        {editing && (
          <div className="fmt">
            <button type="button" aria-label="Heading" onClick={() => lineStart("## ")}>
              H
            </button>
            <button type="button" aria-label="Bold" onClick={() => wrap("**", "**", "bold")}>
              <b>B</b>
            </button>
            <button type="button" aria-label="Code" onClick={() => wrap("`", "`", "code")}>
              {"</>"}
            </button>
            <button type="button" aria-label="Checklist item" onClick={() => lineStart("- [ ] ")}>
              ☐
            </button>
            <button type="button" aria-label="Quote" onClick={() => lineStart("> ")}>
              ❝
            </button>
            <input
              type="text"
              list="brain-targets"
              placeholder="Link a note or day"
              aria-label="Link a note or day"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  insertLink();
                }
              }}
            />
            <datalist id="brain-targets">
              {notes.map((n) => (
                <option key={n.id} value={titleOf(n)} />
              ))}
              {days.map((d) => (
                <option key={d.id} value={d.title} />
              ))}
            </datalist>
          </div>
        )}
      </div>

      {editing ? (
        <>
          {!entry.body && !isDay && (
            <div className="tpl-row">
              <span>Start from</span>
              {TEMPLATES.map((t) => (
                <button key={t.name} type="button" onClick={() => setBody(t.body)}>
                  {t.name}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={area}
            className="ed-area"
            aria-label="Note text"
            placeholder="Write in Markdown. Use [[Another note]] to link and #tags to find it later."
            value={entry.body}
            onChange={(e) => setBody(e.target.value)}
          />
        </>
      ) : entry.body ? (
        <Markdown
          text={entry.body}
          resolve={resolve}
          onToggle={(line) => setBody(toggleTask(entry.body, line))}
        />
      ) : (
        <p className="brain-empty">Empty note. Switch to Write to start.</p>
      )}

      <p className="host" aria-live="polite">
        {words} {words === 1 ? "word" : "words"} · saved on this device
        {note ? ` · edited ${when(note.updated)}` : ""}
      </p>

      {back.length > 0 && (
        <div className="backlinks">
          <h3>Linked from</h3>
          <ul>
            {back.map((n) => (
              <li key={n.id}>
                <Link href={`/notes?n=${n.id}`}>{titleOf(n)}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {note && (
        <div className="ed-foot">
          <button
            className="btn"
            type="button"
            onClick={() => updateNote(entry.id, { pinned: !note.pinned })}
            aria-pressed={note.pinned}
          >
            {note.pinned ? "Unpin" : "Pin to top"}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() =>
              download(
                `${
                  titleOf(note)
                    .replace(/[^\w]+/g, "-")
                    .toLowerCase() || "note"
                }.md`,
                `# ${titleOf(note)}\n\n${note.body}\n`,
              )
            }
          >
            Export this note
          </button>
          {confirm ? (
            <>
              <button
                className="btn danger"
                type="button"
                onClick={() => {
                  deleteNote(entry.id);
                  toast("Note deleted");
                  onDeleted();
                }}
              >
                Delete for good
              </button>
              <button className="btn" type="button" onClick={() => setConfirm(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button className="btn" type="button" onClick={() => setConfirm(true)}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
