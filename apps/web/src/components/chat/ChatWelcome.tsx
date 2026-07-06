"use client";

import { getTimeGreeting } from "@/lib/format";
import { CcmgcLogo } from "./CcmgcLogo";

export function ChatWelcome({ userName }: { userName?: string | null }) {
  const firstName = userName?.trim().split(/\s+/)[0];
  const greeting = getTimeGreeting();

  return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <CcmgcLogo className="h-24 sm:h-28 w-full max-w-[360px] mx-auto text-text-primary" />
      <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight text-text-primary">
        {firstName ? `${greeting}, ${firstName}` : greeting}
      </h1>
    </div>
  );
}
