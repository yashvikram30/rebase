"use client";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, Prec } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";

// Colours come from CSS variables (see workbench.css) so the editor follows light and dark.
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.operatorKeyword], color: "var(--wb-kw)" },
  { tag: [t.string, t.special(t.string)], color: "var(--wb-str)" },
  { tag: [t.number, t.bool, t.null], color: "var(--wb-num)" },
  { tag: [t.comment, t.lineComment], color: "var(--wb-com)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--wb-fn)" },
  { tag: [t.definition(t.variableName), t.className], color: "var(--wb-def)" },
  { tag: t.self, color: "var(--wb-kw)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", color: "var(--text)", backgroundColor: "var(--wb-editor)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--mono)", fontSize: "13.5px", lineHeight: "1.65" },
  ".cm-content": { caretColor: "var(--text)", padding: "10px 0" },
  ".cm-cursor": { borderLeftColor: "var(--text)", borderLeftWidth: "2px" },
  ".cm-gutters": {
    backgroundColor: "var(--wb-editor)",
    color: "var(--muted)",
    border: "none",
    paddingRight: "6px",
  },
  ".cm-activeLine": { backgroundColor: "var(--wb-line)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--wb-line)", color: "var(--text)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--wb-select)",
  },
  ".cm-selectionMatch": { backgroundColor: "var(--wb-select)" },
  "&.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--wb-select)",
    outline: "1px solid var(--muted)",
  },
  ".cm-tooltip": {
    color: "var(--text)",
    backgroundColor: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "6px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--wb-select)",
    color: "var(--text)",
  },
  ".cm-panels": { backgroundColor: "var(--panel)", color: "var(--text)", borderColor: "var(--line)" },
});

type Handlers = { onChange: (code: string) => void; onRun: () => void; onRunAll: () => void };

function makeState(doc: string, path: string, readOnly: boolean, handlers: { current: Handlers }) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightSelectionMatches(),
      // Only code gets Python highlighting; the bug report is prose, so it also wraps.
      ...(path.endsWith(".py") ? [python()] : [EditorView.lineWrapping]),
      syntaxHighlighting(highlight),
      theme,
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.contentAttributes.of({ "aria-label": readOnly ? "Read-only file" : "Code editor" }),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              handlers.current.onRun();
              return true;
            },
          },
          {
            key: "Mod-Shift-Enter",
            run: () => {
              handlers.current.onRunAll();
              return true;
            },
          },
        ]),
      ),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) handlers.current.onChange(u.state.doc.toString());
      }),
    ],
  });
}

export function Editor({
  path,
  value,
  readOnly,
  onChange,
  onRun,
  onRunAll,
}: { path: string; value: string; readOnly: boolean } & Handlers) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef<Handlers>({ onChange, onRun, onRunAll });
  const latest = useRef({ value, readOnly });
  // One editor state per file, so switching tabs keeps undo history and the cursor.
  const states = useRef(new Map<string, EditorState>());
  const current = useRef(path);

  useEffect(() => {
    handlers.current = { onChange, onRun, onRunAll };
    latest.current = { value, readOnly };
  });

  useEffect(() => {
    const v = new EditorView({
      state: makeState(latest.current.value, current.current, latest.current.readOnly, handlers),
      parent: host.current!,
    });
    view.current = v;
    const parked = states.current;
    return () => {
      v.destroy();
      view.current = null;
      parked.clear();
    };
  }, []);

  // Switching file: park the old state, restore (or create) the new one.
  useEffect(() => {
    const v = view.current;
    if (!v || current.current === path) return;
    states.current.set(current.current, v.state);
    current.current = path;
    v.setState(
      states.current.get(path) ?? makeState(latest.current.value, path, latest.current.readOnly, handlers),
    );
  }, [path]);

  // The text changed from outside the editor (reset file): replace it.
  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div className="wb-editor" ref={host} />;
}
