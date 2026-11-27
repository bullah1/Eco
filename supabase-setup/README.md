# New Supabase project setup

1. Supabase Dashboard > SQL Editor > New query. Paste all of `setup.sql` and run it once.
2. Authentication > URL Configuration: set Site URL to the live site address, and add it to Redirect URLs.
3. Create the first account on the website (Sign in > create account).
4. Make that account the admin. In SQL Editor run, with your own email:

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'YOUR-EMAIL-HERE'
   on conflict (user_id, role) do nothing;
   ```
5. Point the app at the new project by setting these values (`.env` locally, and the host's environment variables):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`,
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`.
   The publishable key is safe to expose. Never put the database password or the service role key in the repo.
6. Open /admin and add room types and rooms.
7. For booking without an account and guest reviews, also run `guest-booking-and-reviews.sql`
   (already applied on the current project).
8. For in-stay food and service orders (pending bills for the POS), run `in-stay-orders.sql`
   (already applied on the current project).
9. For meals and extras chosen per day, run `dated-extras.sql` (already applied on the current project).
10. For expenses and profit, kitchen stock, advance payments on bookings, seasonal / weekend
    room prices and admin-approved discounts, run `pos-extras.sql` (after `pos-customer-accounts.sql`).
    It is safe to run more than once.
