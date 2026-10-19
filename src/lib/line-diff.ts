export type DiffLine = { kind: "same" | "add" | "del"; text: string };
export type DiffItem = DiffLine | { kind: "gap"; count: number };

const lines = (s: string) => {
  const out = s.split("\n");
  // A trailing newline is not an extra empty line.
  if (out.length && out[out.length - 1] === "") out.pop();
  return out;
};

/** Line-by-line diff from the longest common subsequence. Fine for the short files in a scenario. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = lines(before);
  const b = lines(after);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "del", text: a[i++] });
    } else {
      out.push({ kind: "add", text: b[j++] });
    }
  }
  while (i < a.length) out.push({ kind: "del", text: a[i++] });
  while (j < b.length) out.push({ kind: "add", text: b[j++] });
  return out;
}

export function diffStats(diff: DiffLine[]) {
  return {
    added: diff.filter((l) => l.kind === "add").length,
    removed: diff.filter((l) => l.kind === "del").length,
  };
}

/** Keeps the changed lines and `context` lines around them; runs of untouched lines collapse to a gap. */
export function withContext(diff: DiffLine[], context = 2): DiffItem[] {
  const keep = diff.map((l) => l.kind !== "same");
  if (!keep.some(Boolean)) return [];
  const near = keep.map((_, i) => {
    for (let k = Math.max(0, i - context); k <= Math.min(diff.length - 1, i + context); k++)
      if (keep[k]) return true;
    return false;
  });
  const out: DiffItem[] = [];
  let hidden = 0;
  diff.forEach((l, i) => {
    if (near[i]) {
      if (hidden) out.push({ kind: "gap", count: hidden });
      hidden = 0;
      out.push(l);
    } else hidden++;
  });
  if (hidden) out.push({ kind: "gap", count: hidden });
  return out;
}
