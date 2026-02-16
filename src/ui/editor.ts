/**
 * Code editor — CodeMirror integration with custom keybindings.
 */

import { closeBrackets } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, highlightActiveLine, keymap } from "@codemirror/view";
import { decompressFromURL } from "../utils/url-compression.ts";

export const defaultCode = `// Shape Display — chain patterns with transforms
// Press Ctrl/Cmd + Enter to run

seq(
  wave(1, 1),
  pyramid(),
  noise(5),
  checker(5),
  ripple(0.5, 0.5, 3),
)`;

/** Create the CodeMirror editor and return an API to interact with it. */
export async function createEditor(parent: HTMLElement, onRun: () => void): Promise<{ getCode: () => string }> {
  // Load code from URL hash if available
  const hash = location.hash.slice(1);
  let initialCode: string;
  if (hash) {
    try {
      initialCode = await decompressFromURL(hash);
    } catch {
      initialCode = defaultCode;
    }
  } else {
    initialCode = defaultCode;
  }

  const runKeymap = [
    {
      key: "Mod-Enter",
      run: () => {
        onRun();
        return true;
      },
    },
  ];

  const extensions = [
    history(),
    highlightActiveLine(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...runKeymap, ...historyKeymap, ...defaultKeymap, indentWithTab]),
    oneDark,
    javascript(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
  ];

  const view = new EditorView({
    state: EditorState.create({ doc: initialCode, extensions }),
    parent,
  });

  return {
    getCode: () => view.state.doc.toString(),
  };
}
