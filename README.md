# Operation Kokua

Website for Operation Kokua, a Honolulu 501(c)(3) led by David G. Mathews, MD, that brings surgical teaching and donated surgical equipment to hospitals in Southeast Asia. It replaces operationkokua.weebly.com. Five public pages: `/` (home), `/work` (teaching and donations galleries), `/timeline` (the 12 trips, 2010 to 2015), `/about` (mission, people, legal line, press) and `/give`, plus a signed-in, read-only view of the donation record under `/admin` (see Admin). Next.js 15 (App Router, server-rendered by `next start`; the five public pages prerender at build because nothing on them is per-request; `/admin` is rendered per request), TypeScript strict, Tailwind 4, pnpm.

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
Fonts are self-hosted: Source Serif 4 and Inter (400 and 600; latin, latin-ext and vietnamese) ship from the pinned `@fontsource` packages through `src/app/fonts.css`, so neither build nor page requests Google Fonts; `src/app/fonts.test.ts` fails on any `next/font/google` import under `src` and holds `fonts.css` to the packages.

## The gate

Every commit needs all of these green, in order:

```
pnpm install --frozen-lockfile
pnpm images
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:bundle            # after the build: no secret in what the browser can download
pnpm check:bundle --selftest
pnpm smoke --selftest
pnpm record:check --selftest
pnpm record:template   # regenerates the committed workbooks; byte-identical when nothing changed
pnpm record:synthetic
pnpm record:check record/synthetic-v2.xlsx
pnpm start -p 3020   # then, in another shell:
pnpm smoke http://localhost:3020
```

Tests (`pnpm test`) cover: old-site copy word for word against the outline (with a one-changed-word case that goes red); excluded photos absent from `src/content/` and `public/images/` (red on a fixture naming `2690840`); no EXIF, XMP or IPTC in any public image (red on a JPEG written with EXIF); `public/images/` holding exactly the files the jobs build, each at the width its name says; the trip count and year span matching the "12 trips / 2010 to 2015" copy; the launch gate; the indexing switch's truth table; WCAG AA contrast for every colour pair in use, read from `globals.css` (clay on ink and teal on ink expected to fail); one h1 per route, the header's five links resolving to page files, the current page marked, titles, alt text; the timeline's 12 anchored trip sections; nothing under `source/` tracked, no machine or `prompts/` path in `scripts/` or `src/`; and the record (below): both migrations pinned by sha256, the workbook definition against the migration's tables, columns and check constraints, the seeded trip slugs equal to `src/content/trips.ts`, the committed template's sheets and headers (version 2), both synthetic workbooks' determinism, SAMPLE naming and clean check, the two version 2 columns filled in one and blank in the other, the blanks workbook's blank columns, the rehearsal workbook's determinism, Read me warning and rows, the row builder's counts and import-row references and its omitting blank cells rather than sending null, the checker's selftest (including the kind rules), the resolver's rules one case each against a snapshot read from the seed migration, `--kind real` without a terminal exiting 1 before any client is constructed, a rehearsal workbook refused for either kind, and the secret key read only in `scripts/record/db.ts` and `src/lib/admin/env.ts` with nothing in `src/app` or `src/components` importing `src/record`; and the record view (below): the guard's cases with both clients mocked, every admin page, route and action calling `requireAdmin()` before its first data read (with must-fail fixtures), the module rules around the secret-key client, the middleware's matcher and its 503 when unconfigured, the sign-in result being the same for any address, the confirm route making no Auth call on a GET with a `token_hash`, verifying once on a good POST and refusing a disallowed type or a cross-origin post, no long dash in any rendered admin page, `record:admin add` and `remove` without a terminal exiting 1 before any client is constructed, and the admin views rendered over SAMPLE fixtures (the SAMPLE band, one figure per valuation basis, the empty state).

## Images

`pnpm images` (`scripts/images.ts`, jobs in `scripts/image-jobs.ts`) builds every file in `public/images/` from `source/weebly/uploads/`: one job per photo named in `src/content/`, EXIF rotation applied, all metadata stripped, at 640 and 1100 pixels wide and never wider than the source (`photo-<id>-<width>.jpg`; a 640-wide original yields one file). It removes files no job builds, copies the IRS letter to `public/docs/irs-approval-letter.pdf` (job `irs-letter`), and writes `docs/images.md` (output, source, old-site page, sha256 from the manifest). Never copy a photo into `public/` by hand.

To add a photo: add it to `src/content/` (file as the outline names it, its width and height, alt text describing only what is visible, a caption only where the old page paired one) and run `pnpm images`. The photos in `src/lib/excluded.ts` stay out until Tim says otherwise.

