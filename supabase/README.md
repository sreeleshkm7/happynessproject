# Supabase database setup

The database schema and row-level security policies are applied through the
Supabase Dashboard. The static frontend now uses Supabase Auth and will use the
configured project URL and anon key from `js/config.js`.

## Dashboard run order

1. In Supabase **Authentication → Users**, create the user that will own the
   seeded trips. The migration installs an Auth trigger that creates that
   user's `public.profiles` row. Use the actual account email you intend to use.
2. Open `migrations/202610080001_initial_schema.sql`, copy its full contents
   into a new SQL Editor query, and run it as the database owner.
3. Open `migrations/202610080002_host_dashboard_access.sql` and run it after the
   initial schema. It locks edits to draft/pending trips, protects server-owned
   seat counts, and allows hosts to read traveller details for their bookings.
4. In `seed.sql`, replace `sreeleshkm7@gmail.com` with the host account's
   exact email. Run the full seed file in a new SQL Editor query. It inserts the
   seven current catalog trips, Spiti itinerary, available inclusions and
   exclusions, pickup locations, host profile, gallery paths, and `HAPPY10`.
5. To let a user create and manage trips, create the user in **Authentication
   → Users** first, then assign the host role using this SQL after replacing
   the email:

   ```sql
   update public.profiles
   set role = 'host'
   where id = (
     select id from auth.users where lower(email) = lower('YOUR_HOST_EMAIL')
   );
   ```

   Do not grant this role to public users. Roles are mutually exclusive:
   profiles have one role at a time, and admin accounts use the approvals page.
6. The migration creates the public `trip-images` bucket with a 5 MB limit and
   image MIME allow-list. Verify it under **Storage → Buckets**. Files are not
   uploaded by this SQL seed; its image paths point to the existing local
   `images/` assets.
7. To make your own account an administrator, first create it in Auth, then run
   this one SQL statement after replacing the email:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (
     select id from auth.users where lower(email) = lower('YOUR_AUTH_EMAIL')
   );
   ```

8. In **Authentication → URL Configuration**, set the local/deployed site URL
   and add the matching login and `pages/forgot-password.html` URLs to the
   allowed redirect URLs. Password reset uses the latter with `?update=1`.
9. In `js/config.js`, replace the URL and anon-key placeholders with the
   project URL and anon/public key from **Project Settings → API**. Keep the
   service-role key out of frontend code and git. Create a real Auth test user
   with a password of at least six characters; do not use the former demo
   credentials.
10. Google sign-in stays disabled until the Google provider is configured in
   **Authentication → Providers** and `GOOGLE_OAUTH_ENABLED` is set to `true`
   in `js/config.js`.

## Important notes

- Do not put a service-role key or database password in the website or git.
- Configure email confirmation and password recovery templates/redirect URLs
  under **Authentication** before testing those flows.
- The current static site has two sample review cards but no Supabase Auth
  identities or confirmed bookings for those reviewers. The seed imports those
  comments only if matching profile usernames and confirmed bookings already
  exist; it does not invent users or bookings. On a new project the trip starts
  with no verified review rows.
- The seven existing trip date labels do not include years, so their seed rows
  preserve the labels and leave `start_date` / `end_date` unset.
- SQL Editor commands run with database-owner privileges and bypass ordinary
  client RLS behavior. Test policies later using separate anon and authenticated
  browser sessions.
- The SQL file is designed to be safely re-run for its DDL and policies. The
  seed uses stable trip IDs and avoids resetting existing trips or seat counts.

## Objects created

The migration creates profiles and host profiles; trips and their image,
itinerary, inclusion, and pickup-point tables; wishlist and cart tables;
coupons; bookings, booking travellers, and payments; reviews; custom trip
requests, contact messages, and newsletter subscribers. RLS is enabled for
every table. Booking writes and seat changes are performed by the
`create_booking` and `cancel_booking` database functions, not direct client
table writes.
