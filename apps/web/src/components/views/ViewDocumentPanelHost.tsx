"use client";

import dynamic from "next/dynamic";
import type { ViewDocumentPanelProps } from "./view-document-panel-types";

/**
 * Lazy host for the in-view document sidebar.
 *
 * Views must import this (or dynamic-import ViewDocumentPanel themselves) —
 * never statically import `./ViewDocumentPanel`, which pulls PropertiesTab /
 * TipTap CSS into the board CSS chunk and can break engine layouts.
 */
const ViewDocumentPanelImpl = dynamic(
  () =>
    import("./ViewDocumentPanel").then((m) => ({
      default: m.ViewDocumentPanel,
    })),
  { ssr: false },
);

export function ViewDocumentPanelHost(props: ViewDocumentPanelProps) {
  if (props.state.mode === "closed") return null;
  return <ViewDocumentPanelImpl {...props} />;
}
