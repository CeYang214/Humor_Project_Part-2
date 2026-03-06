# Humor Project Part 2

Next.js + Supabase app with:
- Caption creation/rating experience (`/` and `/protected`)
- Superadmin-only admin area (`/admin`)

## Admin Area Delivered

Routes:
- `/admin`: statistics dashboard (profiles/images/captions/votes)
- `/admin/users`: `READ` users/profiles
- `/admin/images`: `CREATE/READ/UPDATE/DELETE` images
- `/admin/captions`: `READ` captions

## Security Model

Admin routes are protected in two layers:
1. Middleware checks that a valid authenticated session exists for `/admin/*`.
2. Server-side guard (`requireSuperadmin`) blocks access unless:
   - authenticated through Google OAuth
   - `profiles.is_superadmin == TRUE` for the current user

No RLS policies were changed.

## Solving The "Superadmin Lockout" Problem

If you are not yet a superadmin, use Supabase SQL Editor (project owner privileges) to promote your own profile row:

```sql
update profiles
set is_superadmin = true
where id = '<your-auth-user-id>';
```

How to get your ID quickly:
- Sign in normally and copy the user id from your app session/profile display.
- Or query `profiles` for your email/username and copy the `id`.

This updates data only (not policies), so it respects the assignment constraint.

## Deployment Notes (Manual Step)

I pushed commit `903db315ee6f9576f6feaa68dd491aefc70ba5a7` to `main`.

To finish submission in Vercel:
1. Deploy/update your **caption creation + rating app** from this commit.
2. Deploy/update your **admin area app** from this commit (or from the admin-focused project if you split repos).
3. In each Vercel project, set **Deployment Protection** to **Off** so Incognito access works.
4. Copy the two commit-specific deployment URLs into your submission.
