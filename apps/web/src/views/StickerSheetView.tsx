"use client";

import {
  ArrowRight,
  CircleCheck,
  Info,
  Lightbulb,
  Loader,
  LogOut,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { documents } from "@/data/documents";
import { overviewTemplates } from "@/data/templates";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { DatePicker } from "@/components/DatePicker";
import { DatePickerField } from "@/components/DatePickerField";
import { DateRangePicker, DateRangeField, type DateRange } from "@/components/DateRangePicker";
import { Dialog } from "@/components/Dialog";
import { DropZone } from "@/components/DropZone";
import { Divider } from "@/components/Divider";
import { Dropdown } from "@/components/Dropdown";
import { GroupLabel, SectionHeader, SectionTitle } from "@/components/SectionHeader";
import { IconButton } from "@/components/IconButton";
import { IconLabelButton } from "@/components/IconLabelButton";
import { Input } from "@/components/Input";
import { ItemList, ListRow } from "@/components/ListRow";
import { Modal } from "@/components/Modal";
import { NavLink } from "@/components/NavLink";
import { NeutralPill } from "@/components/NeutralPill";
import { Popover } from "@/components/Popover";
import { RadioGroup } from "@/components/Radio";
import { BlockDragShowcase } from "@/components/BlockDragShowcase";
import { CommentShowcase } from "@/components/CommentShowcase";
import { EditorTableShowcase } from "@/components/EditorTableShowcase";
import { AskComposerShowcase } from "@/components/AskComposerShowcase";
import { AskPanelShowcase } from "@/components/AskPanelShowcase";
import { BubbleMenuShowcase } from "@/components/BubbleMenuShowcase";
import { ChatMessageBubbleShowcase } from "@/components/ChatMessageBubbleShowcase";
import { ScopeSwitcherShowcase } from "@/components/ScopeSwitcherShowcase";
import { SlashMenuShowcase } from "@/components/SlashMenuShowcase";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StatusPill } from "@/components/StatusPill";
import { TabBar } from "@/components/TabBar";
import { TemplateCard, TemplateCardGrid } from "@/components/TemplateCard";
import { TextArea } from "@/components/TextArea";
import { Toast } from "@/components/Toast";
import { Toggle } from "@/components/Toggle";
import "./StickerSheetView.css";

const swatches = [
  { name: "Accent", var: "--color-accent" },
  { name: "Accent hover", var: "--color-accent-hover" },
  { name: "Accent muted", var: "--color-accent-muted" },
  { name: "Background", var: "--color-bg" },
  { name: "Surface", var: "--color-surface" },
  { name: "Float bg", var: "--color-float-bg" },
  { name: "Float border", var: "--color-float-border" },
  { name: "Text", var: "--color-text" },
  { name: "Text secondary", var: "--color-text-secondary" },
  { name: "Success", var: "--color-success" },
  { name: "Warning", var: "--color-warning" },
  { name: "Error", var: "--color-error" },
];

