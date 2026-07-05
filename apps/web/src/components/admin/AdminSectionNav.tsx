"use client";

import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const SECTIONS = [
  { value: "admin-stats", label: "Stats" },
  { value: "admin-jobs", label: "Jobs" },
  { value: "admin-qa", label: "QA" },
  { value: "admin-pages", label: "Pages" },
] as const;

type SectionId = (typeof SECTIONS)[number]["value"];

export function AdminSectionNav() {
  const [active, setActive] = useState<SectionId>("admin-stats");

  useEffect(() => {
    const ids = SECTIONS.map((s) => s.value);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActive(visible[0].target.id as SectionId);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  function scrollTo(id: SectionId) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }

  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-surface-0/95 backdrop-blur-md border-b border-stroke-subtle mb-6">
      <SegmentedControl
        options={[...SECTIONS]}
        value={active}
        onChange={scrollTo}
        className="w-full sm:w-auto flex flex-wrap"
      />
    </div>
  );
}
