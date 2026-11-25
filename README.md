# Operation Kokua

Website for Operation Kokua, a Honolulu 501(c)(3) led by David G. Mathews, MD, that brings surgical teaching and donated surgical equipment to hospitals in Southeast Asia. It replaces operationkokua.weebly.com. Five pages: `/` (home), `/work` (teaching and donations galleries), `/timeline` (the 12 trips, 2010 to 2015), `/about` (mission, people, legal line, press) and `/give`. Next.js 15 (App Router, server-rendered by `next start`; today every page prerenders at build because nothing is per-request), TypeScript strict, Tailwind 4, pnpm.

## Run it

```
pnpm install
pnpm images      # builds public/images/ and public/docs/ from source/ (needs source/ on this machine)
pnpm dev -p 3020 # http://localhost:3020 (3000 belongs to hawaiitechweek/website, see ~/Desktop/Developer/CLAUDE.md Rule 10)
```

## Content

All copy lives in `src/content/` and is rendered from there only, validated with zod at import:

- `site.ts`: name, mission, new copy, impact figures, needs list, fund-use lines, address, legal line.
- `people.ts`: executives and board.
- `trips.ts`: one entry per trip page of the old site, in timeline order, keyed by `slug` (the anchor `/timeline#<slug>`, and what a later donation record will point at).
- `photos.ts`: the Teaching and Donations galleries, the Press photo, and the two home photos.
- `held.ts`: old-site text held back and rendered nowhere, each line tied to the photo ids its old page paired it with (the two Teaching captions of excluded photos, and the Donations line that sat beside a column of 16 photos). A test keeps it out of every page and component.
- `unconfirmed.ts`: every item that is not old-site copy (generated from the others).

Every fact carries a `basis`: `old-site` (published by the organization on its old site; must appear word for word in `test/fixtures/weebly-outline.md`), `public-record` (IRS listings) or `david-unconfirmed` (told to Tim, not yet checked). The pages render all three the same. An item that is not old-site needs a `label`; `docs/project-state.md` lists every label under Open questions, and a test holds the two lists together.

Tokens (colours, fonts) live in `src/app/globals.css`.

## The gate

Every commit needs all of these green, in order:

```
pnpm install --frozen-lockfile
pnpm images
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm smoke --selftest
pnpm start -p 3020   # then, in another shell:
pnpm smoke http://localhost:3020
```

Tests (`pnpm test`) cover: old-site copy word for word against the outline (with a one-changed-word case that goes red); excluded photos absent from `src/content/` and `public/images/` (red on a fixture naming `2690840`); no EXIF, XMP or IPTC in any public image (red on a JPEG written with EXIF); `public/images/` holding exactly the files the jobs build, each at the width its name says; the trip count and year span matching the "12 trips / 2010 to 2015" copy; the launch gate; the indexing switch's truth table; WCAG AA contrast for every colour pair in use, read from `globals.css` (clay on ink and teal on ink expected to fail); one h1 per route, the header's five links resolving to page files, the current page marked, titles, alt text; the timeline's 12 anchored trip sections; and nothing under `source/` tracked, no machine or `prompts/` path in `scripts/` or `src/`.

## Images

`pnpm images` (`scripts/images.ts`, jobs in `scripts/image-jobs.ts`) builds every file in `public/images/` from `source/weebly/uploads/`: one job per photo named in `src/content/`, EXIF rotation applied, all metadata stripped, at 640 and 1100 pixels wide and never wider than the source (`photo-<id>-<width>.jpg`; a 640-wide original yields one file). It removes files no job builds, copies the IRS letter to `public/docs/irs-approval-letter.pdf` (job `irs-letter`), and writes `docs/images.md` (output, source, old-site page, sha256 from the manifest). Never copy a photo into `public/` by hand.

To add a photo: add it to `src/content/` (file as the outline names it, its width and height, alt text describing only what is visible, a caption only where the old page paired one) and run `pnpm images`. The photos in `src/lib/excluded.ts` stay out until Tim says otherwise.

Photos are plain `<img>` with `srcset` (see `src/components/Photo.tsx`), laid out no wider than their real size. The old photos top out near 1100 pixels, so none runs full-bleed and the home hero is typographic.

## Indexing and the launch gate

One switch: `SITE_INDEXABLE`, read by `isIndexable()` in `src/lib/indexing.ts`. Only the exact value `true` makes the site indexable. Otherwise every route sends `X-Robots-Tag: noindex, nofollow` (`next.config.ts`) and carries `<meta name="robots" content="noindex, nofollow">` (`src/lib/metadata.ts`). It is read at build time. `robots.txt` allows crawling in both states so crawlers see the noindex.

Launch gate: `next.config.ts` calls `assertLaunchReady()` (`src/lib/launch-gate.ts`). With `SITE_INDEXABLE=true` and any item in `src/content/unconfirmed.ts`, the build fails with a message naming every item. Confirming an item means changing its basis (and removing its Open-questions line) in the same commit.

The build stamp (`<meta name="build-stamp">`) is `VERCEL_GIT_COMMIT_SHA`, else the local short SHA (with `-dirty` for uncommitted changes), else `nogit`.

## Smoke

`pnpm smoke <baseUrl>` (smoke v0.1.0) prints its version, then the deployed and local SHAs, then twelve numbered assertions, and exits 1 on any failure; no skips, no retries. 1 to 5: each route returns 200 within 20 s with exactly one `<h1>`. 6: the stamp's SHA equals local HEAD and is not dirty (a `nogit` stamp, before the first commit, fails). 7: noindex in the header and the meta on every route, unless `SMOKE_EXPECT_INDEXABLE=true`. 8: every image URL on every route returns 200 with an `image/` type. 9: `/docs/irs-approval-letter.pdf` returns 200 as `application/pdf`. 10: `/timeline` holds one trip section per trip (12). 11: an unknown path returns 404. 12: `/robots.txt` returns 200 and allows `/`. `pnpm smoke --selftest` drives the same assertion functions against fixtures, every must-fail red and every must-pass green, and prints `RESULT: pass`. Against staging, after every push once the deployment shows Ready: `pnpm smoke https://kokua.forpono.com`.

## Deploy

Live on staging at https://kokua.forpono.com (Vercel project operation-kokua, git-connected to tclum/operation-kokua-site main; push to main deploys production), noindex; see Deploy in `docs/project-state.md`. After every push: wait for the deployment to show Ready, then `pnpm smoke https://kokua.forpono.com`. Tim pushes; agents never do.
