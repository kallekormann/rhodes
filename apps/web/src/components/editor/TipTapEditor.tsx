"use client";

import { Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Typography from "@tiptap/extension-typography";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SlashMenu,
  type SlashMenuItem,
  type SlashMenuPlacement,
} from "@/components/SlashMenu";
import { TableInsertModal } from "@/components/TableInsertModal";
import { filterSlashItems } from "@/components/editorSlash";
import { CitationBlock } from "@/components/editor/extensions/CitationBlock";
import { CommentHighlight } from "@/components/editor/extensions/CommentHighlight";
import { DocumentImage } from "@/components/editor/extensions/DocumentImage";
import { DocumentLink } from "@/components/editor/extensions/DocumentLink";
import { EditorBlockDragLayer } from "@/components/editor/EditorBlockDragLayer";
import { EditorBubbleMenu } from "@/components/editor/EditorBubbleMenu";
import { EditorCommentsOverlay } from "@/components/editor/EditorCommentsOverlay";
import { EditorLinkTooltip } from "@/components/editor/EditorLinkTooltip";
import type { StoredDocumentComment } from "@/lib/documents/comments";
import {
  imageServeUrl,
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
  editable?: boolean;
  documentId?: string | null;
  workspaceId?: string | null;
  comments?: StoredDocumentComment[];
  onAddComment?: (input: {
    from: number;
    to: number;
    anchorText: string;
    text: string;
  }) => StoredDocumentComment | null;
  onUpdate: (content: Record<string, unknown>, plainText: string) => void;
  onAsk?: () => void;
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
  editable = true,
  documentId,
  workspaceId,
  comments = [],
  onAddComment,
  onUpdate,
  onAsk,
}: TipTapEditorProps) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const [slashState, setSlashState] = useState<SlashState | null>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
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
  const [emphasizedCommentId, setEmphasizedCommentId] = useState<string | null>(null);
  const [isBlockDragging, setIsBlockDragging] = useState(false);
  const [commentLayoutTick, setCommentLayoutTick] = useState(0);

  const handleCommentSave = useCallback(
    (text: string, range: { from: number; to: number }) => {
      const editor = editorRef.current;
      if (!editor || !onAddComment) return;

      const anchorText = editor.state.doc.textBetween(range.from, range.to, " ");
      const comment = onAddComment({
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        horizontalRule: {},
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
      CommentHighlight,
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
    ],
    content,
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
    },
    onUpdate: ({ editor: instance }) => {
      onUpdateRef.current(instance.getJSON(), instance.getText());
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

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
    if (!editor || comments.length === 0) return;
    const signature = comments.map((comment) => `${comment.id}:${comment.from}:${comment.to}`).join("|");
    if (commentsAppliedRef.current === signature) return;

    const { state } = editor;
    let tr = state.tr;
    let changed = false;

    for (const comment of comments) {
      if (comment.from < 0 || comment.to > state.doc.content.size) continue;
      if (comment.from >= comment.to) continue;

      tr = tr.addMark(
        comment.from,
        comment.to,
        state.schema.marks.commentHighlight.create({ commentId: comment.id }),
      );
      changed = true;
    }

    if (changed) {
      editor.view.dispatch(tr);
      commentsAppliedRef.current = signature;
    }
  }, [comments, editor]);

  useEffect(() => {
    commentsAppliedRef.current = null;
  }, [documentId]);

  useEffect(() => {
    if (!editor) return;

    const applyCommentEmphasis = () => {
      const root = editor.view.dom;
      root.querySelectorAll(".editor-comment-highlight").forEach((node) => {
        const commentId = node.getAttribute("data-comment-id");
        node.classList.toggle(
          "editor-comment-highlight--emphasized",
          Boolean(emphasizedCommentId && commentId === emphasizedCommentId),
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
  }, [editor, emphasizedCommentId, comments]);

  return (
    <div className="tiptap-editor" ref={editorContainerRef}>
      {editor && (
        <EditorBubbleMenu
          editor={editor}
          onAsk={onAsk}
          workspaceId={workspaceId}
          documentId={documentId}
          onCommentSave={handleCommentSave}
        />
      )}

      <EditorLinkTooltip containerRef={editorContainerRef} />

      <div className="tiptap-editor__surface" ref={editorSurfaceRef}>
        <EditorContent editor={editor} />

        {editor && (
          <EditorBlockDragLayer
            editor={editor}
            containerRef={editorSurfaceRef}
            onDragActiveChange={setIsBlockDragging}
            onLayoutChange={() => setCommentLayoutTick((tick) => tick + 1)}
          />
        )}

        {editor && onAddComment && (
          <EditorCommentsOverlay
            editor={editor}
            containerRef={editorSurfaceRef}
            comments={comments}
            isDragging={isBlockDragging}
            layoutTick={commentLayoutTick}
            onEmphasizedCommentChange={setEmphasizedCommentId}
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
