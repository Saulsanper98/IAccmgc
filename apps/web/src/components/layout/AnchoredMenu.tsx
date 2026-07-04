"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface AnchoredMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: "left" | "stretch";
  minWidth?: number;
  className?: string;
  ariaLabel?: string;
}

export function AnchoredMenu({
  open,
  onClose,
  anchorRef,
  children,
  align = "left",
  minWidth = 176,
  className = "",
  ariaLabel = "Menú",
}: AnchoredMenuProps) {
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open || !anchorRef.current) return;

    function update() {
      const rect = anchorRef.current!.getBoundingClientRect();
      setStyle({
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 4,
        minWidth: align === "stretch" ? rect.width : minWidth,
        width: align === "stretch" ? rect.width : undefined,
        zIndex: 100,
      });
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, align, minWidth]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] cursor-default bg-transparent"
        aria-label="Cerrar menú"
        onClick={onClose}
      />
      <div
        className={`surface-card-elevated p-1 shadow-elevated animate-toast-in ${className}`.trim()}
        style={style}
        role="menu"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
