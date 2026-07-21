# Decision service follow-ups

- Add an administrator-only moderation page for `decision_reviews` and `decision_review_photos`.
- Expose approved private-bucket photos with short-lived signed URLs from a server-side function.
- Move location-distance and event-hours verification into a trusted RPC or Edge Function before production. Browser geolocation is only an MVP eligibility check.
- Add server-side rate limiting. Database uniqueness constraints provide only basic duplicate resistance.
- Configure exact Bite of Seattle operating dates, hours, center coordinates, and permitted radius in environment-backed server settings.
- Replace fallback lists with curated rows in `lists` and `list_vendors` after the migration is applied.
