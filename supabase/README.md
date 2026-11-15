# Supabase backend

The hosted project is [Meat Tycoon](https://supabase.com/dashboard/project/niogmfmmyjfcymptjxjs), reference `niogmfmmyjfcymptjxjs`, in `ap-southeast-1` under The Gaming Company. `config.toml` identifies this project as `production`.

Migrations `0001` through `0012` and `seed.sql` are deployed. The hosted database contains 16 game tables, 17 gameplay RPC entry points, 237 meats, 194 equipment items, 120 seasonings, 30 weight profiles, and the Opening Weekend sale modifier. All game tables have RLS enabled. Gameplay entry points permit authenticated sessions, including authenticated guest sessions, while internal helpers have no API execution grants.

The Supabase backend consists of the database, SQL RPC functions, policies, catalog data, and Auth configuration. Next.js server actions, middleware, and callback routes run in the Next.js application. This repository has no Edge Functions to deploy.

## Deploy database updates

Use Supabase CLI v3. Sign in and link the project if this checkout is not already linked:

```bash
supabase login
supabase link niogmfmmyjfcymptjxjs
```

Generate the catalog SQL from the source Markdown files, then review the deployment plan:

```bash
npm run seed:sql
supabase db push --remote=niogmfmmyjfcymptjxjs --include-seed --skip-vault --dry-run
```

Apply the reviewed migrations and seed file:

```bash
supabase db push --remote=niogmfmmyjfcymptjxjs --include-seed --skip-vault --yes
```

`seed:sql` runs without the Supabase JavaScript SDK or account credentials. It writes transactional upserts to `supabase/seed.sql`. The export uses the repeatable cooking seed `meat-tycoon-catalog-v1` unless `COOKING_TIMING_SEED` is set. Commit the generated SQL with catalog changes. The existing `npm run seed:catalog` remains available for direct SDK seeding when application dependencies and service credentials are installed.

To apply the declared guest-sign-in settings and keep OAuth identity linking disabled, review and push the configuration:

```bash
supabase config diff --remote=niogmfmmyjfcymptjxjs
supabase config push --remote=niogmfmmyjfcymptjxjs --yes
```

The config intentionally declares only the settings this application needs. Undeclared hosted settings retain their current values.

## Application connection

Local connection values are stored in the ignored `.env.local` file with owner-only permissions. API keys and the database password are not committed.

Application environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

- `SUPABASE_SERVICE_ROLE_KEY` is required only for direct SDK seeding.
- `SUPABASE_DB_PASSWORD` is available locally for CLI database access. The CLI can also use a temporary login role through the authenticated account.
- `COOKING_TIMING_SEED` keeps direct SDK seeding aligned with the generated SQL export.

`NEXT_PUBLIC_SITE_URL` currently uses `http://localhost:3000`. Set it and the hosted Auth redirect allowlist to the application's public URL when deploying the Next.js application.

## Authentication

Guest sign-ins, email sign-in, sign-ups, and email verification are enabled. Email confirmation remains required. Manual OAuth identity linking is disabled; guests attach an email through the dashboard's verification form.

OAuth sign-in and account-attachment buttons and server actions have been removed. No external provider credentials are required.

## Verification

Hosted read-only queries confirmed the catalog counts, RLS flags, and execution grants. `supabase migration list --remote=niogmfmmyjfcymptjxjs` reports matching local and remote versions `0001` through `0012`. No hosted regression fixtures or browser/system QA were run.

The focused SQL-export tests pass. CodeScene reports no findings for the changed seed script and its new tests. The dashboard and account-action module retain pre-existing findings; the account-access component has no findings. CodeScene does not support the SQL, TOML, environment-template, or package JSON files; Codacy is unavailable. Build, lint, and type checks were not run under the supplied agent instructions.

## Runtime contracts

Runtime invariants:

- Gameplay writes must go through the RPC functions in the migration.
- Player-owned tables use RLS and should not be written directly from the browser.
- Catalog tables are seeded from the Markdown source documents.
- Cooking, shop refresh, and spoilage use absolute timestamps.
- Raw meat does not spoil.
- Cooked meat spoils after three real-time days.
- Seasonings have durability but no expiration timestamp.

Audit contract repair (`0012_audit_gameplay_contracts.sql`):

- Apply the complete new migration before running the updated application. It widens player currency storage and adds a versioned `get_game_state()` RPC. Historical migrations are preserved.
- Player currency is transported as decimal text and formatted without floating-point conversion. Native database numeric capacity remains finite. Seasoning calculations beyond that capacity fail atomically instead of consuming tools for an unsupported reward.
- Gameplay entry points are executable by authenticated sessions; internal helpers are denied to API roles and PUBLIC. Review actual grants after applying the migration. No caller may supply a different player's ID to a public gameplay entry point.
- Sold seasoning tools retain their application history and are excluded from usable inventory.
- Reseed the catalog after the source-data correction. Small Deep Frying Pan is the $15, 0.25x Fryers item; Small Frying Pan is the $10, 0.20x Cooktops item. They have distinct IDs.
- Guest email attachment preserves the guest session while the email is verified. The verified user can then set a password in Account access.

`tests/audit-gameplay.test.sql` contains non-security regression fixtures for an already migrated and seeded local database. It rolls back its fixtures. It has not been executed as part of the source-only database review. It covers complete inventory, exact large payouts, used-tool sellback, rarity weights, modifier renewal, and idempotent spoilage. Do not run it on a hosted or shared project.

Manual browser acceptance checks:

1. Attach an email to a guest with inventory. The user ID and inventory must remain unchanged. Verify email before setting a password. An existing-account conflict must leave the guest session intact.
2. Return after token expiry. The response must persist refreshed session cookies and keep the save available.
3. Hold more than 40 mixed-state meats. Every unsold meat and the total count must be available, including older raw meat.
4. Apply a seasoning, sell the remaining tool, and sell the meat. Sellback must succeed, and the stored meat bonus must remain intact.
5. Let a sale modifier expire and renew it. It must stop appearing active at expiry and become claimable again.
6. Force a state-service failure. Show Save unavailable with Retry, not zero balance or empty inventory presented as success.
7. Check initial signed-out and setup pages with slow hydration. Component styles must be included in the first response through the shared registry cache.
