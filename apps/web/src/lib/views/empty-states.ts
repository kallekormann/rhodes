/**
 * Quiet empty-state copy. Short titles, one soft line of help, optional CTA labels.
 * Visual tone lives in ViewEmptyState — keep wording calm and specific.
 */

export type EmptyStateCopy = {
  title: string;
  description?: string;
  hint?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
};

export function documentsEmptyCopy(input: {
  canWrite: boolean;
  offline: boolean;
  tab: "recent" | "all" | "favorites" | "archive" | "shared" | string;
  filtered: boolean;
}): EmptyStateCopy {
  if (input.filtered) {
    return {
      title: "No matching documents",
      description: "Try a different search or clear filters.",
    };
  }

  if (input.tab === "favorites") {
    return {
      title: "No favorites",
      description: "Mark a document as favorite to pin it here.",
    };
  }
  if (input.tab === "archive") {
    return {
      title: "Nothing archived",
      description: "Archived documents appear here.",
    };
  }
  if (input.tab === "shared") {
    return {
      title: "Nothing shared yet",
      description: "Shared documents show up here.",
    };
  }

  if (input.offline) {
    return {
      title: "Nothing cached offline",
      description: "Open documents while online to keep them available offline.",
    };
  }

  if (!input.canWrite) {
    return {
      title: "No documents yet",
    };
  }

  return {
    title: "No documents yet",
    description: "Create one, or start from a template.",
    primaryLabel: "New document",
    secondaryLabel: "Templates",
  };
}

export function libraryEmptyCopy(input: {
  canWrite: boolean;
  filtered: boolean;
}): EmptyStateCopy {
  if (input.filtered) {
    return {
      title: "No matching sources",
      description: "Clear filters to see everything.",
    };
  }
  if (!input.canWrite) {
    return { title: "No sources yet" };
  }
  return {
    title: "No sources yet",
    description: "Upload a file above to add it to this scope’s library.",
  };
}

export function templatesEmptyCopy(mine: boolean): EmptyStateCopy {
  if (mine) {
    return {
      title: "No templates of yours yet",
      description: "Save a document as a template to reuse its structure.",
      primaryLabel: "Create template",
    };
  }
  return {
    title: "Nothing in this category",
  };
}

export function kanbanEmptyCopy(input: {
  canWrite: boolean;
  hasBoards: boolean;
  hasGroupField: boolean;
}): EmptyStateCopy {
  if (!input.hasBoards) {
    return {
      title: input.canWrite ? "No boards yet" : "No boards",
      description: input.canWrite
        ? "Boards group documents by status or select properties."
        : undefined,
      primaryLabel: input.canWrite ? "New board" : undefined,
    };
  }
  if (!input.hasGroupField) {
    return {
      title: "Needs a status or select property",
      description: "Add one in Settings, or use a template that includes it.",
    };
  }
  return {
    title: "No cards yet",
    primaryLabel: input.canWrite ? "New card" : undefined,
  };
}

export function dashboardEmptyCopy(canWrite: boolean): EmptyStateCopy {
  return {
    title: canWrite ? "No widgets yet" : "No widgets",
    description: canWrite
      ? "Add a stat, breakdown, trend, or list."
      : undefined,
    primaryLabel: canWrite ? "Add widget" : undefined,
  };
}

export function wikiEmptyCopy(input: {
  canWrite: boolean;
  hasSpaces: boolean;
  hasHome: boolean;
}): EmptyStateCopy {
  if (!input.hasSpaces) {
    return {
      title: input.canWrite ? "No Spaces yet" : "No Spaces",
      description: input.canWrite
        ? "A Space is a home page with nested wiki pages."
        : undefined,
      primaryLabel: input.canWrite ? "New Space" : undefined,
    };
  }
  if (!input.hasHome) {
    return {
      title: "Space home isn’t set",
      primaryLabel: input.canWrite ? "Create Space home" : undefined,
    };
  }
  return {
    title: "Select a page",
    description: "Choose one in the tree to open it here.",
  };
}

export function knowledgeGraphEmptyCopy(canWrite: boolean): EmptyStateCopy {
  return {
    title: "Nothing to show yet",
    description:
      "Links between documents and citations to library files appear here.",
    primaryLabel: canWrite ? "Open Library" : undefined,
  };
}

export function ganttEmptyCopy(input: {
  canWrite: boolean;
  hasDateField: boolean;
  fieldLabel?: string;
}): EmptyStateCopy {
  if (!input.hasDateField) {
    return {
      title: "Needs a date property",
      description: "Add a date or date range in Settings to plot the timeline.",
    };
  }
  return {
    title: "No dated documents",
    description: `Set “${input.fieldLabel ?? "start date"}” on a document to place it here.`,
    primaryLabel: input.canWrite ? "New entry" : undefined,
  };
}

export function mindMapEmptyCopy(canWrite: boolean): EmptyStateCopy {
  return {
    title: canWrite ? "No topic yet" : "Empty map",
    description: canWrite
      ? "Choose a template for the center, then add branches."
      : undefined,
    primaryLabel: canWrite ? "Choose template" : undefined,
  };
}
