import { SlashMenu } from "./SlashMenu";
import "./SlashMenu.css";

export function SlashMenuShowcase() {
  const states = [
    { label: "Default — menu below /", placement: "below" as const, query: "", activeIndex: 0 },
    { label: "Filtered — /tab", placement: "below" as const, query: "tab", activeIndex: 0 },
    { label: "Active item — Section divider", placement: "below" as const, query: "", activeIndex: 1 },
    { label: "Above / (near bottom of viewport)", placement: "above" as const, query: "ima", activeIndex: 0 },
    { label: "No results — space keeps text", placement: "below" as const, query: "xyz", activeIndex: 0 },
  ];

  return (
    <div className="slash-showcase">
      {states.map((state) => (
        <div key={state.label} className="slash-showcase__item">
          <span className="slash-showcase__label">{state.label}</span>
          <div className="slash-showcase__demo">
            <span className="slash-showcase__anchor">
              {state.placement === "above" && (
                <SlashMenu
                  className={`slash-showcase__menu slash-showcase__menu--above slash-menu--static`}
                  query={state.query}
                  activeIndex={state.activeIndex}
                  placement={state.placement}
                />
              )}
              <span>
                Start writing here <span className="slash-showcase__cursor">/{state.query}</span>
              </span>
              {state.placement === "below" && (
                <SlashMenu
                  className={`slash-showcase__menu slash-showcase__menu--below slash-menu--static`}
                  query={state.query}
                  activeIndex={state.activeIndex}
                  placement={state.placement}
                />
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
