Rev 2026-11-24b

# operation-kokua-site: standing rules for agents

These rules apply in every session and every slice. A prompt may add to them, never relax them. The cross-project rules in `~/Desktop/Developer/CLAUDE.md` also apply.

## Copy and facts
- Copy comes from `src/content/` only, and gets there from three sources only: the old site (word for word; `test/fixtures/weebly-outline.md` is the authority), what David tells Tim (new copy, given to the agent in a prompt), and public records (IRS listings). Never invent numbers, names, dates, places, captions or marketing copy, and never state a claim more strongly than its source.
- Every fact carries a `basis`: `old-site`, `public-record` or `david-unconfirmed`. Anything not `old-site` needs a `label`, appears in `src/content/unconfirmed.ts` (generated) and is named under Open questions in `docs/project-state.md` in the same commit. Missing facts go to Open questions, never onto the page.
- Alt text describes what is visible, names a person only where the old site's text names them for that photo, and never guesses who someone is.

## Source and images
- `source/` holds the mirror of operationkokua.weebly.com. It is gitignored and read-only: never modify, move, rename or delete anything in it, and never stage it.
- Images and the IRS letter reach `public/` only through `pnpm images`. Never hand-copy a file into `public/`.
- The photos in `src/lib/excluded.ts` stay excluded until Tim says otherwise.

## Indexing
- The site stays noindex (`SITE_INDEXABLE` unset) until the domain slice. The launch gate refuses `true` while `src/content/unconfirmed.ts` lists anything.

## Git
- Stage by explicit path. Never `git add -A`, `git add .`, or `git add :/`.
- Never push, force push, or create a GitHub repo or Vercel project. Commit only after Tim's explicit greenlight at the gate; a commit message in a prompt is not a greenlight.
- If a hook refuses a command, stop and report. A refusal is final.
- This file quotes commands the git hook blocks; if an agent cannot write it, changes are handed to Tim as full replacement text.

## Gate and smoke
- The full gate in `README.md` runs before every commit. Report every run in order, with full output; no hidden re-runs.
- Local runs use port 3020 (3000 belongs to hawaiitechweek/website).
- `pnpm smoke https://kokua.forpono.com` after every push to main, once the deployment shows Ready; a run whose stamp is dirty or differs from local HEAD does not count.

## docs/project-state.md
- Exactly these sections, in this order: Destination, Shipped, Do, Deploy, Do not touch, Open questions, Not yet specified, Accepted gaps, Out of scope.
- Never remove a section, an Accepted-gaps line, or an Out-of-scope line.

## Docs ride with the change
- `README.md`, `docs/images.md` (written by `pnpm images`) and `docs/project-state.md` are updated in the same commit as the change they describe. A change with no doc impact says so in the gate report.
