import { FileText } from "lucide-react";
import { Loader } from "lucide-react";
import { useApp } from "../context/AppContext";
import { DropZone } from "../components/DropZone";
import { GroupLabel } from "../components/SectionHeader";
import { StatusPill } from "../components/StatusPill";
import "./LibraryView.css";

const sources = [
  {
    name: "Reforge Growth.pdf",
    size: "12 MB",
    status: "success" as const,
    date: "Nov 2",
  },
  {
    name: "AARRR Framework.pdf",
    size: "4 MB",
    status: "progress" as const,
    date: "Nov 3",
    label: "Indexing…",
  },
];

export function LibraryView() {
  const { setView } = useApp();

  return (
    <div className="canvas-view library-view">
      <div className="canvas-view__body">
        <DropZone className="library-view__drop" />

        <GroupLabel>Sources</GroupLabel>
        <ul className="source-list">
          {sources.map((src) => (
            <li key={src.name}>
              <button
                type="button"
                className="source-row"
                onClick={() => setView("editor")}
              >
                <FileText size={20} strokeWidth={1.75} className="source-row__icon" />
                <span className="source-row__name">{src.name}</span>
                <span className="source-row__size">{src.size}</span>
                <StatusPill
                  variant={src.status}
                  label={src.label}
                  icon={src.status === "progress" ? Loader : undefined}
                />
                <span className="source-row__date">{src.date}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
