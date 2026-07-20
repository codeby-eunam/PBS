# Security deployment checklist

## Required Edge Function secrets

Register and verify these values before deploying `report-content`:

```powershell
supabase secrets set IP_HASH_SALT="<at-least-32-random-bytes>"
supabase secrets set TRUSTED_CLIENT_IP_HEADER="cf-connecting-ip"
supabase secrets list
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are normally
provided to hosted Supabase Edge Functions. Confirm they exist in the deployed
function environment. Never place the service-role key in Vite variables or the
browser bundle.

`TRUSTED_CLIENT_IP_HEADER` is safe only when the gateway removes any incoming
header with that name and writes its own verified client address. Confirm this
with the gateway configuration and a staging request that supplies a forged
header. If that property cannot be guaranteed, do not use IP-based enforcement;
retain the authenticated-user limit as the security boundary.

## Database and Storage deployment

Apply these SQL files in order:

1. `supabase/reviews-policies.sql`
2. `supabase/review-photos-policies.sql`
3. `supabase/review-integrity.sql`
4. `supabase/moderation.sql`
5. `supabase/storage-policies.sql`
6. `supabase/vendor-images.sql`

Then run `supabase/security-verification.sql`. Deployment is incomplete if any
row returns `false` or is missing.

## Response headers

`vercel.json` configures CSP, HSTS, MIME sniffing prevention, clickjacking
protection, referrer policy, and permissions policy. After deployment, verify:

```powershell
curl.exe -I https://your-production-host.example/
```

The checked-in HSTS policy deliberately omits `includeSubDomains` and `preload`.
Add them only after every production subdomain supports HTTPS and the preload
requirements have been reviewed.

## Logging, monitoring, and alerts

The reporting function emits one-line JSON security events containing a request
ID, timestamp, HTTP status, outcome, pseudonymous user hash, and target type. It
does not log report reasons, access tokens, raw user IDs, IP addresses, or keys.

Configure the Supabase log drain or monitoring platform to alert on:

- any `content_report_configuration_error`;
- 5 or more `content_report_error` events in 5 minutes;
- 20 or more `content_report_auth_failure` events in 5 minutes;
- 10 or more `rate_limited` outcomes for one `user_hash` in 15 minutes;
- any sustained increase in `trusted_ip_missing` outcomes after a gateway change.

Also route Supabase Auth audit logs into the monitoring platform. Alert on failed
sign-in bursts, signup/sign-in HTTP 429 responses, refresh-token reuse or invalid
refresh-token spikes, and administrative authentication changes. Browser logs are
not an authoritative source for authentication monitoring.

Retain security logs according to the organization's privacy and incident-response
policy, and test alert delivery before launch.