Photos are plain `<img>` with `srcset` (see `src/components/Photo.tsx`), laid out no wider than their real size. The old photos top out near 1100 pixels, so none runs full-bleed and the home hero is typographic.

## Indexing and the launch gate

One switch: `SITE_INDEXABLE`, read by `isIndexable()` in `src/lib/indexing.ts`. Only the exact value `true` makes the site indexable. Otherwise every route sends `X-Robots-Tag: noindex, nofollow` (`next.config.ts`) and carries `<meta name="robots" content="noindex, nofollow">` (`src/lib/metadata.ts`). It is read at build time. `robots.txt` allows crawling in both states so crawlers see the noindex.

Launch gate: `next.config.ts` calls `assertLaunchReady()` (`src/lib/launch-gate.ts`). With `SITE_INDEXABLE=true` and any item in `src/content/unconfirmed.ts`, the build fails with a message naming every item. Confirming an item means changing its basis (and removing its Open-questions line) in the same commit.

The build stamp (`<meta name="build-stamp">`) is `VERCEL_GIT_COMMIT_SHA`, else the local short SHA (with `-dirty` for uncommitted changes), else `nogit`.

## Smoke

`pnpm smoke <baseUrl>` (smoke v0.2.0) prints its version, then the deployed and local SHAs, then seventeen numbered assertions, and exits 1 on any failure; no skips, no retries. 1 to 5: each route returns 200 within 20 s with exactly one `<h1>`. 6: the stamp's SHA equals local HEAD and is not dirty (a `nogit` stamp, before the first commit, fails). 7: noindex in the header and the meta on every route, unless `SMOKE_EXPECT_INDEXABLE=true`. 8: every image URL on every route returns 200 with an `image/` type. 9: `/docs/irs-approval-letter.pdf` returns 200 as `application/pdf`. 10: `/timeline` holds one trip section per trip (12). 11: an unknown path returns 404. 12: `/robots.txt` returns 200 and allows `/`. 13 to 15: `/admin`, `/admin/handovers` and `/admin/items/<uuid>`, requested without a session, each answer a redirect to `/admin/sign-in` whose body holds none of `SAMPLE`, `Original cost` or the seeded recipient names. 16: `/admin/sign-in` returns 200 with noindex in header and meta and `Cache-Control: no-store`. 17: posting an address that is not on the list (`smoke-not-on-the-list@example.com`, through the form's server action) ends on a page holding `If that address is on the list, a sign-in link is on its way.` Checks 13 to 17 need the three Supabase variables set where the site runs; without them `/admin` answers 503 and they fail. `pnpm smoke --selftest` drives the same assertion functions against fixtures, every must-fail red and every must-pass green, and prints `RESULT: pass`. Against staging, after every push once the deployment shows Ready: `pnpm smoke https://kokua.forpono.com`.

## Record

