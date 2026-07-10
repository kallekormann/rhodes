export type DocumentStatus = "progress" | "draft";

export type DocumentItem = {
  id: string;
  title: string;
  updated: string;
  status: DocumentStatus;
  group: string;
  favorite?: boolean;
};

export const documents: DocumentItem[] = [
  {
    id: "q3-product-spec",
    title: "Q3 Product Spec",
    updated: "Updated 8m ago",
    status: "progress",
    group: "Today",
    favorite: true,
  },
  {
    id: "meeting-notes-growth",
    title: "Meeting Notes — Growth",
    updated: "Updated 2h ago",
    status: "draft",
    group: "Today",
  },
  {
    id: "post-experiment-validation",
    title: "Post-Experiment Validation",
    updated: "Updated 1d ago",
    status: "draft",
    group: "Yesterday",
    favorite: true,
  },
  {
    id: "onboarding-retro",
    title: "Onboarding Retro",
    updated: "Updated 5d ago",
    status: "draft",
    group: "Last week",
  },
];

export const initialFavoriteIds = documents
  .filter((doc) => doc.favorite)
  .map((doc) => doc.id);

export const recentGroups = ["Today", "Yesterday"];
