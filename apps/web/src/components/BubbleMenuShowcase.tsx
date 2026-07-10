import { BubbleMenu, type BubbleActiveMark, type BubbleMenuPlacement } from "./BubbleMenu";
import "./BubbleMenu.css";
import "./LinkPopover.css";

type ShowcaseItem = {
  label: string;
  placement: BubbleMenuPlacement;
  activeMarks?: BubbleActiveMark[];
  below?: boolean;
  linkOpen?: boolean;
};

export function BubbleMenuShowcase() {
  const items: ShowcaseItem[] = [
    { label: "Default — above selection", placement: "above" },
    { label: "Below selection (near top of viewport)", placement: "below", below: true },
    { label: "Bold active", placement: "above", activeMarks: ["bold"] },
    { label: "Italic active", placement: "above", activeMarks: ["italic"] },
    { label: "Bullet list active", placement: "above", activeMarks: ["bulletList"] },
    { label: "Numbered list active", placement: "above", activeMarks: ["orderedList"] },
    { label: "Link popover open", placement: "above", activeMarks: ["link"], linkOpen: true },
    { label: "Quote active", placement: "above", activeMarks: ["quote"] },
    { label: "Heading active", placement: "above", activeMarks: ["heading"] },
  ];

  return (
    <div className="bubble-showcase">
      {items.map((item) => (
        <div key={item.label} className="bubble-showcase__item">
          <span className="bubble-showcase__label">{item.label}</span>
          <div
            className={`bubble-showcase__demo ${item.below ? "bubble-showcase__demo--below" : ""}`}
          >
            <span className="bubble-showcase__anchor">
              {!item.below && (
                <BubbleMenu
                  placement={item.placement}
                  activeMarks={item.activeMarks}
                  linkOpen={item.linkOpen}
                  className="bubble-menu--static"
                />
              )}
              <span className="bubble-showcase__selection">selected text</span>
              {item.below && (
                <BubbleMenu
                  placement={item.placement}
                  activeMarks={item.activeMarks}
                  className="bubble-menu--static"
                />
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
