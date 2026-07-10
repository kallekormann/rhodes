"use client";

import { useState } from "react";
import { Loader, Search } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { documents, recentGroups } from "@/data/documents";
import { overviewTemplates } from "@/data/templates";
import { Divider } from "@/components/Divider";
import { GroupLabel, SectionHeader } from "@/components/SectionHeader";
import { Input } from "@/components/Input";
import { ItemList, ListRow } from "@/components/ListRow";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StatusPill } from "@/components/StatusPill";
import { TemplateCard, TemplateCardGrid } from "@/components/TemplateCard";
import "./DocumentsView.css";

type DocTab = "recent" | "all" | "favorites";

export function DocumentsView() {
  const { setView, setDocumentTitle, setDocumentId, isFavorite } = useApp();
  const [tab, setTab] = useState<DocTab>("recent");
  const [filter, setFilter] = useState("");

  const byTab = documents.filter((doc) => {
    if (tab === "favorites") return isFavorite(doc.id);
    if (tab === "recent") return recentGroups.includes(doc.group);
    return true;
  });

  const filtered = byTab.filter((d) =>
    d.title.toLowerCase().includes(filter.toLowerCase()),
  );

  const groups = [...new Set(filtered.map((d) => d.group))];

  return (
    <div className="canvas-view documents-view">
      <div className="documents-view__scroll overlay-scrollbar">
        <div className="documents-view__inner">
          <section className="documents-section">
            <SectionHeader
              title="Templates"
              action={{ label: "More templates", onClick: () => setView("templates") }}
            />
            <TemplateCardGrid>
              {overviewTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  name={template.name}
                  description={template.shortDescription}
                  onClick={() => setView("templates")}
                />
              ))}
            </TemplateCardGrid>
          </section>

          <Divider />

          <section className="documents-section">
            <div className="documents-toolbar">
              <Input
                placeholder="Search documents…"
                value={filter}
                onChange={setFilter}
                icon={<Search size={18} strokeWidth={1.75} />}
                className="documents-toolbar__search"
              />
              <SegmentedControl
                options={[
                  { value: "recent", label: "Recent" },
                  { value: "all", label: "All" },
                  { value: "favorites", label: "Favorites" },
                ]}
                value={tab}
                onChange={setTab}
              />
            </div>

            {filtered.length === 0 ? (
              <p className="documents-empty caption">
                {tab === "favorites"
                  ? "No favorite documents yet. Open a document and mark it as Favorite."
                  : "No documents match your search."}
              </p>
            ) : (
              groups.map((group) => (
                <div key={group} className="doc-group">
                  <GroupLabel>{group}</GroupLabel>
                  <ItemList>
                    {filtered
                      .filter((d) => d.group === group)
                      .map((doc) => (
                        <ListRow
                          key={doc.id}
                          title={doc.title}
                          meta={doc.updated}
                          trailing={
                            <StatusPill
                              variant={doc.status}
                              icon={doc.status === "progress" ? Loader : undefined}
                            />
                          }
                          onClick={() => {
                            setDocumentId(doc.id);
                            setDocumentTitle(doc.title);
                            setView("editor");
                          }}
                        />
                      ))}
                  </ItemList>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
