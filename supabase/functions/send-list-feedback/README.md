# send-list-feedback

This function keeps the private recipient address out of the browser bundle and repository.

Configure these Supabase Edge Function secrets before deploying:

- `FEEDBACK_TO_EMAIL`: private recipient inbox
- `FEEDBACK_FROM_EMAIL`: verified sender, such as `What Looks Good? <feedback@your-domain.com>`
- `RESEND_API_KEY`: Resend server API key
- `APP_ORIGIN`: deployed app origin

Deploy with Supabase CLI:

```sh
supabase functions deploy send-list-feedback
```

The browser sends only the feedback type, list name, message, and page URL. It never receives the recipient address or provider API key.
