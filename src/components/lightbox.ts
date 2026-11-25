// The gallery lightbox, loaded on the first click on a gallery tile
// (GalleryLightbox.tsx). A native <dialog> opened with showModal(): the
// browser traps focus and closes it on Escape. It shows the photo's largest
// file with its alt text and caption; Previous, Next and the arrow keys step
// through that gallery; on close, focus returns to the tile last shown.

type Item = { tile: HTMLAnchorElement; src: string; alt: string; caption: string };

let dialog: HTMLDialogElement | null = null;
let items: Item[] = [];
let index = 0;

function button(label: string, glyph: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", label);
  b.className =
    "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-paper text-[26px] leading-none text-paper hover:bg-paper hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-paper";
  const g = document.createElement("span");
  g.setAttribute("aria-hidden", "true");
  g.textContent = glyph;
  b.append(g);
  b.addEventListener("click", onClick);
  return b;
}

function show(i: number): void {
  if (!dialog) return;
  index = (i + items.length) % items.length;
  const item = items[index];
  const img = dialog.querySelector("img");
  const cap = dialog.querySelector("[data-caption]");
  if (!img || !cap) return;
  img.src = item.src;
  img.alt = item.alt;
  cap.textContent = item.caption;
  dialog.setAttribute("aria-label", item.alt);
  const live = dialog.querySelector("[aria-live]");
  if (live) live.textContent = `${index + 1} of ${items.length}. ${item.alt}`;
}

function build(): HTMLDialogElement {
  const d = document.createElement("dialog");
  d.className = "lightbox m-auto h-[100dvh] max-h-none w-screen max-w-none overscroll-contain bg-transparent p-0 text-paper";
  const frame = document.createElement("div");
  frame.className = "flex h-full w-full flex-col items-center justify-center gap-3 p-4 sm:p-8";

  const top = document.createElement("div");
  top.className = "flex w-full justify-end";
  top.append(button("Close", "×", () => d.close()));

  const img = document.createElement("img");
  img.className = "min-h-0 max-w-full flex-1 object-contain";
  img.decoding = "async";

  const cap = document.createElement("p");
  cap.dataset.caption = "";
  cap.className = "max-w-3xl text-center text-[16px]";

  const nav = document.createElement("div");
  nav.className = "flex gap-4";
  nav.append(button("Previous photo", "‹", () => show(index - 1)), button("Next photo", "›", () => show(index + 1)));

  const live = document.createElement("p");
  live.className = "sr-only";
  live.setAttribute("aria-live", "polite");

  frame.append(top, img, cap, nav, live);
  d.append(frame);
  d.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      show(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      show(index + 1);
    }
  });
  // A click on the backdrop (outside the photo and the buttons) closes it.
  frame.addEventListener("click", (e) => {
    if (e.target === frame) d.close();
  });
  d.addEventListener("close", () => {
    items[index]?.tile.focus();
  });
  document.body.append(d);
  return d;
}

export function openLightbox(root: HTMLElement, start: number): void {
  items = [...root.querySelectorAll<HTMLAnchorElement>("a[data-lightbox-index]")].map((tile) => ({
    tile,
    src: tile.getAttribute("href") ?? "",
    alt: tile.querySelector("img")?.alt ?? "",
    caption: tile.closest("figure")?.querySelector("figcaption")?.textContent ?? "",
  }));
  if (!dialog) dialog = build();
  show(start);
  dialog.showModal();
}