The donation record is the structured account of what Operation Kokua gave: sources, recipients, trips, items with their valuations, shipments, handovers and followups. It lives in the Supabase project `operation-kokua` (schema in `supabase/migrations/`, applied through the Supabase connector by Tim's reviewer, never by an agent or the CLI). The public pages do not read it; the signed-in view under `/admin` reads it (see Admin).

It is filled from an intake workbook, version 2. `src/record/definition.ts` describes the workbook once (sheets, columns in order, required columns, types, allowed values, the table and column each maps to, and `WORKBOOK_VERSION`, which names every workbook file); the template, the checker, the resolver, the importer and the generators all read it. Version 2 added `reference` on Shipments (a waybill, tracking or airline tag number, to `shipments.reference`) and `valued_on` on Items (copied onto each valuation the item yields as `valuations.valued_on`); both columns already existed in the schema.

- `pnpm record:template` writes `record/operation-kokua-intake-v2.xlsx`: a Read me sheet, then one sheet per list with a frozen header, required headers marked `*`, and dropdowns for the fixed-value columns.
- `pnpm record:synthetic` writes three workbooks, identical bytes every run. Two are synthetic, every name `SAMPLE` and every ref and slug `sample-`: `record/synthetic-v2.xlsx` from a fixed seed (3 sources, 6 recipients, 4 trips, 40 items, 5 shipments, 40 handovers, 8 followups; `reference` and `valued_on` filled on some rows), and `record/synthetic-blanks-v2.xlsx` (1 source, 2 recipients, 1 trip, 5 items, 1 shipment, 5 handovers, no followups) with `kind`, `condition`, both `quantity` columns, `mode`, `date_precision` and `value_per` blank on every row, so an import exercises the database defaults, and `reference` and `valued_on` blank throughout. The importer omits a blank cell from the row it sends rather than sending null. The third is the rehearsal workbook (below).
- `pnpm record:check <file> [--kind synthetic|real]` validates a workbook offline, read as its kind (default synthetic), and prints `sheet, row, column: what is wrong` for each problem, exiting 1 on any: a missing required cell, a value outside its allowed set, a non-number, an unparseable date, a duplicate ref, a ref that points at nothing, a handover quantity above its item's quantity, an item's handovers summed above its quantity, a followup that matches no handover or more than one, and the kind rules. `--selftest` runs the synthetic workbook as synthetic and the rehearsal workbook as real (must pass) and one broken fixture per problem kind (must fail for that reason).
- `pnpm record:import <file> --kind synthetic|real --label <text> [--dry-run] [--received-from <text>] [--received-on <YYYY-MM-DD>] [--note <text>]` checks the file as its kind, refuses one whose sha256 is already a batch, resolves a real workbook against the record, and prints the plan. Then it imports raw first: one `import_batches` row (carrying the three batch flags), every sheet row into `import_rows` as raw JSON exactly as read, then the structured rows, each carrying its `batch_id` and `import_row_id`. Refs (`source_ref`, `item_ref` and the rest) join sheets within the workbook and stay in the raw rows; they never become database ids. A failed insert removes only what it inserted (the batch's handovers, then the batch row, filtered on that batch id) and exits 1. It prints the batch id and counts read back from the database.
- `pnpm record:purge --kind synthetic` deletes every synthetic batch, with counts before and after. It cannot name a real batch.
- `pnpm record:status` prints batches by kind, rows per table by kind, and `totals_by_basis`.

Synthetic against real: every batch has a kind, and a workbook's kind is told apart by its content, not only by the flag. Synthetic: every `name`, `description` and `title` starts with `SAMPLE` and every `trip_slug` with `sample-`. Real: none does. Synthetic batches are test data agents may create and purge; they join only to rows of their own batch. Real batches hold Operation Kokua's records (today one, `old-site`: the 12 trips and 4 hospitals the old site names, seeded by migration). The views never mix kinds or valuation bases. The import scripts read `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from `.env.local` (see `.env.example`), in `scripts/record/db.ts` only; the site reads its three variables in `src/lib/admin/env.ts` only.

Resolving a real workbook (`src/record/resolve.ts`, pure; the importer fetches the snapshot of real trips, recipients and sources and passes it in). Each sheet row is `new`, `matched <existing id>`, or a problem:

- Trips: a `trip_slug` equal to an existing real trip's slug is matched when title, year and country agree (case and surrounding space ignored), and a problem naming each differing column when they do not. A `trip_slug` on Shipments or Handovers may name a Trips row of the workbook or an existing real trip directly, with no Trips row (so the offline check of a real workbook leaves those refs to the resolver).
- Recipients: matched when name, city and country agree and department agrees or is blank on either side. A blank city does not agree with a filled one. Two existing rows agreeing is a problem.
- Sources: matched when name and country agree the same way.
- Items, shipments, handovers, followups and valuations are always new; the file's sha256 is the guard against loading the same records twice.

A matched row is not inserted and not changed; rows that point at it carry the existing id, and its raw row still goes into `import_rows`.

Dry run: `--dry-run`, for either kind, runs the checker and (for real) the resolver against the live record, prints the plan (per sheet how many rows are new and matched, each matched row as `sheet, row: matched <what> [<id>] (<batch label>)`, each existing trip named directly, and the rows it would insert per table), writes nothing, and ends `DRY RUN: nothing was written`.

Committing a real batch: only a person typing at a terminal (Tim), never an agent. `--kind real` without `--dry-run` requires standard input to be an interactive terminal, prints the plan, and goes ahead only when the person types the batch label exactly. Without a terminal it exits 1 with `a real import needs a person at a terminal; use --dry-run to rehearse` before the file is read or any request is made. There is no flag or variable around this. Agents rehearse real imports with `--dry-run` only.

The rehearsal workbook: `record/rehearsal-real-v2.xlsx`, written by `pnpm record:synthetic`, is shaped like a real workbook for dry runs only. Its Read me sheet says in its first line that it must never be imported. It repeats the real trip `hanoi-2015` and the recipient Cho Ray Hospital (Neurosurgery) exactly as `old-site` holds them (both match), names `cambodia-2015` directly from two handovers, and marks everything new `REHEARSAL` (names, descriptions, titles) or `rehearsal-` (trip slugs). The importer refuses to commit any workbook with a `REHEARSAL` name or a `rehearsal-` slug, whatever the kind; a dry run is allowed.

## Admin

`/admin` is a signed-in, read-only view of the donation record for the two or three people who keep it. It never writes to the record.

- Variables, all server-side (never `NEXT_PUBLIC_`), read only in `src/lib/admin/env.ts`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (Auth, with the visitor's cookies; public by design) and `SUPABASE_SECRET_KEY` (reading the record after the guard passes; used only in `src/lib/admin/record.ts`). With any of them missing, every `/admin` route answers 503 `The record view is not configured` and nothing else under `/admin` renders; the public pages are unaffected.
- Sign-in (`/admin/sign-in`) is an emailed link (Supabase Auth, `signInWithOtp` with `shouldCreateUser: false`). Whatever the address, the page then says `If that address is on the list, a sign-in link is on its way.`, after the same minimum time. The link lands on `/admin/confirm`, and a sign-in link is never redeemed by a GET (mail scanners and link previews fetch links). For a `token_hash` link with type `email` or `magiclink`, the GET verifies nothing and shows a page titled `Sign in to the record` with one `Continue` button, whose form posts `token_hash` and `type` back to the same route; the POST (same origin only) runs `verifyOtp` and redirects to `/admin`. A missing, unknown or disallowed type lands on sign-in without the button. A `code` link (the default template) is exchanged on the GET, as before. A bad or expired link lands back on sign-in with `That link did not work. Request a new one.` The confirm page carries the same noindex and no-store headers and shows nothing from the record. In the views, an empty value reads `not given`. Every admin page has a sign-out control.
- `src/middleware.ts` refreshes the session, limited by its matcher to `/admin/:path*`; the public routes, `robots.txt`, images and the PDF never pass through it.
- The guard: `requireAdmin()` in `src/lib/admin/guard.ts` reads the user from the Auth server (`getUser()`), lowercases the email and looks it up in `public.app_admins` with the secret-key client. No user: redirect to sign-in. A user not on the list, or a lookup error: signed out, then redirected. Every page, route handler and server action under `src/app/admin`, other than the sign-in page and action and the confirm route, calls it before it reads anything; a layout is not the guard. `src/lib/admin/coverage.test.ts` fails on any that does not.
- The secret-key client lives only in `src/lib/admin/record.ts` (server-only, read functions only). Nothing under `src/components` imports it, and no client component imports anything from `src/lib/admin`. `pnpm check:bundle` fails the gate if `sb_secret_`, the name `SUPABASE_SECRET_KEY` or the secret's value appears in any file under `.next/static`.
- Every `/admin` response carries `X-Robots-Tag: noindex, nofollow`, a noindex robots meta and `Cache-Control: no-store`, whatever `SITE_INDEXABLE` says.
- The kind switch: every page takes `?kind=real` (the default) or `?kind=synthetic`, and shows one kind only. While synthetic is selected, a band across the top reads `SAMPLE DATA: not part of the record`. Pages: `/admin` (batches of the kind with their row counts; `totals_by_basis`, one figure per valuation basis labelled in words and never summed across bases; counts of items, handovers, recipients and countries; for real with no items, a line saying so and that the old site's trips and hospitals are recorded), `/admin/handovers` (`handover_facts`, filterable by `country`, `recipient` and `trip` in the URL, 50 rows a page) and `/admin/items/<id>` (the item, its valuations, handovers and followups, and the raw workbook row).
- Adding an admin is a person's act. `pnpm record:admin list` prints the allowlist. `pnpm record:admin add <email>` lowercases the address, inserts the `app_admins` row, and creates the Auth user for it, already confirmed, if none exists; `pnpm record:admin remove <email>` deletes the row and the Auth user. Each requires an interactive terminal and the address typed back exactly, and ends by printing the allowlist read back from the database; without a terminal each exits 1 before any request. Tim runs them; agents never do.
- `pnpm admin:preview <out-dir>` (test-only, after `pnpm build`) renders each signed-in page component over the SAMPLE fixtures in `test/admin-fixtures.ts` to HTML, for review without signing in. It reads nothing from the record.
- Supabase dashboard settings the flow needs (Authentication > URL Configuration and Emails): see Deploy in `docs/project-state.md`.

## Deploy

Live on staging at https://kokua.forpono.com (Vercel project operation-kokua, git-connected to tclum/operation-kokua-site main; push to main deploys production), noindex; see Deploy in `docs/project-state.md`. After every push: wait for the deployment to show Ready, then `pnpm smoke https://kokua.forpono.com`. Tim pushes; agents never do.
