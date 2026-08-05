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
      "Roadmap (Gantt) plots documents on a timeline using a start date property and an optional end date — or planned duration in days (e.g. A/B `planned_duration_days`) when end is unset.",
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
      "Mind-Map is a tree of documents. Start with a central topic, then add children — each node is a real document you can open and edit.",
    setupSteps: [
      "Open Mind-Map — the central topic is selected and the template picker opens.",
      "Choose a template and name the topic; the card label updates as you type.",
      "Use + on a node to pick a template for a child, or trash to delete it.",
    ],
    actions: [
      "Click a card to edit it in the sidebar.",
      "Drag from a topic onto another topic to nest it under that parent (or drag an existing link to a new parent). Connect to the root’s left/right side to flip a branch.",
      "Positions and the tree structure are saved for this mind-map tab.",
    ],
  },
  graph: {
    description:
      "Knowledge Graph is a 3D explorer of how documents relate through Linked document properties and how documents cite library files. Library sources appear as nodes (including isolates); citation edges connect when a TipTap citation references a file.",
    setupSteps: [
      "Add one or more Linked document properties and connect documents (for example from Mind-Map).",
      "Upload files to Library — every file in the scope appears as a graph node.",
      "Cite a library file in a document body to draw a citation edge.",
      "Open Graph settings to limit which relation fields are traversed, or toggle communities.",
    ],
    actions: [
      "Drag to orbit, scroll to zoom, and right-drag (or library pan) to move the camera.",
      "Search to dim non-matches and frame the results; press Enter to open the first match.",
      "Click a document node to highlight neighbors and read it in the side panel (view only).",
      "Click a library node to open the file preview.",
      "Open full page from the panel to edit in the document editor.",
    ],
  },
  wiki: {
    description:
      "Wiki is a Space (root document) with a nested page tree. Nesting writes Origin links — the same relationships Knowledge Graph and Rhodes can use.",
    setupSteps: [
      "Open Wiki — a Space home is created for the first tab.",
      "Use Wiki settings to rename the Space tab.",
      "Click + on a page (or Create) and pick a template (Blank is first).",
    ],
    actions: [
      "Select a page in the tree to edit it with the full document editor in the center pane.",
      "Drag pages to reorder siblings or drop onto a page to reparent.",
      "Use Properties, comments, share, and Insights from the editor chrome — same tools as Documents.",
      "Add more Spaces with + on the tab bar; overflow uses the same back/next controls as other views.",
    ],
  },
} as const satisfies Record<string, ViewHelpContent>;
