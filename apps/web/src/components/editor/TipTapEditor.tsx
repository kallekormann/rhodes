"use client";

import { Extension } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Typography from "@tiptap/extension-typography";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ySyncPluginKey } from "y-prosemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Y from "yjs";
import type { SupabaseYjsProvider } from "@/lib/collaboration/supabase-yjs-provider";
import type { CollaborationUser } from "@/hooks/useYjsCollaboration";
import { recordBlockAudit } from "@/lib/collaboration/block-audit";
import {
  SlashMenu,
  type SlashMenuItem,
  type SlashMenuPlacement,
} from "@/components/SlashMenu";
import { TableInsertModal } from "@/components/TableInsertModal";
import { filterSlashItems } from "@/components/editorSlash";
import { CitationBlock } from "@/components/editor/extensions/CitationBlock";
import { RhodesSuggestion } from "@/components/editor/extensions/RhodesSuggestion";
import { BlockId } from "@/components/editor/extensions/BlockId";
import { DocumentCollaborationOverlay } from "@/components/editor/DocumentCollaborationOverlay";
import {
  RemoteBlockLock,
  remoteCollaborationKey,
  type RemoteCollaborationMeta,
} from "@/components/editor/extensions/RemoteBlockLock";
import type { RemoteCollaboratorCursor } from "@/components/editor/extensions/remote-cursor-decorations";
import {
  BLOCK_ID_TRANSACTION_META,
  computeTouchedBlockIds,
  ensureEditorBlockIds,
  readBlockId,
  resolveCommentBlock,
} from "@/lib/documents/block-ids";
import { getTopLevelBlockAtPos, getTopLevelBlockIndexFromPos } from "@/lib/documents/block-drag";
import { CommentHighlight } from "@/components/editor/extensions/CommentHighlight";
import { DocumentImage } from "@/components/editor/extensions/DocumentImage";
import { DocumentLink } from "@/components/editor/extensions/DocumentLink";
import { SpellcheckExtension } from "@/components/editor/extensions/SpellcheckExtension";
import type { SpellSuggestionPayload } from "@/components/editor/extensions/SpellcheckExtension";
import {
  ConflictInlineExtension,
  type ConflictInlineState,
} from "@/components/editor/extensions/ConflictInlineExtension";
import type { SpanConflictCluster, SpanConflictVariantSide } from "@/lib/offline/span-conflict-clusters";
import type { BlockReviewModel } from "@/lib/offline/base-aligned-review";
import type { ConflictReviewColors } from "@/lib/offline/conflict-review-colors";
import "@/components/editor/extensions/ConflictInline.css";
import { EditorBlockDragLayer } from "@/components/editor/EditorBlockDragLayer";
import { EditorBubbleMenu } from "@/components/editor/EditorBubbleMenu";
import { EditorLinkTooltip } from "@/components/editor/EditorLinkTooltip";
import { SpellSuggestionPopover } from "@/components/editor/SpellSuggestionPopover";
import {
  applyCommentHighlightsToEditor,
  resolveHighlightCommentId,
  type StoredDocumentComment,
} from "@/lib/documents/comments";
import {
  findCommentIdAtClickTarget,
  scrollCommentIntoView,
} from "@/lib/documents/comment-navigation";
import {
  imageServeUrl,
  insertCitation,
  insertParagraphAfterBlock,
} from "@/lib/documents/editor-commands";
import {
  clampActiveIndex,
  computeSlashMenuPosition,
  computeSlashPlacement,
} from "@/lib/documents/menu-position";
import "./TipTapEditor.css";

