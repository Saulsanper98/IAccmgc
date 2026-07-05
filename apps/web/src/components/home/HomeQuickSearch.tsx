"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconSearch } from "@/components/ui/Icons";

export function HomeQuickSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/chat?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative max-w-xl">
      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar en la wiki…"
        className="input-field pl-9 w-full"
        aria-label="Búsqueda rápida en el chat"
      />
    </form>
  );
}
