import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { checkSpelling } from "@/lib/spellcheck/engine";

const spellcheckKey = new PluginKey("rhodesSpellcheck");

type SpellcheckOptions = {
  enabled: boolean;
  locale: "en";
  debounceMs: number;
};

const WORD_RE = /[A-Za-z][A-Za-z'-]{1,}/g;

/**
 * Client dictionary underlines (EN). Decorations only — not persisted in doc JSON.
 */
export const SpellcheckExtension = Extension.create<SpellcheckOptions>({
  name: "rhodesSpellcheck",

  addOptions() {
    return {
      enabled: true,
      locale: "en",
      debounceMs: 450,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: spellcheckKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const mapped = old.map(tr.mapping, tr.doc);
            const next = tr.getMeta(spellcheckKey) as DecorationSet | undefined;
            return next ?? mapped;
          },
        },
        props: {
          decorations(state) {
            return spellcheckKey.getState(state);
          },
        },
        view(view) {
          let timer: ReturnType<typeof setTimeout> | null = null;
          let generation = 0;

          const schedule = () => {
            if (!extension.options.enabled) {
              view.dispatch(
                view.state.tr.setMeta(spellcheckKey, DecorationSet.empty),
              );
              return;
            }

            if (timer) clearTimeout(timer);
            const runId = ++generation;
            timer = setTimeout(() => {
              void (async () => {
                const text = view.state.doc.textContent;
                try {
                  const issues = await checkSpelling(
                    text,
                    extension.options.locale,
                  );
                  if (runId !== generation || !view.dom.isConnected) return;

                  const bad = new Set(
                    issues.map((issue) => issue.word.toLowerCase()),
                  );
                  const decorations: ReturnType<typeof Decoration.inline>[] =
                    [];

                  view.state.doc.descendants((node, pos) => {
                    if (!node.isText || !node.text) return;
                    for (const match of node.text.matchAll(WORD_RE)) {
                      const word = match[0];
                      if (!bad.has(word.toLowerCase())) continue;
                      const from = pos + (match.index ?? 0);
                      decorations.push(
                        Decoration.inline(from, from + word.length, {
                          class: "spellcheck-misspelled",
                        }),
                      );
                    }
                  });

                  view.dispatch(
                    view.state.tr.setMeta(
                      spellcheckKey,
                      DecorationSet.create(view.state.doc, decorations),
                    ),
                  );
                } catch {
                  // Dictionary may still be loading.
                }
              })();
            }, extension.options.debounceMs);
          };

          schedule();

          return {
            update(updatedView, prevState) {
              if (updatedView.state.doc.eq(prevState.doc)) return;
              schedule();
            },
            destroy() {
              if (timer) clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});
