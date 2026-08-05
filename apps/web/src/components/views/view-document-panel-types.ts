/**
 * Types for the in-view document sidebar.
 * Kept in a CSS-free module so view engines can import types without
 * pulling editor/properties stylesheets into the board CSS chunk.
 */

export type ViewDocumentCreateContext =
  | {
      kind: "root";
      /** Mind-Map: bind the created document onto this placeholder node id. */
      bindNodeId?: string;
    }
  | {
      kind: "child";
      parentDocId: string;
      parentTitle?: string;
      /** Mind-Map layout node id to attach under (defaults to parentDocId). */
      parentNodeId?: string;
    }
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
    }
  | {
      /** Read-only document body (e.g. Knowledge Graph explore). */
      mode: "viewing";
      documentId: string;
    };

export type ViewDocumentPanelProps = {
  state: ViewDocumentPanelState;
  onClose: () => void;
  onOpenFullPage: (documentId: string, title?: string) => void;
  /** Called after create; parent should switch panel state to `editing`. */
  onDocumentCreated?: (
    document: { id: string; title: string },
    createContext?: ViewDocumentCreateContext,
  ) => void;
  /** Fired when board-visible fields change (title/metadata), not on every content keystroke. */
  onDocumentUpdated?: () => void;
  /** Live title while typing in the sidebar editor (for canvas label sync). */
  onDocumentTitleChange?: (documentId: string, title: string) => void;
  /**
   * Optional connections list for explore surfaces (Knowledge Graph).
   * Shown above the article in viewing mode.
   */
  connections?: ViewDocumentPanelConnection[];
  onSelectConnection?: (documentId: string) => void;
  /**
   * `dock` (default) = absolute right overlay for boards.
   * `fill` = fills parent (Wiki center pane).
   */
  placement?: "dock" | "fill";
  /** When true, hide the panel close control (Wiki keeps an open document). */
  hideClose?: boolean;
};

export type ViewDocumentPanelConnection = {
  documentId: string;
  title: string;
  direction: "incoming" | "outgoing";
  fieldLabel: string;
};
