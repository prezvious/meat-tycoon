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
