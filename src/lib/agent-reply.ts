export type ReplyPart =
  | { kind: "text"; text: string }
  | { kind: "code"; lang: string; code: string }
  | { kind: "patch"; file: string; code: string };

const FENCE = /```([\w+-]*)[ \t]*([^\n]*)\n([\s\S]*?)```/g;

// Models mostly write ```python path=util.py, but sometimes put the path on the block's first line instead.
const INFO_PATH = /path=([^\s`]+)/;
const FIRST_LINE_PATH = /^[ \t]*(?:#[ \t]*)?(?:path|file)[ \t]*[=:][ \t]*([^\s`]+)[ \t]*\n/;

/** The editable file a fenced block is a patch for, and its code without any path line. Null for ordinary code. */
function patchOf(
  info: string,
  body: string,
  editable: readonly string[],
): { file: string; code: string } | null {
  let file = INFO_PATH.exec(info)?.[1];
  let code = body;
  if (!file) {
    const m = FIRST_LINE_PATH.exec(body);
    if (m) {
      file = m[1];
      code = body.slice(m[0].length);
    }
  }
  return file && editable.includes(file) ? { file, code } : null;
}

/**
 * Splits a model reply into prose, plain code and patches. A patch is a fenced block labelled with one of the
 * case's editable files: the complete new contents of that file.
 */
export function splitReply(reply: string, editable: readonly string[]): ReplyPart[] {
  const parts: ReplyPart[] = [];
  let at = 0;
  for (const m of reply.matchAll(FENCE)) {
    const before = reply.slice(at, m.index).trim();
    if (before) parts.push({ kind: "text", text: before });
    const patch = patchOf(m[2], m[3], editable);
    if (patch) parts.push({ kind: "patch", file: patch.file, code: patch.code.replace(/\n+$/, "") + "\n" });
    else parts.push({ kind: "code", lang: m[1], code: m[3].replace(/\n$/, "") });
    at = (m.index ?? 0) + m[0].length;
  }
  const rest = reply.slice(at).trim();
  if (rest) parts.push({ kind: "text", text: rest });
  return parts;
}

const WITHHELD = "[Code withheld: the assistant gives hints, not fixes.]";
/** A quoted snippet this long or shorter is fine; anything longer is likely a rewrite of their code. */
const MAX_SNIPPET_LINES = 4;

/** The assistant gives hints, never fixes: patches and any code block longer than a short snippet are removed. */
export function withholdPatches(
  reply: string,
  editable: readonly string[],
): { reply: string; withheld: number } {
  let withheld = 0;
  const out = reply.replace(FENCE, (block, _lang: string, info: string, body: string) => {
    const long = body.replace(/\n+$/, "").split("\n").length > MAX_SNIPPET_LINES;
    if (!patchOf(info, body, editable) && !long) return block;
    withheld++;
    return WITHHELD;
  });
  return { reply: out, withheld };
}
