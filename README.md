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

## Submissions

- Caption creation + rating app  
  Commit: `d1d9d26a8c79224112d2d6d3129330e4af2af0d8`  
  URL: https://vercel.com/cecilia-yangs-projects/humor-project-hello-world/8zrt6HyZaMa8CFAgarhikJT1b5GK
- Admin area app  
  Commit: `4b7ca458e2776f719a04409f3ee359099b1b81b9`  
  URL: https://vercel.com/cecilia-yangs-projects/humor-project-part-3/3Q6ksV5zxvrWKmnGYywCEwAr9p1G
- Prompt chain tool app  
  Commit: `fb54787500d25c06e8ce95fd44b4db50f868d45c`  
  URL: https://vercel.com/cecilia-yangs-projects/humor-project-part-2/8V5nWaoQRuEa52EiifF36Ux2g1qG
