# Bite of Seattle Picks MVP

Mobile-first discovery, list fetching, swipe, tournament, and sharing prototype.

## Run

```bash
npm install
npm run dev
```

Vendor data is loaded from the Supabase `public.vendors` table. Apply `supabase/vendors.sql` once to create the table and read policy; vendor records must be managed separately in Supabase.

Before production deployment, complete [SECURITY_DEPLOYMENT.md](SECURITY_DEPLOYMENT.md),
including Edge Function secrets, database and Storage policies, response headers,
and monitoring alerts.
