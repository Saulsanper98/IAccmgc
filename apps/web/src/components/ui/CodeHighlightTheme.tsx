"use client";

import { useEffect } from "react";
import { useTheme } from "./ThemeProvider";

export function CodeHighlightTheme() {
  const { theme } = useTheme();

  useEffect(() => {
    const id = "hljs-theme";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href =
      theme === "light"
        ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css"
        : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css";
  }, [theme]);

  return null;
}
