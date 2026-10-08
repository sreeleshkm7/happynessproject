# Supabase migration test checklist

Run the database-backed checks after applying
`supabase/migrations/202610080001_initial_schema.sql` followed by
`supabase/migrations/202610080002_host_dashboard_access.sql`, seeding data, and
configuring Auth and Storage as described in [supabase/README.md](./supabase/README.md).
Use separate browser profiles for distinct users and roles.

## Functional checks

- [ ] Sign up with email, username, full name, and mobile; confirm the profile
      row is created from Auth metadata.
- [ ] Log in with a valid email/password, log out, and verify the session and
      profile UI update correctly.
- [ ] Open a protected page while logged out; verify it redirects to login and
      returns to the requested page after login.
- [ ] Add trips to wishlist and cart, then sign in as the same user in a
      separate browser; verify both persist. Verify another user cannot see
      those rows.
- [ ] Create a booking and verify the returned server total, booking reference,
      payment method/last four digits only, and reduced trip seat count.
- [ ] With one seat left, attempt to book concurrently from two tabs/users;
      verify only one booking succeeds and the other receives the unavailable
      seats error.
- [ ] Cancel an eligible booking and verify its status changes to `Cancelled`
      and its adult/child seats are restored exactly once.
- [ ] Submit a host trip as `pending`; verify a host cannot approve it, alter
      its remaining seats, or edit it after approval. Approve/reject it as an
      admin and confirm its public visibility follows its status.
- [ ] Upload an allowed image smaller than 5 MB; verify an oversized file and
      a disallowed MIME type are rejected. Verify a host cannot modify or
      delete another user's Storage object.
- [ ] While logged out and as a different authenticated user, try to select a
      booking by another user's ID/reference; verify no booking data is
      returned. Verify hosts can only read bookings/travellers for their own
      trips.

## RLS and RPC review

The reviewed policies enable RLS on all application tables. Public trip and
child-row reads are limited to approved trips, with host/admin access for
management; profiles are self/admin readable and self-editable only through
the granted profile columns; wishlist/cart rows are owner-only; booking writes
are revoked from client roles and go through the authenticated booking RPCs.
Review insertion requires a confirmed booking. Public form tables permit
inserts but do not expose public reads. Storage policies restrict writes to an
authenticated user's folder, and the bucket applies the 5 MB limit and image
MIME allow-list.

No live project RLS/RPC test has been completed in this repository session.
The policies and functions still require the role-separated checks above in
the target Supabase project. In particular:

- The protections against hosts editing approved trips or child rows and
  directly changing seats depend on applying migration 002 after migration
  001.
- The honeypot and 30-second rate limit on public forms are client-side only;
  they are not reliable server-side abuse controls.
- Storage validates bucket MIME metadata and filename extension, not the
  underlying file signature; MIME spoofing remains possible.
- Booking payments are a demo flow. Cancellation restores seats but does not
  issue refunds; a real payment gateway and verified webhook are still needed.
- Confirm that Storage object policies and `create_booking`/`cancel_booking`
  behave as intended after applying the SQL in the target project, especially
  concurrent last-seat attempts and host/admin access.

## Static validation

From the repository root:

```sh
python3 tools/scan_supabase_migration.py
python3 tools/scan_site.py
node --check js/api.js
node --check js/main.js
git diff --check
```