type TipTapEditorProps = {
  content: Record<string, unknown>;
  contentSyncToken?: number;
  editable?: boolean;
  /** When set, TipTap uses Yjs CRDT collaboration instead of LWW content replace. */
  ydoc?: Y.Doc | null;
  collabProvider?: SupabaseYjsProvider | null;
  collaborationUser?: CollaborationUser | null;
  /** True once the local Y.Doc is ready (IDB loaded) — binds Collaboration extension. */
  collabDocReady?: boolean;
  /** True once the Realtime provider has synced with peers (or solo fallback). */
  collabSynced?: boolean;
  /** True only when this Y.Doc has never been seeded (no local/server CRDT history yet). */
  collabNeedsInitialSeed?: boolean;
  /** Called after the one-time JSON→Y.Doc seed completes (for immediate server persist). */
  onCollabBootstrapped?: () => void;
  lockedBlockId?: string | null;
  lockedBlockIndex?: number | null;
  lockedSelectionFrom?: number | null;
  lockedByName?: string | null;
  remoteCursors?: RemoteCollaboratorCursor[];
  documentId?: string | null;
  workspaceId?: string | null;
  comments?: StoredDocumentComment[];
  onAddComment?: (input: {
    blockId: string;
    blockIndex: number;
    from: number;
    to: number;
    anchorText: string;
    text: string;
  }) => StoredDocumentComment | null;
  onCommentsDocumentSync?: (editor: Editor) => void;
  onUpdate: (content: Record<string, unknown>, plainText: string) => void;
  onAsk?: (selectedText?: string) => void;
  askOffline?: boolean;
  selectedCommentId?: string | null;
  hoverCommentId?: string | null;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  onCommentHighlightClick?: (commentId: string) => void;
  onRegisterScrollToComment?: (scrollToComment: (commentId: string) => void) => void;
  onRegisterInsertCitation?: (
    insertCitation: (input: import("@/lib/documents/editor-commands").CitationInsertInput) => void,
  ) => void;
  onBlur?: (editor: Editor) => void;
  onRegisterEditor?: (editor: Editor | null) => void;
  onActiveBlockChange?: (blockId: string | null, blockIndex: number | null) => void;
  onSelectionChange?: (from: number, to: number) => void;
  offlineConflictClusters?: SpanConflictCluster[];
  offlineConflictReviews?: BlockReviewModel[];
  conflictReviewColors?: ConflictReviewColors | null;
  activeOfflineConflictClusterId?: string | null;
  onActivateOfflineConflictCluster?: (clusterId: string) => void;
  onResolveOfflineCluster?: (
    clusterId: string,
    side: SpanConflictVariantSide,
  ) => void;
};

type SlashState = {
  items: SlashMenuItem[];
  query: string;
  activeIndex: number;
  placement: SlashMenuPlacement;
  style: { top: number; left: number };
};

function runSlashCommand(
  editor: Editor,
  range: { from: number; to: number },
  item: SlashMenuItem,
  onTableRequest: () => void,
  onImageRequest: (insertPos: number) => void,
) {
  editor.chain().focus().deleteRange(range).run();

  switch (item.id) {
    case "paragraph":
      insertParagraphAfterBlock(editor);
      break;
    case "heading":
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      break;
    case "divider":
      editor.chain().focus().setHorizontalRule().run();
      insertParagraphAfterBlock(editor);
      break;
    case "blockquote":
      editor.chain().focus().toggleBlockquote().run();
      break;
    case "citation":
      editor
        .chain()
        .focus()
        .insertContent({
          type: "citation",
          attrs: {
            sourceTitle: "",
            excerpt: "",
          },
        })
        .run();
      insertParagraphAfterBlock(editor);
      break;
    case "table":
      onTableRequest();
      break;
    case "image":
      onImageRequest(range.from);
      break;
    default:
      break;
  }
}

function buildSlashState(
  props: SuggestionProps<SlashMenuItem>,
  activeIndex: number,
): SlashState | null {
  const rect = props.clientRect?.();
  if (!rect) return null;

  const placement = computeSlashPlacement(rect);
  const position = computeSlashMenuPosition(rect, placement);
  const items = props.items;
  const nextIndex = clampActiveIndex(activeIndex, items.length);

  return {
    items,
    query: props.query,
    activeIndex: nextIndex,
    placement: position.placement,
    style: { top: position.top, left: position.left },
  };
}