export function StickerSheetView() {
  const { showToast } = useApp();
  const [seg, setSeg] = useState<"a" | "b">("a");
  const [tab, setTab] = useState<"docs" | "lib" | "team">("docs");
  const [themeRadio, setThemeRadio] = useState("light");
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const [fieldStatus, setFieldStatus] = useState("progress");
  const [searchOwner, setSearchOwner] = useState("kalle");
  const [plainText, setPlainText] = useState("Q3 activation goals");
  const [dueDate, setDueDate] = useState<Date | null>(new Date(2026, 10, 10));
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(2026, 9, 1),
    end: new Date(2026, 11, 15),
  });

  const statusOptions = [
    { id: "draft", label: "Draft" },
    { id: "progress", label: "In progress" },
    { id: "done", label: "Done" },
  ];

  const ownerOptions = [
    { id: "kalle", label: "Kalle" },
    { id: "team", label: "Growth team" },
    { id: "product", label: "Product" },
    { id: "design", label: "Design" },
  ];

  const listDemo = documents.slice(0, 3);

  return (
    <div className="sticker-sheet">
      <header className="sticker-sheet__header">
        <h1 className="type-page-title">Rhodes Design System</h1>
        <p className="type-caption">
          Tokens, typography, components — from{" "}
          <code>docs/03b-design-references.md</code>
        </p>
      </header>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Colors</h2>
        <div className="swatch-grid">
          {swatches.map((s) => (
            <div key={s.var} className="swatch">
              <div className="swatch__chip" style={{ background: `var(${s.var})` }} />
              <span className="swatch__name">{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Typography</h2>
        <div className="type-samples">
          <p className="type-page-title">Page title — 28px / 600</p>
          <p className="type-sticker-heading type-sticker-heading--inline">Sticker section — 18px / 600</p>
          <p className="type-doc-title">Document title — 28px / 600</p>
          <p className="type-h2">Editor H2 — 22px / 600</p>
          <p className="type-body">Editor body — 18px / 400</p>
          <p className="type-ui">UI body — 15px / 400</p>
          <p className="type-caption">Caption / meta — 13px / 400</p>
          <SectionTitle>Section title — 13px uppercase</SectionTitle>
          <GroupLabel>Group label — 13px uppercase</GroupLabel>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Navigation links</h2>
        <p className="type-caption sticker-section__desc">
          Internal accent links — e.g. „More templates“ on Overview. Default 15px, small 13px.
        </p>
        <div className="sticker-stack sticker-stack--row">
          <NavLink>View templates</NavLink>
          <NavLink icon={ArrowRight}>View templates</NavLink>
          <NavLink size="small">More templates</NavLink>
          <NavLink size="small" icon={ArrowRight}>
            More templates
          </NavLink>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Divider</h2>
        <p className="type-caption">Separates sections on Overview and in panels.</p>
        <Divider />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Comments</h2>
        <p className="type-caption sticker-section__desc">
          Add via bubble menu on selection. Marker shows count; hover highlights anchor text; click
          opens thread to the right.
        </p>
        <CommentShowcase />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Block drag &amp; drop</h2>
        <p className="type-caption sticker-section__desc">
          Grip handle on paragraph hover. Drag tilts block; drop zone appears between blocks.
        </p>
        <BlockDragShowcase />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Editor table</h2>
        <p className="type-caption sticker-section__desc">
          Insert with row/column config. Cells are editable; add rows and columns after insert.
        </p>
        <EditorTableShowcase />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Ask panel</h2>
        <p className="type-caption sticker-section__desc">
          Message bubbles (You right, Rhodes left) with composer — as used in the editor sidebar.
        </p>
        <AskPanelShowcase />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Chat message bubble</h2>
        <p className="type-caption sticker-section__desc">
          You: right aligned, square bottom-right. Rhodes: left aligned, square bottom-left.
        </p>
        <ChatMessageBubbleShowcase />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Ask composer</h2>
        <p className="type-caption sticker-section__desc">
          Unified input for Ask panel — multiline field with status row and small send button. Send
          disables while Rhodes responds.
        </p>
        <AskComposerShowcase />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Floating toolbar (bubble menu)</h2>
        <p className="type-caption sticker-section__desc">
          Appears above or below text selection. Uses float chrome tokens for contrast on the editor canvas.
        </p>
        <BubbleMenuShowcase />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Slash menu (/)</h2>
        <p className="type-caption sticker-section__desc">
          Opens at cursor when user types /. Flips above or below based on viewport space. Filterable, keyboard-navigable.
        </p>
        <SlashMenuShowcase />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Scope switcher</h2>
        <ScopeSwitcherShowcase />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Buttons — default</h2>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Text only</span>
          <div className="sticker-row">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
          </div>
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Icon + label</span>
          <div className="sticker-row">
            <Button icon={Plus}>Primary</Button>
            <Button variant="secondary" icon={Plus}>
              Secondary
            </Button>
            <Button variant="ghost" icon={Plus}>
              Ghost
            </Button>
            <Button variant="danger" icon={Trash2}>
              Danger
            </Button>
          </div>
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Icon only</span>
          <div className="sticker-row">
            <IconButton icon={Search} label="Search" />
            <IconButton icon={Plus} label="New" active />
          </div>
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Icon label buttons</span>
          <div className="sticker-row">
            <IconLabelButton variant="primary" icon={Plus}>
              Primary
            </IconLabelButton>
            <IconLabelButton variant="secondary" icon={Plus}>
              Secondary
            </IconLabelButton>
            <IconLabelButton variant="ghost" icon={Plus}>
              Ghost
            </IconLabelButton>
            <IconLabelButton variant="danger" icon={Trash2}>
              Danger
            </IconLabelButton>
          </div>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Buttons — small</h2>
        <div className="sticker-row">
          <Button size="small">Primary</Button>
          <Button size="small" variant="secondary">
            Secondary
          </Button>
          <Button size="small" variant="ghost">
            Ghost
          </Button>
          <Button size="small" variant="danger">
            Danger
          </Button>
          <Button size="small" icon={Plus} variant="secondary">
            With icon
          </Button>
          <IconButton icon={Search} label="Search" size="small" />
          <IconLabelButton size="small" variant="ghost" icon={Plus}>
            Ghost
          </IconLabelButton>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Meta icon label buttons</h2>
        <div className="sticker-row sticker-row--meta">
          <span className="sticker-meta-demo">Updated 8 min ago</span>
          <span className="sticker-meta-sep">·</span>
          <IconLabelButton variant="meta">Private</IconLabelButton>
          <span className="sticker-meta-sep">·</span>
          <IconLabelButton variant="meta" icon={Star}>
            Favorite
          </IconLabelButton>
          <IconLabelButton variant="meta" icon={SlidersHorizontal} active>
            Properties
          </IconLabelButton>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Template cards</h2>
        <SectionHeader title="Templates" action={{ label: "More templates", onClick: () => {} }} />
        <TemplateCardGrid>
          {overviewTemplates.map((t) => (
            <TemplateCard key={t.id} name={t.name} description={t.shortDescription} />
          ))}
        </TemplateCardGrid>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Lists</h2>
        <GroupLabel>Today</GroupLabel>
        <ItemList>
          {listDemo.map((doc) => (
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
            />
          ))}
        </ItemList>
        <div className="sticker-subsection">
          <GroupLabel>Templates list row</GroupLabel>
          <ItemList>
            <ListRow
              title="Meeting Notes"
              meta="Capture decisions, owners, and follow-ups."
              badge="Mine"
              active
            />
            <ListRow title="Product Spec" meta="Scope, objectives, and success metrics." />
          </ItemList>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Inputs</h2>
        <p className="type-caption sticker-section__desc">
          Field = white bordered (forms). Plain = subtle controls for Properties panel.
        </p>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Field (default)</span>
          <div className="sticker-stack sticker-stack--narrow">
            <Input
              placeholder="Search…"
              icon={<Search size={18} strokeWidth={1.75} />}
              hint="⌘K"
            />
            <TextArea
              label="Notes"
              placeholder="Write longer text…"
              hint="Supports multi-line content for forms and metadata."
            />
          </div>
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Plain (properties)</span>
          <div className="sticker-stack sticker-stack--narrow sticker-stack--props">
            <Input
              variant="plain"
              value={plainText}
              onChange={setPlainText}
              placeholder="Add summary"
            />
          </div>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Dropdown</h2>
        <p className="type-caption sticker-section__desc">
          Menu = compact chrome. Field = input-sized. Plain = properties sidebar. Searchable for long lists.
        </p>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Menu — with icons</span>
          <Dropdown
            variant="menu"
            trigger="Actions"
            options={[
              { id: "settings", label: "Settings", icon: <Settings size={16} strokeWidth={1.75} /> },
              { id: "new", label: "New document", icon: <Plus size={16} strokeWidth={1.75} /> },
              {
                id: "logout",
                label: "Sign out",
                icon: <LogOut size={16} strokeWidth={1.75} />,
                destructive: true,
              },
            ]}
          />
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Menu — text only</span>
          <Dropdown
            variant="menu"
            trigger="Options"
            options={[
              { id: "a", label: "Duplicate" },
              { id: "b", label: "Move to space" },
              { id: "c", label: "Delete", destructive: true },
            ]}
          />
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Field + searchable</span>
          <div className="sticker-stack sticker-stack--narrow">
            <Dropdown
              variant="field"
              value={fieldStatus}
              options={statusOptions}
              onChange={setFieldStatus}
            />
            <Dropdown
              variant="field"
              value={searchOwner}
              options={ownerOptions}
              searchable
              searchPlaceholder="Search people…"
              onChange={setSearchOwner}
            />
          </div>
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Plain (properties)</span>
          <div className="sticker-stack sticker-stack--narrow sticker-stack--props">
            <Dropdown
              variant="plain"
              value={fieldStatus}
              options={statusOptions}
              onChange={setFieldStatus}
            />
          </div>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Date picker</h2>
        <p className="type-caption sticker-section__desc">
          Calendar panels + field triggers that open on click and show the selected value.
        </p>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Calendar panels</span>
          <div className="sticker-row sticker-row--align-start">
            <DatePicker />
            <DateRangePicker />
          </div>
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Field triggers</span>
          <div className="sticker-stack sticker-stack--narrow">
            <DatePickerField value={dueDate} onChange={setDueDate} />
            <DateRangeField value={dateRange} onChange={setDateRange} />
          </div>
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Plain (properties) — auto-aligns to viewport</span>
          <div className="sticker-stack sticker-stack--narrow sticker-stack--props">
            <DatePickerField variant="plain" value={dueDate} onChange={setDueDate} />
            <DateRangeField variant="plain" value={dateRange} onChange={setDateRange} />
          </div>
        </div>
        <div className="sticker-subsection">
          <span className="sticker-subsection__label">Narrow right edge — picker flips left</span>
          <div className="sticker-align-demo">
            <DatePickerField variant="plain" value={dueDate} onChange={setDueDate} />
          </div>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Popover</h2>
        <p className="type-caption sticker-section__desc">
          Width adapts to content (max-width caps only). sm / md / lg set typography and padding.
        </p>
        <div className="popover-showcase">
          {(["top", "right", "bottom", "left"] as const).map((pos) => (
            <div key={pos} className="popover-showcase__cell">
              <Popover
                position={pos}
                size="sm"
                trigger={<Button size="small" variant="secondary">{pos}</Button>}
              >
                Tooltip on {pos}
              </Popover>
            </div>
          ))}
        </div>
        <div className="sticker-row sticker-row--align-start" style={{ marginTop: "var(--space-lg)" }}>
          <Popover
            size="md"
            trigger={<Button variant="secondary">Medium popover</Button>}
          >
            <strong>Insight source</strong>
            <p style={{ margin: "6px 0 0" }}>
              This paragraph uses the medium size for short explanations tied to UI elements.
            </p>
          </Popover>
          <Popover
            size="lg"
            trigger={<Button variant="secondary">Large popover</Button>}
          >
            <strong>Template properties</strong>
            <p style={{ margin: "8px 0 0" }}>
              Large popovers fit multi-sentence help, property summaries, or lightweight forms without opening a full modal.
            </p>
          </Popover>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Properties fields</h2>
        <p className="type-caption sticker-section__desc">
          Combined plain controls as used in the Properties panel sidebar.
        </p>
        <div className="sticker-props-demo">
          <dl className="props-list">
            <div className="props-list__row">
              <dt>Status</dt>
              <dd>
                <Dropdown variant="plain" value={fieldStatus} options={statusOptions} onChange={setFieldStatus} />
              </dd>
            </div>
            <div className="props-list__row">
              <dt>Owner</dt>
              <dd>
                <Dropdown
                  variant="plain"
                  value={searchOwner}
                  options={ownerOptions}
                  searchable
                  onChange={setSearchOwner}
                />
              </dd>
            </div>
            <div className="props-list__row">
              <dt>Summary</dt>
              <dd>
                <Input variant="plain" value={plainText} onChange={setPlainText} />
              </dd>
            </div>
            <div className="props-list__row">
              <dt>Due</dt>
              <dd>
                <DatePickerField variant="plain" value={dueDate} onChange={setDueDate} />
              </dd>
            </div>
            <div className="props-list__row">
              <dt>Timeline</dt>
              <dd>
                <DateRangeField variant="plain" value={dateRange} onChange={setDateRange} />
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Form controls</h2>
        <div className="sticker-stack sticker-stack--narrow">
          <Checkbox label="Email me when insights are ready" defaultChecked />
          <RadioGroup
            name="theme-demo"
            value={themeRadio}
            onChange={setThemeRadio}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <Toggle
            label="Push notifications"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Tab bar & segmented</h2>
        <TabBar
          options={[
            { value: "docs", label: "Documents" },
            { value: "lib", label: "Library", badge: 3 },
            { value: "team", label: "Team" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div style={{ marginTop: "var(--space-md)" }}>
          <SegmentedControl
            options={[
              { value: "a", label: "Insights" },
              { value: "b", label: "Ask" },
            ]}
            value={seg}
            onChange={setSeg}
          />
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Modal & dialog</h2>
        <div className="sticker-row">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
        </div>
        <Modal
          open={modalOpen}
          title="Rename space"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Save</Button>
            </>
          }
        >
          <Input placeholder="Space name" />
        </Modal>
        <Dialog
          open={dialogOpen}
          title="Delete space?"
          description="All documents and library items in this space will be permanently removed."
          confirmLabel="Delete"
          destructive
          onConfirm={() => showToast("Space deleted", "success")}
          onClose={() => setDialogOpen(false)}
        />
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Toast messages</h2>
        <div className="sticker-row">
          <Button variant="secondary" onClick={() => showToast("Document saved", "success")}>
            Success
          </Button>
          <Button variant="secondary" onClick={() => showToast("Could not sync library", "error")}>
            Error
          </Button>
          <Button variant="secondary" onClick={() => showToast("Switched to Book Draft", "info")}>
            Info
          </Button>
        </div>
        <div className="sticker-toast-preview">
          <Toast toast={{ id: "1", message: "Document saved", variant: "success" }} onDismiss={() => {}} />
          <Toast toast={{ id: "2", message: "Could not sync library", variant: "error" }} onDismiss={() => {}} />
          <Toast toast={{ id: "3", message: "Switched to Book Draft", variant: "info" }} onDismiss={() => {}} />
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Pills & status</h2>
        <div className="sticker-row">
          <NeutralPill>Status: Draft</NeutralPill>
          <StatusPill variant="success" icon={CircleCheck} />
          <StatusPill variant="warning" icon={TriangleAlert} />
          <StatusPill variant="info" icon={Info} />
          <StatusPill variant="progress" icon={Loader} />
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Drop zone</h2>
        <p className="type-caption sticker-section__desc">
          Library import area — solid border, gray hover like document list rows. No dashed outline or accent tint.
        </p>
        <div className="sticker-stack sticker-stack--narrow">
          <DropZone />
          <DropZone className="drop-zone--compact">Drop files here</DropZone>
        </div>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Insight dot</h2>
        <button type="button" className="insight-dot-preview">
          <Lightbulb size={14} strokeWidth={1.75} />
          <span>3</span>
        </button>
      </section>

      <section className="sticker-section">
        <h2 className="type-sticker-heading">Spacing scale</h2>
        <div className="spacing-samples">
          {["xs", "sm", "md", "lg", "xl", "2xl"].map((s) => (
            <div key={s} className="spacing-row">
              <span>--space-{s}</span>
              <div className="spacing-bar" style={{ width: `var(--space-${s})` }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
