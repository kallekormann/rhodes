export type LibrarySource = {
  id: string;
  title: string;
  kind: "pdf" | "article" | "note";
};

export const librarySources: LibrarySource[] = [
  { id: "reforge-growth", title: "Reforge Growth.pdf", kind: "pdf" },
  { id: "activation-playbook", title: "Activation Playbook.pdf", kind: "pdf" },
  { id: "onboarding-research", title: "Onboarding Research Notes", kind: "note" },
  { id: "arr-frameworks", title: "ARR Frameworks — Lenny's Newsletter", kind: "article" },
];
