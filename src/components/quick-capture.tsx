"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  addClip,
  clipsOn,
  dayFromPath,
  deleteClip,
  shrinkImage,
  useClips,
  type Clip,
} from "@/lib/clips-store";
import { useHydrated } from "@/lib/plan-store";
import { toast } from "@/lib/toast";

const MAX_IMAGES_AT_ONCE = 6;

/** A mini second brain on the right edge of a day page: paste text, links or images and they are filed under that day. */
export function QuickCapture() {
  const pathname = usePathname();
  const day = dayFromPath(pathname);
  const hydrated = useHydrated();
  const all = useClips().clips;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const files = useRef<HTMLInputElement>(null);

  // Escape closes the panel, and focus moves into it when it opens.
  useEffect(() => {
    if (!open) return;
    area.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!day || !hydrated) return null;
  const mine = clipsOn(all, day);
  const label = day.replace(/^w(\d+)d(\d+)$/, "Week $1, day $2");

  function saved(ok: boolean) {
    if (!ok) toast("Not saved: browser storage is full. Delete some captures or images.");
    return ok;
  }

  async function addImages(list: Blob[]) {
    const imgs = list.filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMAGES_AT_ONCE);
    if (!imgs.length) return;
    setBusy(true);
    let n = 0;
    for (const f of imgs) {
      try {
        if (saved(addClip(day!, { img: await shrinkImage(f) }))) n++;
      } catch {
        toast("That image could not be read");
      }
    }
    setBusy(false);
    if (n) toast(n === 1 ? "Image captured" : `${n} images captured`);
  }

  function submit() {
    if (!text.trim()) return;
    if (saved(addClip(day!, { text }))) {
      setText("");
      toast("Captured for " + label);
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const pics = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
    if (!pics.length) return;
    e.preventDefault();
    void addImages(pics);
  }

  return (
    <>
      <button
        className={"qc-tab" + (open ? " open" : "")}
        type="button"
        aria-label={open ? "Close quick capture" : "Open quick capture"}
        title="Quick note"
        aria-expanded={open}
        aria-controls="qc-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={open ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
        </svg>
        {!open && mine.length > 0 && <b aria-hidden="true">{mine.length}</b>}
      </button>
      <aside
        id="qc-panel"
        className={"qc-panel" + (open ? " open" : "") + (over ? " over" : "")}
        aria-label="Quick capture"
        aria-hidden={!open}
        inert={!open}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          setOver(false);
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          void addImages([...e.dataTransfer.files]);
        }}
      >
        <header>
          <div>
            <h2>Quick capture</h2>
            <p>{label}</p>
          </div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="qc-add">
          <textarea
            ref={area}
            aria-label="Capture a note, link or image"
            placeholder="Type a thought, paste a link, or paste an image (Ctrl/Cmd+V). Drop files here too."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="qc-actions">
            <button className="btn primary" type="button" onClick={submit} disabled={!text.trim()}>
              Add
            </button>
            <button className="btn" type="button" onClick={() => files.current?.click()} disabled={busy}>
              {busy ? "Adding" : "Add image"}
            </button>
            <input
              ref={files}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addImages([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            <small>Ctrl/Cmd+Enter adds</small>
          </div>
        </div>

        <ul className="qc-list" aria-label={`Captured on ${label}`}>
          {[...mine].reverse().map((c) => (
            <ClipItem key={c.id} clip={c} />
          ))}
        </ul>
        {mine.length === 0 && (
          <p className="qc-empty">Nothing captured for this day yet. Whatever you add is filed under it.</p>
        )}

        <footer>
          <Link href={`/notes?n=clips:${day}`} onClick={() => setOpen(false)}>
            Open in second brain
          </Link>
        </footer>
      </aside>
    </>
  );
}

export function ClipItem({ clip, wide = false }: { clip: Clip; wide?: boolean }) {
  return (
    <li className={"qc-clip " + clip.kind + (wide ? " wide" : "")}>
      {clip.kind === "image" && clip.img && (
        // A stored data: URL, already downscaled; next/image has nothing to optimise here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={clip.img} alt={clip.text || "Captured image"} />
      )}
      {clip.kind === "link" ? (
        <a href={clip.text} target="_blank" rel="noopener noreferrer">
          {clip.text.replace(/^https?:\/\/(www\.)?/i, "")}
        </a>
      ) : clip.text ? (
        <p>{clip.text}</p>
      ) : null}
      <div className="qc-meta">
        <time dateTime={new Date(clip.created).toISOString()}>
          {new Date(clip.created).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
        <button className="linkbtn" type="button" onClick={() => deleteClip(clip.id)}>
          Delete
        </button>
      </div>
    </li>
  );
}
