# Operation Kokua site: project state

## Destination
Operation Kokua's own domain live and indexable: the story, the people, every trip and donation backed by a record David can keep current, and a way to give.

## Shipped
- 2026-11-24, slice 1 (live on staging when the build stamp at https://kokua.forpono.com carries this commit or a later one): Next.js 15 scaffold replacing operationkokua.weebly.com, with five pages: home (typographic hero, origin, impact figures, recent trips), /work (Teaching and Donations galleries with a lightbox), /timeline (12 trips, 2010 to 2015, newest first, anchored by slug), /about (mission, executives, board, legal line with the IRS letter, Press), /give (needs, fund use, contact line; no payment control). Copy from `src/content/` only, every fact tagged with its basis; image pipeline (`pnpm images`, metadata stripped, 40 photos, the excluded list kept out); noindex switch and launch gate; tests; `pnpm smoke` v0.1.0 with `--selftest`. Proof: `prompts/operation-kokua-site/reports/0001` in the workspace.
- 2026-11-24: slice 1 live on staging (875492f), smoke 12/12.
- 2026-11-24, slice 2: the donation record's foundation. Migrations `20261125021239_record_foundation` (raw-first import tables, the structured record, the `handover_facts` and `totals_by_basis` views, RLS on with no policies) and `20261125021334_seed_old_site` (one real batch `old-site`: 12 trips, 4 recipients), applied through the Supabase connector and committed byte-identical. Intake workbook from one definition (`src/record/definition.ts`), offline checker with selftest (including an item's handovers summed against its quantity), two synthetic workbooks (`synthetic-v1`, and `synthetic-blanks-v1` with every defaulted optional cell blank), raw-first importer that omits blank cells so database defaults apply, purge and status scripts. Two synthetic batches ("synthetic v1", "synthetic blanks v1") loaded after a purge. No page, route or component changed.

## Do
- Gate before every commit: `pnpm install --frozen-lockfile`, `pnpm images`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm smoke --selftest`, `pnpm record:check --selftest`, `pnpm record:template`, `pnpm record:synthetic`, `pnpm record:check record/synthetic-v1.xlsx`, then a local `pnpm start -p 3020` + `pnpm smoke http://localhost:3020`.
- After every push to main: `pnpm smoke https://kokua.forpono.com` once the deployment shows Ready. A red run is a rollback conversation.
- Change copy only in `src/content/`. Old-site copy stays word for word (checked against `test/fixtures/weebly-outline.md`); new facts carry `basis: "david-unconfirmed"` and a `label`, and get an Open-questions line here in the same commit.
- A later donation record points at a trip by its `slug` in `src/content/trips.ts`; slugs never change once published.
- Record scripts: `pnpm record:template`, `record:synthetic`, `record:check <file>` (and `--selftest`), `record:import <file> --kind synthetic --label <text>`, `record:purge --kind synthetic`, `record:status`. Schema changes are new migration files applied by Tim's reviewer through the Supabase connector, then committed byte-identical; agents import synthetic batches only.

## Deploy
Live on staging: https://kokua.forpono.com (Vercel project operation-kokua, team tclum-4994s-projects, git-connected to tclum/operation-kokua-site main; push to main deploys production). Noindex (SITE_INDEXABLE unset; the launch gate refuses true while any item is unconfirmed). First deploy 875492f on 2026-11-24, smoke 12/12. After every push: wait for the deployment to show Ready, then pnpm smoke https://kokua.forpono.com.
Database: Supabase project operation-kokua, ref dwgxbgtnbycopbjnzpcz, region us-west-1. The hosted site does not read the database yet; only the local `pnpm record:*` scripts do.

## Do not touch
- `source/` (the mirror of the old site): gitignored and read-only.
- The excluded-photo list in `src/lib/excluded.ts`: stays excluded until Tim says otherwise.
- `SITE_INDEXABLE`: unset until the domain slice; the launch gate refuses `true` while any item below is unconfirmed.

## Open questions
Dated 2026-11-24; all for the 2026-12-07 meeting with David unless typed otherwise.

Unconfirmed items on the site (the same list as `src/content/unconfirmed.ts`):
- Home headline
- Home origin paragraph: about 30 years at Kaiser, and whether the employer may be named
- Impact figure: about $50 million in equipment donated, and how it was valued
- Impact figure: 3 countries, including Nepal (the old site documents Vietnam and Cambodia only)
- Home closing line
- Give page lead
- Give page contact line: the street address (1505 Ohialoke Street, Honolulu, HI 96821) appearing publicly
- Legal line: 501(c)(3) status and EIN 46-3431061 (matches the IRS letter of 2014-09-24)

Other questions:
- Consent for the 19 excluded photos (`src/lib/excluded.ts`): patients, surgery in progress, children, a business card with private contact details, a newspaper scan, and three under 600 pixels.
- The Teaching page's two captions, "Dr Santi teaching at Cho Ray Hospital, Saigon." and "Teaching Rounds at Hospital 108 in Hanoi.", are held in `src/content/held.ts` and shown nowhere; they return with their excluded photos (`8488644`, `2690840`).
- "Battery-powered drill donations to Cho Ray Hospital" sat beside a column of 16 donation photos on the old page, not one, so it is held in `src/content/held.ts` and shown nowhere: which photo or photos does it describe?
- Captions, dates and places for the uncaptioned photos (the Teaching and Donations galleries, and most trip photos).
- The same photo is published on two trips: Cambodia 2013 and Cambodia November 2014 (also on the donations page); Hanoi / Bac Ninh 2013 and Da Lat 2014; Ho Chi Minh City 2014 and the donations page. Which trip does each belong to?
- Da Lat 2013's "Thank you dinner." sat beside a photo of men sorting bags of instruments on the old page; it is shown as a note on the trip, not as that photo's caption. Which photo does it belong to?
- "Johnn" Saruwatari: is the spelling right (a welcome slide in one photo reads "Jon")? Is the board list current?
- Trips and shipments since 2015; the old timeline stops at December 2015 and lists only 9 of the 12 trip pages.
- Banners in the photos show events in 2005 (shoulder arthroscopy workshop), 2006 (donation ceremony to the HTO) and 2009 (shoulder replacement workshop), earlier than the published timeline. Were these Operation Kokua trips (the organization's IRS exemption is effective 2013-08-22)?
- A contact email or phone for the Give page.
- The Bac Ninh newspaper article on the old Press page: its host did not resolve on 2026-11-24, so the link is left out. Is there a working copy or a PDF?
- Months for Da Lat 2014 (its old page address says "november", its title only 2014) and for the 2013 trips.
- `task`: who owns operationkokua.org and operationkokua.com.
- `task`: original photo files from David; the mirror tops out near 1100 pixels wide.
- `research`: import rules for used medical devices in recipient countries.
- `grilling`, 2026-11-24: how records get entered after launch (forms, the workbook, or both) and by whom, decided after seeing David's records on 2026-12-07.
- `task`, 2026-11-24: Vercel needs the two Supabase variables before any page reads the record.

## Not yet specified
- The recipient map.
- Online giving.
- The domain and launch.

## Accepted gaps
- No full-bleed photography: source photos are too small until David supplies originals.

## Out of scope
- A payment control on /give until the organization has one.
