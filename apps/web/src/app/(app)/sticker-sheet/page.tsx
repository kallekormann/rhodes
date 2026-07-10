import { notFound } from "next/navigation";
import { StickerSheetView } from "@/views/StickerSheetView";

export default function StickerSheetPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_STICKER_SHEET !== "true"
  ) {
    notFound();
  }

  return <StickerSheetView />;
}
