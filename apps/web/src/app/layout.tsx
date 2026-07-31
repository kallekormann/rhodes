import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ClientErrorLogBootstrap } from "@/components/ClientErrorLogBootstrap";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init-script";
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ClientErrorLogBootstrap />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
