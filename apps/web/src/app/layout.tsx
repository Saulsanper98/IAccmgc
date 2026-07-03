import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { CodeHighlightTheme } from "@/components/ui/CodeHighlightTheme";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "WikiBridge",
    template: "%s · WikiBridge",
  },
  description: "Conocimiento vivo desde tu Wiki.js — CCMGC Sistemas",
  icons: { icon: "/favicon.svg" },
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("wikibridge-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="es" className={jetbrainsMono.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <CodeHighlightTheme />
          <ToastProvider>
            {session ? <AppShell session={session}>{children}</AppShell> : children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
