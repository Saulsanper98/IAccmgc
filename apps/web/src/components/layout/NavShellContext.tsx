"use client";

import { createContext, useContext } from "react";

interface NavShellContextValue {
  openMobileNav: () => void;
  openInstructions: () => void;
}

export const NavShellContext = createContext<NavShellContextValue>({
  openMobileNav: () => {},
  openInstructions: () => {},
});

export function useNavShell() {
  return useContext(NavShellContext);
}
