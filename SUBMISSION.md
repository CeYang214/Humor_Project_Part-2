# Final Submission (April 24, 2026)

## 1) Vercel App URLs (Commit-Specific)

- Caption creation + rating app  
  Commit: `d1d9d26a8c79224112d2d6d3129330e4af2af0d8`  
  URL: https://vercel.com/cecilia-yangs-projects/humor-project-hello-world/8zrt6HyZaMa8CFAgarhikJT1b5GK

- Admin area app  
  Commit: `4b7ca458e2776f719a04409f3ee359099b1b81b9`  
  URL: https://vercel.com/cecilia-yangs-projects/humor-project-part-3/3Q6ksV5zxvrWKmnGYywCEwAr9p1G

- Prompt chain tool app  
  Commit: `fb54787500d25c06e8ce95fd44b4db50f868d45c`  
  URL: https://vercel.com/cecilia-yangs-projects/humor-project-part-2/8V5nWaoQRuEa52EiifF36Ux2g1qG

## 2) Full QA/Test Plan (Tree Coverage)

### Project 1: Caption Creation + Rating App

- Authentication branch
  - Unauthenticated user lands on `/` and sees sign-in CTA
  - Click "Continue with Google" starts OAuth redirect
  - Successful callback redirects through `/auth/callback` to `/protected`
  - Sign-out returns to unauthenticated state
- Gallery load branch
  - Captions query succeeds and cards render
  - Missing images are filtered out
  - Empty result branch shows "No captions with images found"
  - Image load failure branch shows "Image failed to load"
- Pagination branch
  - Previous/Next behavior at first, middle, and last page
  - Page jump input valid branch
  - Page jump invalid/non-numeric branch resets input
- Voting branch
  - Unauthenticated vote attempt shows "Sign in to vote"
  - First vote creates `caption_votes` record
  - Existing vote updates `vote_value`
  - Database error branch displays inline error

### Project 2: Admin Area App

- Access control branch
  - `/admin/*` without session redirects to `/`
  - Authenticated non-Google provider redirects with `auth=google-required`
  - Missing `profiles` row redirects with `admin=missing-profile`
  - Non-superadmin redirects with `admin=forbidden`
  - Superadmin sees admin layout and pages
- Dashboard branch (`/admin`)
  - Count cards load from Supabase
  - Analytics sections handle partial query failure with warning banners
- Entity read branch (`/admin/users`, `/admin/captions`, `/admin/ratings`)
  - Data table loads with populated records
  - Empty-state branch for no records
  - Error-state banners when query fails
- Image CRUD branch (`/admin/images`)
  - Create image URL row
  - Update existing image URL
  - Delete image row
  - Upload file to storage + DB insert path
  - Storage/DB failure branch returns error banner
- Generic operations branch (`/admin/operations/[entity]`)
  - Entity table discovery from candidate names
  - Search/filter branch and clear search
  - Pagination first/prev/next/last branches
  - Create/update/delete branches by entity capability mode (`read`, `read_update`, `crud`)

### Project 3: Prompt Chain Tool App

- Protected caption pipeline branch (`/protected`)
  - File required validation branch
  - Content-type validation branch (jpeg/jpg/png/webp/gif/heic)
  - 4-step pipeline success path:
    - generate presigned URL
    - upload bytes
    - register image URL
    - generate captions
  - Per-step API error branch surfaces readable message
  - Saved history hydration + "Load" action branch
- Humor flavors admin branch (`/admin/humor-flavors`)
  - Flavor table and steps table resolution branch
  - Flavor create/update/delete
  - Flavor duplicate with cloned steps
  - Step create/update/delete/reorder
  - Test-set runner with selected flavor and selected image IDs
  - Missing token / generation failure branches

## 3) Test Execution Performed (3 Full Workflow Runs)

Executed route-level E2E smoke workflow **3 times** against production build using local `next start`:

- `GET /` returned `200` and rendered expected app shell content
- `GET /protected` returned `307` redirect to `/` without session
- `GET /admin` returned `307` redirect to `/` without session
- `GET /auth/callback` returned `307` redirect to `/protected`

All three cycles passed after fixes.

Environment note: authenticated/superadmin-only branches and external pipeline success-path calls require live OAuth login + real user session + dataset state, so those are fully enumerated in the QA plan and should be manually executed in browser during final demo validation.

## 4) Post-Testing Write-Up (Issues + Fixes)

- Ran `npm run lint` and `npm run build` before and after E2E cycles to ensure baseline health and no compile errors.
- Repeated end-to-end unauthenticated workflow checks for `/`, `/protected`, `/admin`, and `/auth/callback` for 3 complete cycles; all passed.
- Found one real issue: Next.js 16 deprecation warning for `middleware.ts` ("use `proxy` instead").
- Fixed that issue by migrating `middleware.ts` to `proxy.ts` and renaming exported handler to `proxy`.
- Updated lint script target from `middleware.ts` to `proxy.ts` so static checks stay valid.
- Re-ran lint, build, and all 3 E2E cycles post-fix; no regressions.
