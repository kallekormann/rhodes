import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import "./DocumentCard.css";

export type DocumentCardProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  meta?: ReactNode;
  selected?: boolean;
  placeholder?: boolean;
  trailing?: ReactNode;
  className?: string;
};

/**
 * Shared document surface used by Kanban and Mind Map.
 * Tokens only — keep visual parity with sticker sheet.
 */
export const DocumentCard = forwardRef<HTMLButtonElement, DocumentCardProps>(
  function DocumentCard(
    {
      title,
      meta,
      selected = false,
      placeholder = false,
      trailing,
      className = "",
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={[
          "document-card",
          selected ? "document-card--selected" : "",
          placeholder ? "document-card--placeholder" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        <span
          className={`document-card__title${
            placeholder ? " document-card__title--placeholder" : ""
          }`}
        >
          {title}
        </span>
        {meta ? <div className="document-card__meta">{meta}</div> : null}
        {trailing ? (
          <div className="document-card__trailing">{trailing}</div>
        ) : null}
      </button>
    );
  },
);
