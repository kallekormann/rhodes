"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

type TipTapEditorProps = {
  content: Record<string, unknown>;
  editable?: boolean;
  onUpdate: (content: Record<string, unknown>, plainText: string) => void;
};

export function TipTapEditor({
  content,
  editable = true,
  onUpdate,
}: TipTapEditorProps) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Start writing…" }),
      Typography,
      Link.configure({ openOnClick: false }),
    ],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "editor-body tiptap-editor-body",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onUpdateRef.current(instance.getJSON(), instance.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(content);
    if (current !== incoming) {
      editor.commands.setContent(content, false);
    }
  }, [editor, content]);

  return <EditorContent editor={editor} />;
}
