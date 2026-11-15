# Supabase Setup

Apply every SQL file in `migrations` in filename order, then run:

```bash
npm run seed:catalog
```

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Authentication settings needed for production:

- Enable anonymous sign-ins for guest play.
- Enable email/password sign-ins.
- Enable email OTP or magic links.
- Configure Google OAuth.
- Enable manual identity linking for Google account attachment.

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
- Guest email attachment preserves the guest session while the email is verified. The verified user can then set a password in Account access. Google attachment requires manual identity linking to remain enabled.

`tests/audit-gameplay.test.sql` contains non-security regression fixtures for an already migrated and seeded local database. It rolls back its fixtures. It has not been executed as part of the source-only database review. It covers complete inventory, exact large payouts, used-tool sellback, rarity weights, modifier renewal, and idempotent spoilage. Do not run it on a hosted or shared project.

Manual browser acceptance checks:

1. Attach an email or Google identity to a guest with inventory. The user ID and inventory must remain unchanged. Verify email before setting a password. An existing-account conflict must leave the guest session intact.
2. Return after token expiry. The response must persist refreshed session cookies and keep the save available.
3. Hold more than 40 mixed-state meats. Every unsold meat and the total count must be available, including older raw meat.
4. Apply a seasoning, sell the remaining tool, and sell the meat. Sellback must succeed, and the stored meat bonus must remain intact.
5. Let a sale modifier expire and renew it. It must stop appearing active at expiry and become claimable again.
6. Force a state-service failure. Show Save unavailable with Retry, not zero balance or empty inventory presented as success.
7. Check initial signed-out and setup pages with slow hydration. Component styles must be included in the first response through the shared registry cache.
