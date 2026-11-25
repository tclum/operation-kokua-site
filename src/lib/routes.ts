// The five pages, in navigation order: the one list the header, the page
// tests and smoke read.

export const ROUTES = [
  { path: "/", label: "Home", title: "Operation Kokua | Surgical equipment and teaching for hospitals in Southeast Asia" },
  { path: "/work", label: "Work", title: "Work | Operation Kokua" },
  { path: "/timeline", label: "Timeline", title: "Timeline | Operation Kokua" },
  { path: "/about", label: "About", title: "About | Operation Kokua" },
  { path: "/give", label: "Give", title: "Give | Operation Kokua" },
] as const;

export type RoutePath = (typeof ROUTES)[number]["path"];

export function pageTitle(path: RoutePath): string {
  return ROUTES.find((r) => r.path === path)!.title;
}

/** The IRS determination letter, copied from the mirror by `pnpm images` (job irs-letter). */
export const IRS_LETTER_PATH = "/docs/irs-approval-letter.pdf";
