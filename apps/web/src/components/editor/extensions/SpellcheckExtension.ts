import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { checkSpelling, isWordIgnored } from "@/lib/spellcheck/engine";

const spellcheckKey = new PluginKey("rhodesSpellcheck");

export type SpellSuggestionPayload = {
  from: number;
  to: number;
  word: string;
  clientRect: DOMRect;
};

type SpellcheckOptions = {
  enabled: boolean;
  locale: "en";
  debounceMs: number;
};

type SpellcheckStorage = {
  onSuggestionRequest: ((payload: SpellSuggestionPayload) => void) | null;
  refresh: () => void;
};

const WORD_RE = /[A-Za-z][A-Za-z'-]{1,}/g;

/**
 * Client dictionary underlines (EN). Decorations only — not persisted in doc JSON.
 * Right-click a misspelled word to open suggestions (wired via storage callback).
 */
export const SpellcheckExtension = Extension.create<
  SpellcheckOptions,
  SpellcheckStorage
>({
  name: "rhodesSpellcheck",

  addOptions() {
    return {
      enabled: true,
      locale: "en",
      debounceMs: 450,
    };
  },

  addStorage() {
    return {
      onSuggestionRequest: null,
      refresh: () => undefined,
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
          handleDOMEvents: {
            contextmenu(view, event) {
              const target = event.target;
              if (!(target instanceof Element)) return false;
              const span = target.closest(".spellcheck-misspelled");
              if (!span) return false;

              const coords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              if (!coords) return false;

              const decorations = spellcheckKey.getState(view.state) as
                | DecorationSet
                | undefined;
              if (!decorations) return false;

              let from = -1;
              let to = -1;
              decorations.find().forEach((deco) => {
                if (coords.pos >= deco.from && coords.pos <= deco.to) {
                  from = deco.from;
                  to = deco.to;
                }
              });
              if (from < 0 || to <= from) return false;

              const word = view.state.doc.textBetween(from, to);
              if (!word || isWordIgnored(word)) return false;

              event.preventDefault();
              extension.storage.onSuggestionRequest?.({
                from,
                to,
                word,
                clientRect: span.getBoundingClientRect(),
              });
              return true;
            },
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
                      const key = word.toLowerCase();
                      if (!bad.has(key) || isWordIgnored(word)) continue;
                      const from = pos + (match.index ?? 0);
                      decorations.push(
                        Decoration.inline(from, from + word.length, {
                          class: "spellcheck-misspelled",
                          "data-spell-word": word,
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

          extension.storage.refresh = schedule;
          schedule();

          return {
            update(updatedView, prevState) {
              if (updatedView.state.doc.eq(prevState.doc)) return;
              schedule();
            },
            destroy() {
              if (timer) clearTimeout(timer);
              extension.storage.refresh = () => undefined;
            },
          };
        },
      }),
    ];
  },
});
