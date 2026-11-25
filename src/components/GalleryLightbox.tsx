"use client";

import { useEffect } from "react";

// The only gallery code in the page bundle: one delegated click listener per
// gallery. The lightbox itself (./lightbox) is fetched on the first click.
// Without JavaScript, or with a modifier key, a tile is a plain link to the
// photo's largest file.
export function GalleryLightbox() {
  useEffect(() => {
    const roots = [...document.querySelectorAll<HTMLElement>("[data-gallery]")];
    const handlers = roots.map((root) => {
      const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const tile = (e.target as Element).closest<HTMLAnchorElement>("a[data-lightbox-index]");
        if (!tile) return;
        e.preventDefault();
        void import("./lightbox").then((m) => m.openLightbox(root, Number(tile.dataset.lightboxIndex)));
      };
      root.addEventListener("click", onClick);
      return () => root.removeEventListener("click", onClick);
    });
    return () => handlers.forEach((off) => off());
  }, []);
  return null;
}
