import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: "Rhodes",
  description: "Self-hosted team second brain",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