export function TipTapEditor({
  content,
  contentSyncToken = 0,
  editable = true,
  ydoc = null,
  collabProvider = null,
  collaborationUser = null,
  collabDocReady = false,
  collabSynced = false,
  collabNeedsInitialSeed = true,
  onCollabBootstrapped,
  lockedBlockId = null,
  lockedBlockIndex = null,
  lockedSelectionFrom = null,
  lockedByName = null,
  remoteCursors = [],
  documentId,
  workspaceId,
  comments = [],
  onAddComment,
  onCommentsDocumentSync,
  onUpdate,
  onAsk,
  askOffline = false,
  selectedCommentId = null,
  hoverCommentId = null,
  scrollContainerRef,
  onCommentHighlightClick,
  onRegisterScrollToComment,
  onRegisterInsertCitation,
  onBlur,
  onRegisterEditor,
  onActiveBlockChange,
  onSelectionChange,
  offlineConflictClusters = [],
  offlineConflictReviews = [],
  conflictReviewColors = null,
  activeOfflineConflictClusterId = null,
  onActivateOfflineConflictCluster,
  onResolveOfflineCluster,
}: TipTapEditorProps) {
  // Bind Collaboration to Y.Doc as soon as the CRDT is mounted.
  const collabMode = Boolean(ydoc);
  const collabCursorMode = Boolean(collabProvider && collaborationUser);
  const seededCollabRef = useRef(false);
  const collabSaveReadyRef = useRef(!collabMode);
  const onCollabBootstrappedRef = useRef(onCollabBootstrapped);
  onCollabBootstrappedRef.current = onCollabBootstrapped;
  const contentSnapshotRef = useRef(content);
  const collabNeedsInitialSeedRef = useRef(collabNeedsInitialSeed);
  collabNeedsInitialSeedRef.current = collabNeedsInitialSeed;

  const plainFromDoc = useCallback((doc: Record<string, unknown> | null | undefined) => {
    try {
      const nodes = (doc as { content?: unknown[] } | null)?.content;
      if (!Array.isArray(nodes)) return "";
      const walk = (n: unknown): string => {
        if (!n || typeof n !== "object") return "";
        const node = n as { text?: string; content?: unknown[] };
        if (typeof node.text === "string") return node.text;
        if (!Array.isArray(node.content)) return "";
        return node.content.map(walk).join("");
      };
      return nodes.map(walk).join("").trim();
    } catch {
      return "";
    }
  }, []);

  // Prefer the richer of prop vs live snapshot — never clobber typed text with a stale empty prop.
  useEffect(() => {
    const propPlain = plainFromDoc(content);
    const snapPlain = plainFromDoc(contentSnapshotRef.current);
    if (propPlain.length >= snapPlain.length) {
      contentSnapshotRef.current = content;
    }
  }, [content, plainFromDoc]);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const ydocRef = useRef(ydoc);
  ydocRef.current = ydoc;
  const collaborationUserRef = useRef(collaborationUser);
  collaborationUserRef.current = collaborationUser;
  const onResolveOfflineClusterRef = useRef(onResolveOfflineCluster);
  onResolveOfflineClusterRef.current = onResolveOfflineCluster;
  const onActivateOfflineConflictClusterRef = useRef(onActivateOfflineConflictCluster);
  onActivateOfflineConflictClusterRef.current = onActivateOfflineConflictCluster;
  const onActiveBlockChangeRef = useRef(onActiveBlockChange);
  onActiveBlockChangeRef.current = onActiveBlockChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;
  const onCommentHighlightClickRef = useRef(onCommentHighlightClick);
  onCommentHighlightClickRef.current = onCommentHighlightClick;

  const emphasizedCommentId = resolveHighlightCommentId(
    comments,
    selectedCommentId ?? hoverCommentId,
  );
  const emphasizedCommentIdRef = useRef(emphasizedCommentId);
  emphasizedCommentIdRef.current = emphasizedCommentId;

  const [slashState, setSlashState] = useState<SlashState | null>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [spellSuggestion, setSpellSuggestion] =
    useState<SpellSuggestionPayload | null>(null);
  const slashActiveIndexRef = useRef(0);
  const suggestionRef = useRef<SuggestionProps<SlashMenuItem> | null>(null);
  const slashMenuPointerRef = useRef(false);
  const slashExitTimerRef = useRef<number | null>(null);
  const pendingImageInsertPosRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorSurfaceRef = useRef<HTMLDivElement>(null);
  const commentsAppliedRef = useRef<string | null>(null);

  const handleCommentSave = useCallback(
    (text: string, range: { from: number; to: number }) => {
      const editor = editorRef.current;
      if (!editor || !onAddComment) return;

      const anchorText = editor.state.doc.textBetween(range.from, range.to, " ");
      ensureEditorBlockIds(editor);
      const block = resolveCommentBlock(editor, range.from);
      if (!block) return;

      const comment = onAddComment({
        blockId: block.blockId,
        blockIndex: block.blockIndex,
        from: range.from,
        to: range.to,
        anchorText,
        text,
      });

      if (!comment) return;

      editor
        .chain()
        .focus()
        .setTextSelection({ from: comment.from, to: comment.to })
        .setMark("commentHighlight", { commentId: comment.id })
        .run();
    },
    [onAddComment],
  );

  const clearSlashExitTimer = useCallback(() => {
    if (slashExitTimerRef.current !== null) {
      window.clearTimeout(slashExitTimerRef.current);
      slashExitTimerRef.current = null;
    }
  }, []);

  const closeSlashMenu = useCallback(() => {
    clearSlashExitTimer();
    setSlashState(null);
    suggestionRef.current = null;
  }, [clearSlashExitTimer]);

  const scheduleSlashExit = useCallback(() => {
    clearSlashExitTimer();
    slashExitTimerRef.current = window.setTimeout(() => {
      if (slashMenuPointerRef.current) return;
      closeSlashMenu();
    }, 150);
  }, [clearSlashExitTimer, closeSlashMenu]);

  const syncSlashPosition = useCallback(() => {
    const props = suggestionRef.current;
    if (!props) return;
    const next = buildSlashState(props, slashActiveIndexRef.current);
    if (next) setSlashState(next);
  }, []);

  const uploadImage = useCallback(
    async (file: File) => {
      const editor = editorRef.current;
      if (!editor || !documentId) return;

      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/app/api/documents/${documentId}/images`, {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || typeof data.path !== "string") {
        pendingImageInsertPosRef.current = null;
        console.error(
          "Image upload failed:",
          typeof data.error === "string" ? data.error : response.statusText,
        );
        return;
      }

      const storagePath = data.path as string;
      const insertPos =
        pendingImageInsertPosRef.current ?? editor.state.selection.from;
      pendingImageInsertPosRef.current = null;

      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, {
          type: "image",
          attrs: {
            src: imageServeUrl(storagePath),
            storagePath,
            alt: file.name,
          },
        })
        .run();
      insertParagraphAfterBlock(editor);
    },
    [documentId],
  );

  const requestTableModal = useCallback(() => {
    setTableModalOpen(true);
  }, []);

  const requestImagePicker = useCallback((insertPos: number) => {
    pendingImageInsertPosRef.current = insertPos;
    imageInputRef.current?.click();
  }, []);

  const executeSlashItem = useCallback(
    (item: SlashMenuItem) => {
      const props = suggestionRef.current;
      const editor = editorRef.current;
      if (!props || !editor) return;

      runSlashCommand(
        editor,
        props.range,
        item,
        requestTableModal,
        requestImagePicker,
      );
      closeSlashMenu();
    },
    [closeSlashMenu, requestImagePicker, requestTableModal],
  );

  const setSlashActiveIndex = useCallback(
    (index: number) => {
      const props = suggestionRef.current;
      if (!props) return;
      slashActiveIndexRef.current = clampActiveIndex(index, props.items.length);
      const next = buildSlashState(props, slashActiveIndexRef.current);
      if (next) setSlashState(next);
    },
    [],
  );

  const extensions = useMemo(() => {
    const list = [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        horizontalRule: {},
        history: collabMode ? false : undefined,
      }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Typography,
      DocumentLink.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      DocumentImage.configure({ inline: false, allowBase64: false }),
      CitationBlock,
      RhodesSuggestion,
      BlockId,
      ...(collabMode ? [] : [RemoteBlockLock]),
      CommentHighlight,
      SpellcheckExtension.configure({ enabled: true, locale: "en" }),
      ConflictInlineExtension.configure({
        onActivate: (clusterId) => {
          onActivateOfflineConflictClusterRef.current?.(clusterId);
        },
      }),
      Extension.create({
        name: "slashCommand",
        addProseMirrorPlugins() {
          return [
            Suggestion<SlashMenuItem>({
              editor: this.editor,
              char: "/",
              allowSpaces: false,
              items: ({ query }) => filterSlashItems(query),
              command: ({ editor: ed, range, props }) => {
                runSlashCommand(
                  ed,
                  range,
                  props,
                  requestTableModal,
                  requestImagePicker,
                );
              },
              render: () => ({
                onStart: (props: SuggestionProps<SlashMenuItem>) => {
                  clearSlashExitTimer();
                  suggestionRef.current = props;
                  slashActiveIndexRef.current = 0;
                  setSlashState(buildSlashState(props, 0));
                },
                onUpdate: (props: SuggestionProps<SlashMenuItem>) => {
                  suggestionRef.current = props;
                  setSlashState(
                    buildSlashState(props, slashActiveIndexRef.current),
                  );
                },
                onKeyDown: ({ event }) => {
                  const props = suggestionRef.current;
                  if (!props) return false;

                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeSlashMenu();
                    return true;
                  }

                  if (event.key === " ") {
                    scheduleSlashExit();
                    return false;
                  }

                  const items = props.items;
                  if (items.length === 0) return false;

                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSlashActiveIndex(slashActiveIndexRef.current + 1);
                    return true;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSlashActiveIndex(slashActiveIndexRef.current - 1);
                    return true;
                  }

                  if (event.key === "Enter") {
                    event.preventDefault();
                    const item = items[slashActiveIndexRef.current];
                    if (item && editorRef.current) {
                      runSlashCommand(
                        editorRef.current,
                        props.range,
                        item,
                        requestTableModal,
                        requestImagePicker,
                      );
                      closeSlashMenu();
                    }
                    return true;
                  }

                  return false;
                },
                onExit: () => {
                  if (slashMenuPointerRef.current) return;
                  scheduleSlashExit();
                },
              }),
            }),
          ];
        },
      }),
    ];

    if (ydoc) {
      list.push(
        Collaboration.configure({
          document: ydoc,
        }),
      );
      if (collabCursorMode && collabProvider && collaborationUser) {
        list.push(
          CollaborationCursor.configure({
            provider: collabProvider,
            user: {
              name: collaborationUser.name,
              color: collaborationUser.color,
            },
          }),
        );
      }
    }

    return list;
  }, [
    clearSlashExitTimer,
    closeSlashMenu,
    collabCursorMode,
    collabDocReady,
    collabMode,
    collabProvider,
    collaborationUser,
    requestImagePicker,
    requestTableModal,
    scheduleSlashExit,
    setSlashActiveIndex,
    ydoc,
  ]);

  const editor = useEditor(
    {
      extensions,
      // Keep server JSON until Yjs is synced; then Collaboration takes over.
      content: collabMode ? undefined : content,
      editable,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "editor-body tiptap-editor-body",
          spellcheck: "true",
        },
        handleDrop: (_view, event) => {
          const file = event.dataTransfer?.files?.[0];
          if (!file?.type.startsWith("image/")) return false;
          event.preventDefault();
          void uploadImage(file);
          return true;
        },
        handleClick: (_view, _pos, event) => {
          const commentId = findCommentIdAtClickTarget(event.target);
          if (!commentId) return false;
          onCommentHighlightClickRef.current?.(commentId);
          return true;
        },
      },
      onCreate: ({ editor: instance }) => {
        if (!collabMode) {
          collabSaveReadyRef.current = true;
          return;
        }
        // Seed from Postgres/React JSON at most once ever per document — the
        // Y.Doc itself (via collabNeedsInitialSeed) is the source of truth for
        // whether this has already happened, so we never re-inject content
        // into an existing CRDT (that duplicates text across peers).
        if (collabNeedsInitialSeedRef.current && !seededCollabRef.current) {
          const snapshot = contentSnapshotRef.current;
          const plainFromContent = plainFromDoc(snapshot);
          const ydocHasBody =
            ydoc != null && ydoc.getXmlFragment("default").length > 0;
          if (!ydocHasBody && plainFromContent.length > 0) {
            instance.commands.setContent(snapshot);
            ensureEditorBlockIds(instance);
            contentSnapshotRef.current = instance.getJSON() as Record<
              string,
              unknown
            >;
            onUpdateRef.current(instance.getJSON(), instance.getText());
          }
          if (ydoc && !ydocHasBody) {
            ydoc.getMap("rhodes").set("seeded", true);
            onCollabBootstrappedRef.current?.();
          }
        }
        collabSaveReadyRef.current = true;
        seededCollabRef.current = true;
      },
      // Schema-level document corruption (e.g. a malformed CRDT merge producing
      // a node the schema can't parse) fails silently otherwise — TipTap
      // disables collaboration and keeps rendering whatever it managed to
      // parse. Surface it loudly so a broken merge is never mistaken for "no
      // conflict happened".
      onContentError: ({ error }) => {
        console.error("[tiptap] schema content error:", error);
      },
      onUpdate: ({ editor: instance, transaction }) => {
        if (transaction.getMeta(BLOCK_ID_TRANSACTION_META)) {
          return;
        }
        if (collabMode && !collabSaveReadyRef.current) {
          return;
        }
        // Stamp the collaborative block-audit trail for genuinely local edits
        // only — never for changes y-prosemirror just applied from a remote
        // Yjs update, or we'd misattribute other people's edits to ourselves.
        const currentYdoc = ydocRef.current;
        const currentUser = collaborationUserRef.current;
        if (currentYdoc && currentUser && transaction.docChanged) {
          const isRemoteChange = Boolean(
            (
              transaction.getMeta(ySyncPluginKey) as
                | { isChangeOrigin?: boolean }
                | undefined
            )?.isChangeOrigin,
          );
          if (!isRemoteChange) {
            const touchedBlockIds = computeTouchedBlockIds(
              transaction.before,
              instance.state.doc,
            );
            if (touchedBlockIds.length > 0) {
              recordBlockAudit(
                currentYdoc,
                touchedBlockIds,
                currentUser.userId,
                currentUser.name,
              );
            }
          }
        }
        const nextJson = instance.getJSON() as Record<string, unknown>;
        const nextPlain = instance.getText().trim();
        const prevPlain = plainFromDoc(contentSnapshotRef.current);
        // Spurious empty Collaboration/init update during bootstrap only.
        if (
          !collabSaveReadyRef.current &&
          nextPlain.length === 0 &&
          prevPlain.length > 0
        ) {
          instance.commands.setContent(contentSnapshotRef.current);
          return;
        }
        contentSnapshotRef.current = nextJson;
        onUpdateRef.current(nextJson, instance.getText());
      },
      onBlur: ({ editor: instance }) => {
        onBlurRef.current?.(instance);
      },
    },
    [collabMode, documentId, extensions, plainFromDoc],
  );

  editorRef.current = editor;

  useEffect(() => {
    onRegisterEditor?.(editor ?? null);
    return () => onRegisterEditor?.(null);
  }, [editor, onRegisterEditor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || collabMode) return;

    const collaboration: RemoteCollaborationMeta = {
      lockedBlockId,
      lockedBlockIndex,
      lockedSelectionFrom,
      lockedByName,
      remoteCursors: [],
    };

    editor.view.dispatch(
      editor.state.tr.setMeta(remoteCollaborationKey, collaboration),
    );
  }, [collabMode, editor, lockedBlockId, lockedBlockIndex, lockedSelectionFrom, lockedByName]);

  useEffect(() => {
    // Yjs owns the document — never LWW setContent over live peers.
    if (collabMode) return;
    if (!editor || contentSyncToken === 0) return;
    const incoming = JSON.stringify(content);
    const current = JSON.stringify(editor.getJSON());
    if (incoming === current) return;

    const { from, to } = editor.state.selection;
    editor.commands.setContent(content, false);
    ensureEditorBlockIds(editor);

    const docSize = editor.state.doc.content.size;
    if (docSize > 0 && from >= 1) {
      const safeFrom = Math.min(from, docSize);
      const safeTo = Math.min(Math.max(to, safeFrom), docSize);
      editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
    }
  }, [collabMode, content, contentSyncToken, editor]);

  useEffect(() => {
    if (!editor) return;

    ensureEditorBlockIds(editor);

    const syncActiveBlock = () => {
      const { from, to } = editor.state.selection;
      onSelectionChangeRef.current?.(from, to);
      const match = getTopLevelBlockAtPos(editor, from);
      const blockId = match ? readBlockId(match.node) : null;
      const blockIndex =
        getTopLevelBlockIndexFromPos(editor, from) ?? match?.index ?? null;
      onActiveBlockChangeRef.current?.(blockId, blockIndex);
    };

    editor.on("selectionUpdate", syncActiveBlock);
    editor.on("focus", syncActiveBlock);
    editor.on("update", syncActiveBlock);
    window.requestAnimationFrame(() => {
      syncActiveBlock();
    });

    return () => {
      editor.off("selectionUpdate", syncActiveBlock);
      editor.off("focus", syncActiveBlock);
      editor.off("update", syncActiveBlock);
    };
  }, [editor]);

  useEffect(() => {
    if (!slashState) return;

    const onViewportChange = () => syncSlashPosition();
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);

    return () => {
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [slashState, syncSlashPosition]);

  useEffect(() => {
    if (!editor || !onCommentsDocumentSync || comments.length === 0) return;

    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      ensureEditorBlockIds(editor);
      onCommentsDocumentSync(editor);
    };

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(sync);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [documentId, editor, onCommentsDocumentSync]);

  useEffect(() => {
    if (!editor) return;

    const signature = comments
      .map(
        (comment) =>
          `${comment.id}:${comment.parentId ?? ""}:${comment.from}:${comment.to}`,
      )
      .join("|");

    if (commentsAppliedRef.current === signature) return;

    applyCommentHighlightsToEditor(editor, comments);
    commentsAppliedRef.current = signature;
  }, [comments, contentSyncToken, editor]);

  useEffect(() => {
    commentsAppliedRef.current = null;
  }, [documentId, contentSyncToken]);

  useEffect(() => {
    if (!editor) return;

    const applyCommentEmphasis = () => {
      const activeId = emphasizedCommentIdRef.current;
      const root = editor.view.dom;
      root.querySelectorAll(".editor-comment-highlight").forEach((node) => {
        const commentId = node.getAttribute("data-comment-id");
        node.classList.toggle(
          "editor-comment-highlight--emphasized",
          Boolean(activeId && commentId === activeId),
        );
      });
    };

    applyCommentEmphasis();
    editor.on("update", applyCommentEmphasis);
    editor.on("selectionUpdate", applyCommentEmphasis);

    return () => {
      editor.off("update", applyCommentEmphasis);
      editor.off("selectionUpdate", applyCommentEmphasis);
    };
  }, [editor, comments]);

  useEffect(() => {
    if (!editor) return;

    const activeId = emphasizedCommentIdRef.current;
    const root = editor.view.dom;
    root.querySelectorAll(".editor-comment-highlight").forEach((node) => {
      const commentId = node.getAttribute("data-comment-id");
      node.classList.toggle(
        "editor-comment-highlight--emphasized",
        Boolean(activeId && commentId === activeId),
      );
    });
  }, [editor, emphasizedCommentId, comments]);

  useEffect(() => {
    if (!editor || !onRegisterScrollToComment) return;

    onRegisterScrollToComment((commentId) => {
      const comment = comments.find((item) => item.id === commentId);
      const container = scrollContainerRef?.current;
      if (!comment || !container) return;
      scrollCommentIntoView(editor, container, comment);
      window.requestAnimationFrame(() => {
        const activeId = emphasizedCommentIdRef.current;
        editor.view.dom
          .querySelectorAll(".editor-comment-highlight")
          .forEach((node) => {
            const id = node.getAttribute("data-comment-id");
            node.classList.toggle(
              "editor-comment-highlight--emphasized",
              Boolean(activeId && id === activeId),
            );
          });
      });
    });
  }, [comments, editor, onRegisterScrollToComment, scrollContainerRef]);

  useEffect(() => {
    if (!editor || !onRegisterInsertCitation) return;
    onRegisterInsertCitation((input) => insertCitation(editor, input));
  }, [editor, onRegisterInsertCitation]);

  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.rhodesSpellcheck as {
      onSuggestionRequest: ((payload: SpellSuggestionPayload) => void) | null;
    };
    storage.onSuggestionRequest = (payload: SpellSuggestionPayload) => {
      setSpellSuggestion(payload);
    };
    return () => {
      storage.onSuggestionRequest = null;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.rhodesConflictInline as {
      refresh: (next: ConflictInlineState) => void;
    };
    const next: ConflictInlineState = {
      clusters: offlineConflictClusters,
      reviews: offlineConflictReviews,
      colors:
        offlineConflictClusters.length > 0 && offlineConflictReviews.length > 0
          ? conflictReviewColors
          : null,
      activeClusterId:
        activeOfflineConflictClusterId ??
        offlineConflictClusters[0]?.id ??
        null,
    };
    storage.refresh(next);
  }, [
    activeOfflineConflictClusterId,
    conflictReviewColors,
    editor,
    offlineConflictClusters,
    offlineConflictReviews,
  ]);

  return (
    <div className="tiptap-editor" ref={editorContainerRef}>
      {editor && (
        <EditorBubbleMenu
          editor={editor}
          onAsk={onAsk}
          askOffline={askOffline}
          workspaceId={workspaceId}
          documentId={documentId}
          onCommentSave={handleCommentSave}
          suppressed={Boolean(spellSuggestion)}
        />
      )}

      {editor && spellSuggestion && (
        <SpellSuggestionPopover
          editor={editor}
          payload={spellSuggestion}
          onClose={() => setSpellSuggestion(null)}
        />
      )}

      <EditorLinkTooltip containerRef={editorContainerRef} />

      <div className="tiptap-editor__surface" ref={editorSurfaceRef}>
        <EditorContent editor={editor} />

        {editor &&
          !collabCursorMode &&
          (remoteCursors.length > 0 ||
            lockedSelectionFrom != null ||
            lockedBlockIndex != null) && (
          <DocumentCollaborationOverlay
            editor={editor}
            surfaceRef={editorSurfaceRef}
            remoteCursors={remoteCursors}
            lockedBlockIndex={lockedBlockIndex}
            lockedSelectionFrom={lockedSelectionFrom}
            lockedByName={lockedByName}
          />
        )}

        {editor && (
          <EditorBlockDragLayer
            editor={editor}
            containerRef={editorSurfaceRef}
            onBlockMoved={() => {
              if (editor && onCommentsDocumentSync) {
                ensureEditorBlockIds(editor);
                onCommentsDocumentSync(editor);
              }
            }}
          />
        )}

      </div>

      {slashState && (
        <div
          className={`tiptap-editor__slash-anchor tiptap-editor__slash-anchor--${slashState.placement}`}
          style={{
            position: "fixed",
            top: slashState.style.top,
            left: slashState.style.left,
            zIndex: 40,
          }}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => {
            slashMenuPointerRef.current = true;
            clearSlashExitTimer();
          }}
          onMouseLeave={() => {
            slashMenuPointerRef.current = false;
            scheduleSlashExit();
          }}
        >
          <SlashMenu
            query={slashState.query}
            activeIndex={slashState.activeIndex}
            placement={slashState.placement}
            items={slashState.items}
            onItemHover={setSlashActiveIndex}
            onItemClick={(item) => executeSlashItem(item)}
          />
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="tiptap-editor__file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadImage(file);
          event.target.value = "";
        }}
      />

      <TableInsertModal
        open={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onInsert={(rows, cols) => {
          if (!editor) return;
          editor
            .chain()
            .focus()
            .insertTable({ rows, cols, withHeaderRow: true })
            .run();
          setTableModalOpen(false);
        }}
      />
    </div>
  );
}
