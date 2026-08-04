/**
 * Types for the in-view document sidebar.
 * Kept in a CSS-free module so view engines can import types without
 * pulling editor/properties stylesheets into the board CSS chunk.
 */

export type ViewDocumentCreateContext =
  | { kind: "root" }
  | { kind: "child"; parentDocId: string; parentTitle?: string }
  | {
      kind: "seed";
      metadata?: Record<string, unknown>;
    };

export type ViewDocumentPanelState =
  | { mode: "closed" }
  | {
      mode: "pick-template";
      viewType: string;
      createContext?: ViewDocumentCreateContext;
    }
  | {
      mode: "editing";
      documentId: string;
    };

export type ViewDocumentPanelProps = {
  state: ViewDocumentPanelState;
  onClose: () => void;
  onOpenFullPage: (documentId: string, title?: string) => void;
  /** Called after create; parent should switch panel state to `editing`. */
  onDocumentCreated: (document: { id: string; title: string }) => void;
  /** Fired when board-visible fields change (title/metadata), not on every content keystroke. */
  onDocumentUpdated?: () => void;
};
