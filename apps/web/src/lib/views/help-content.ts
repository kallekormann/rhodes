export type ViewHelpContent = {
  description: string;
  setupSteps: string[];
  actions: string[];
};

export const VIEW_HELP_CONTENT = {
  kanban: {
    description:
      "Kanban turns a status or select property into columns so you can move work through a process—from backlog to done, or any stages you define.",
    setupSteps: [
      "Add a status or single-select property to this scope (from a document’s Properties, or via Settings).",
      "Open Board settings and choose which property defines the process stages.",
      "Optionally rename the board in Board settings to match your workflow.",
    ],
    actions: [
      "Drag cards between columns to advance them through the process.",
      "Double-click or press Enter on a card to open the document.",
      "Search within a column, or change the grouping property in Board settings.",
    ],
  },
  dashboard: {
    description:
      "Dashboard summarizes this scope’s documents with widgets — stats, breakdowns, trends, and lists — each powered by a metadata property.",
    setupSteps: [
      "Make sure documents have the properties you want to measure (numbers, status, dates, etc.).",
      "Click Add widget and choose a type, aggregation, and field.",
      "Optionally rename the dashboard in View settings.",
    ],
    actions: [
      "Add, edit, or remove widgets to change what you track.",
      "Click a list item to open that document.",
      "Use breakdown and trend widgets to group by status or date properties.",
    ],
  },
  calendar: {
    description:
      "Calendar places documents on a month grid or agenda list using a date or date-range property from this scope.",
    setupSteps: [
      "Add a date or date-range property to documents in this scope.",
      "Open Calendar settings and pick which date field to use (or keep the auto-detected one).",
      "Optionally set a custom title and subtitle.",
    ],
    actions: [
      "Switch Month and List with the control above the calendar.",
      "Move between months with the arrows, jump to Today, or narrow the window with the date range picker.",
      "Click a document to open it in the editor.",
      "Change the date field in Calendar settings if you have more than one.",
    ],
  },
  gantt: {
    description:
      "Roadmap (Gantt) plots documents on a timeline using start (and optional end) date properties, with optional grouping.",
    setupSteps: [
      "Add a date or date-range property for when work starts (and optionally ends).",
      "Open Roadmap settings to choose the start field, optional end field, and optional group-by property.",
      "Give documents values for those fields so they appear on the chart.",
    ],
    actions: [
      "Browse the timeline to see schedule and overlap.",
      "Open a task from the chart to edit the document.",
      "Overlapping sibling tasks are highlighted when they collide.",
    ],
  },
  mindmap: {
    description:
      "Mind-Map lets you place documents on a canvas and connect them via a relation (linked document) property.",
    setupSteps: [
      "Add a Linked document (relation) property to this scope.",
      "Open Mind-Map settings and choose which relation field new connections write to.",
      "Add nodes to the canvas, then drag between handles to connect them.",
    ],
    actions: [
      "Add or remove documents on the canvas without deleting them from the scope.",
      "Drag nodes to rearrange; positions are saved for this view.",
      "Draw connections to write relation metadata on the source document.",
    ],
  },
  graph: {
    description:
      "Knowledge Graph shows how documents in this scope relate to each other through relation properties, with optional community highlighting.",
    setupSteps: [
      "Add one or more Linked document properties and connect documents (for example from Mind-Map).",
      "Open Graph settings to limit which relation fields are traversed, or toggle communities.",
      "Optionally rename the graph title and subtitle.",
    ],
    actions: [
      "Search to highlight matching documents.",
      "Click a node to see its connections and jump between them.",
      "Open a document from the explain panel into the editor.",
    ],
  },
} as const satisfies Record<string, ViewHelpContent>;
