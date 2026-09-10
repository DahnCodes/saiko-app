# Pre-feature audit — 9 September 2026

The local build and tested feature flows pass after the fixes below. This is not a claim that every production scenario is verified. The three backend migrations and three administrative functions were deployed to the linked production project on 9 September 2026. Frontend changes have not been deployed in this session.

## GitHub exposure

- Scanned all 23 reachable Git commits (218 unique blobs) for private keys, provider tokens, credential-bearing database URLs, and JWTs. Found a historical `.env` containing a Supabase **anonymous** JWT; no private credential was detected by those patterns. The database URL match in the migration script was a placeholder. History was not rewritten.
- Removed ten Supabase CLI state files and the scratch test from Git tracking, preserving local copies. These removals are staged; the other changes remain unstaged.
- Ignored environment variants, Supabase state, scratch files, test output, and private key/certificate formats. Kept the blank `.env.example` available for setup. The pre-existing `build/` directory contains source code for discoverability and is intentionally not ignored.
- Removed the browser-exposed Redis configuration path and stopped the precompute script from assigning a service key to a public Vite variable. Server credential fallback is restricted to the server runtime.
- Added `pnpm check:exposure`, a heuristic current-file scan. No scanner guarantees that a repository is secret-free; this does not cover unreachable objects, remote-only branches, forks, or GitHub settings.

## Verified fixes

- Fixed all 47 initial lint errors and two warnings without disabling the relevant code rules. The scratch directory is excluded from lint.
- Updated DNA fixtures to real AniList IDs; replaced copied JavaScript test implementations with entry points into the production tests. Scoring tests now assert relative matching behavior and the actual 34-entry vocabulary without changing recommendation weights.
- Fixed recommendation cache refresh, result limits, concurrent-work deduplication, unnecessary five-second waiting without Redis, and lock cleanup after failures. Favorite-read errors now propagate.
- Fixed shared trait-cache lookups: the cache's UUID is independent of the anime UUID, so lookups now join through AniList IDs. Browser extraction keeps its results locally and does not write shared metadata.
- Added a migration preventing arbitrary signed-in accounts from editing shared trait metadata.
- Added explicit service-role authorization to the three administrative ingestion/sync functions. Job callers must send `Authorization: Bearer <service-role key>`; public/user tokens are rejected before upstream fetches or writes.
- Added ownership-restricted public DNA publication policies and handled publication errors. Kept the DNA reveal visible after onboarding completes.
- Made replacement of the three favorites transactional, with account ownership and distinct starter-selection validation. A failed replacement preserves the old favorites.
- Isolated onboarding and DNA page state by user, corrected stale asynchronous error handling, and added a timeout and malformed-payload rejection to AniList requests.

## Verification results

| Check | Result |
| --- | --- |
| TypeScript + production Vite build | Passed; existing bundle-size/dynamic-import warnings remain |
| ESLint | Passed |
| DNA suite | 162 checks passed, including all 20 combinations |
| Anime loading/search suite | 43 tests passed |
| Core regression suite | 18 tests passed, including the 12 production scoring checks |
| Browser suite | 36 checks passed at 1440px and 390px; controlled API responses |
| Database suite | All 17 migrations applied in isolated PGlite/PostgreSQL; 12 policy/integrity checks passed |
| Deployed read-only suite | 11 checks passed: catalog, starter data, local title search, anonymous data isolation and denied account RPC |
| Dependency audit | 0 reported vulnerabilities across 198 dependencies |

Browser checks cover public routes, valid/missing detail records, search success/empty/failure/clear, protected redirects, username creation, the three-favorite limit, onboarding save and reveal, profile, public DNA, DNA image preview, and access to the recommendations page. No uncaught JavaScript errors or horizontal overflow were observed. Recommendation scoring and caching are tested separately; the browser API fixtures do not establish live personalized recommendation quality.

Database tests use real PostgreSQL semantics in PGlite with modeled Supabase auth roles and default grants. They verify ownership, anonymous restrictions, cross-user isolation, publication, cache write restrictions, and atomic favorite replacement. They do not replace a staging Supabase deployment test.

The original production verification script also confirmed Naruto, One Piece and Bleach search/image responses, then stopped on an external image-host connection timeout. Remaining title searches passed via the read-only local-search RPC. Real email confirmation, Google OAuth, live signed-in database writes, native device sharing, and scheduled ingestion have not been exercised. Administrative jobs were tested with mocked boundaries rather than run against production.

## Release dependency

Deployed on 9 September 2026 to project `ljkwhsnetasrcpsoqtab`:

- `20260909000100_restrict_trait_cache_writes.sql`
- `20260909000200_public_dna_owner_writes.sql`
- `20260909000300_atomic_favorites.sql`
- `ingest-news`, `sync-anime`, and `sync-trailers`, each including the shared admin authorization helper.

Supabase confirmed all three migrations applied and all three functions deployed. Remote read-back verified all three migration records, ownership-restricted public DNA policies, denied authenticated trait-cache writes, and favorites-RPC execution granted to authenticated users but denied to anonymous users. Each deployed function returned HTTP 401 with the handler's `Unauthorized` response when invoked using public anonymous credentials. All 11 deployed read-only health/access-isolation checks passed again after deployment.

Public auth configuration confirms email and Google authentication enabled, sign-up enabled, and email confirmation required. No `cron.job` table exists in the project; no database-scheduled callers were found. External schedulers were not inspected and must use service-role authorization for administrative functions.

Frontend deployment, full email/Google login, live signed-in writes, native device sharing, and successful administrative ingestion remain unverified. Perform these with a test account before final production sign-off. Bundle-size warnings remain unchanged.

Existing SEO/discoverability edits in `index.html`, `src/main.tsx`, `vite.config.ts`, `build/`, `src/seo/`, and public metadata files were preserved.

## Repeat the checks

Node 24+ and the installed pnpm dependencies are required:

```sh
pnpm check
pnpm audit
pnpm test:live
```

Browser and database checks load optional test tools from normal packages or explicit module paths. During this audit they were installed in `/tmp/saiko-browser-audit`, keeping project dependencies unchanged:

```sh
npm install --prefix /tmp/saiko-browser-audit playwright @electric-sql/pglite
pnpm dev --host 127.0.0.1
# In a second terminal:
PLAYWRIGHT_MODULE=/tmp/saiko-browser-audit/node_modules/playwright/index.mjs pnpm test:browser
PGLITE_MODULE=/tmp/saiko-browser-audit/node_modules/@electric-sql/pglite/dist/index.js pnpm test:database
```

Set `CHROME_PATH` for a different Chrome executable and `TEST_BASE_URL` for a different local server. The browser suite needs the public Supabase URL from `.env` to model its auth storage key. Live checks use the public URL and anonymous key and print no credentials or records.
